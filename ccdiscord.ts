#!/usr/bin/env -S deno run -A --env

import {
  Client,
  GatewayIntentBits,
  Message,
  TextChannel,
  ThreadChannel,
} from "npm:discord.js@14.14.1";
import { type Options, query } from "@anthropic-ai/claude-code";
import { $ } from "@david/dax";

// ==================== 設定 ====================
const config = {
  discordToken: Deno.env.get("CC_DISCORD_TOKEN"),
  channelId: Deno.env.get("CC_DISCORD_CHANNEL_ID"),
  userId: Deno.env.get("CC_DISCORD_USER_ID"),
  claudeApiKey:
    Deno.env.get("CC_CLAUDE_API_KEY") || Deno.env.get("CC_ANTHROPIC_API_KEY"),
};

// 設定の検証
if (!config.discordToken || !config.channelId || !config.userId) {
  console.error(
    "CC_DISCORD_TOKEN, CC_DISCORD_CHANNEL_ID, CC_DISCORD_USER_ID を .env ファイルに設定してください"
  );
  Deno.exit(1);
}

// ==================== タイプ定義 ====================
interface QueuedTask {
  message: Message;
  timestamp: Date;
}

interface EnvironmentInfo {
  workingDirectory: string;
  platform: string;
  denoVersion: string;
  timestamp: string;
}

// ==================== メッセージフォーマット ====================
const MessageType = {
  THINKING: "thinking",
  RESET: "reset",
  ERROR: "error",
  INFO: "info",
  DONE: "done",
  EXIT: "exit",
} as const;

type MessageTypeKey = (typeof MessageType)[keyof typeof MessageType];

function formatMessage(type: MessageTypeKey, content?: string): string {
  switch (type) {
    case MessageType.THINKING:
      return "🤔 考え中...";
    case MessageType.RESET:
      return "💫 会話をリセットしました。新しい会話を始めましょう！";
    case MessageType.ERROR:
      return `❌ エラーが発生しました${
        content ? `: ${content}` : "。もう一度お試しください。"
      }`;
    case MessageType.INFO:
      return `ℹ️ ${content}`;
    case MessageType.DONE:
      return "(done)";
    case MessageType.EXIT:
      return "👋 (exit) - ボットを終了します";
    default:
      return content || "";
  }
}

function formatLogMessage(type: string, data: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const parts = [`[${timestamp}] ${type}:`];

  for (const [key, value] of Object.entries(data)) {
    parts.push(`- ${key}: ${value}`);
  }

  return parts.join("\n");
}

// ==================== 環境情報 ====================
function getEnvironmentInfo(): EnvironmentInfo {
  return {
    workingDirectory: Deno.cwd(),
    platform: `${Deno.build.os} (${Deno.build.arch})`,
    denoVersion: Deno.version.deno,
    timestamp: new Date().toISOString(),
  };
}

function formatEnvironmentInfo(info: EnvironmentInfo): string {
  return `## セッション情報

**開始時刻**: ${info.timestamp}
**作業ディレクトリ**: \`${info.workingDirectory}\`
**プラットフォーム**: ${info.platform}
**Deno バージョン**: ${info.denoVersion}

---

このスレッドでメッセージを送信すると、Claude Code が応答します。
- \`!reset\` または \`!clear\`: 会話をリセット
- \`!stop\`: 実行中のタスクを中断
- \`!exit\`: ボットを終了
- \`!コマンド\`: シェルコマンドを実行（例: \`!ls\`, \`!pwd\`, \`!git status\`）
- 通常のメッセージ: Claude に問い合わせ`;
}

// ==================== タスクキュー ====================
class TaskQueue {
  private queue: QueuedTask[] = [];
  private isProcessing = false;
  private currentAbortController: AbortController | null = null;

  add(message: Message): void {
    this.queue.push({
      message,
      timestamp: new Date(),
    });
  }

  next(): QueuedTask | undefined {
    return this.queue.shift();
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }

  get processing(): boolean {
    return this.isProcessing;
  }

  setProcessing(value: boolean): void {
    this.isProcessing = value;
  }

  setAbortController(controller: AbortController | null): void {
    this.currentAbortController = controller;
  }

  abort(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }
}

// ==================== グローバル変数 ====================
const DEFAULT_OPTIONS: Options = {
  maxTurns: 300,
  model: "claude-opus-4-20250514",
  permissionMode: "bypassPermissions",
};

let currentSessionId: string | undefined;
let isFirstQuery = true;
let currentThread: ThreadChannel | null = null;
const taskQueue = new TaskQueue();

// ==================== コマンド実行 ====================
// 危険なコマンドのリスト
const DANGEROUS_COMMANDS = [
  "rm",
  "rmdir",
  "del",
  "delete",
  "format",
  "fdisk",
  "dd",
  "mkfs",
  "shutdown",
  "reboot",
  "poweroff",
  "halt",
  "kill",
  "killall",
  "pkill",
  "sudo",
  "su",
  "chmod",
  "chown",
  "mount",
  "umount",
  ">", // リダイレクト
  ">>", // アペンド
];

// コマンドが安全かチェック
function isCommandSafe(command: string): boolean {
  const commandLower = command.toLowerCase();
  const parts = commandLower.split(/\s+/);
  const baseCommand = parts[0];

  // 危険なコマンドをチェック
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (
      baseCommand === dangerous ||
      commandLower.includes(`/${dangerous} `) ||
      commandLower.includes(`\\${dangerous} `)
    ) {
      return false;
    }
  }

  // パイプやリダイレクトを含む場合は危険とみなす
  if (command.includes("|") || command.includes(">") || command.includes("<")) {
    return false;
  }

  // セミコロンやアンパサンドで複数コマンドを実行しようとする場合
  if (command.includes(";") || command.includes("&")) {
    return false;
  }

  // バッククォートやドルマークを使ったコマンド実行
  if (command.includes("`") || command.includes("$(")) {
    return false;
  }

  return true;
}

// コマンドを実行
async function executeCommand(command: string): Promise<string> {
  try {
    // コマンドの安全性をチェック
    if (!isCommandSafe(command)) {
      return "🚫 セキュリティ上の理由により、このコマンドの実行は許可されていません。";
    }

    console.log(
      formatLogMessage("コマンド実行", {
        コマンド: command,
      })
    );

    // タイムアウトを設定（30秒）
    const timeout = 30000;

    // シェルを使ってコマンドを実行
    const result = await $`sh -c ${command}`.stdout("piped").timeout(timeout);
    const output = result.stdout;

    // 出力を整形（末尾の改行を削除）
    const trimmedOutput = output.trim();

    // 出力が空の場合
    if (!trimmedOutput) {
      return "✅ コマンドが正常に実行されました（出力なし）";
    }

    // 出力が長すぎる場合は切り詰める
    const maxLength = 1800;
    if (trimmedOutput.length > maxLength) {
      return `\`\`\`\n${trimmedOutput.substring(
        0,
        maxLength
      )}\n\`\`\`\n\n⚠️ 出力が長すぎるため、最初の ${maxLength} 文字のみ表示しています。`;
    }

    return `\`\`\`\n${trimmedOutput}\n\`\`\``;
  } catch (error) {
    console.error("コマンド実行エラー:", error);

    // エラーの種類に応じてメッセージを変える
    if (error instanceof Deno.errors.NotFound) {
      return `❌ コマンドが見つかりません: ${command.split(/\s+/)[0]}`;
    } else if (error instanceof Error && error.message.includes("timed out")) {
      return "⏱️ コマンドの実行がタイムアウトしました（30秒）";
    } else if (error instanceof Error) {
      return `❌ エラー: ${error.message}`;
    } else {
      return "❌ 不明なエラーが発生しました";
    }
  }
}

// ==================== Claude API ====================
async function askClaudeWithCallback(
  question: string,
  abortSignal?: AbortSignal,
  onProgress?: (content: string) => Promise<void>
): Promise<string> {
  try {
    console.log(
      formatLogMessage("Claude 問い合わせ", {
        質問: question,
      })
    );

    // オプションを設定（2回目以降は continue を使用）
    const options: Options = {
      ...DEFAULT_OPTIONS,
      ...(isFirstQuery ? {} : { continue: true }),
    };

    const abortController = new AbortController();
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => abortController.abort());
    }

    const response = query({
      prompt: question,
      options,
      abortController,
    });

    // ストリーミングレスポンスを文字列に変換
    let fullResponse = "";
    let toolResults = "";
    for await (const message of response) {
      // 中断シグナルをチェック
      if (abortSignal?.aborted) {
        throw new Error("タスクが中断されました");
      }

      if (message.type === "assistant") {
        // assistant メッセージからテキストを抽出
        const content = message.message.content;
        if (typeof content === "string") {
          fullResponse += content;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
            }
          }
        }
      } else if (message.type === "system" && message.subtype === "init") {
        // セッションIDを保存
        currentSessionId = message.session_id;
        console.log(
          formatLogMessage("セッション開始", {
            セッションID: currentSessionId,
          })
        );
        // 初回クエリが完了
        if (isFirstQuery) {
          isFirstQuery = false;
        }
      } else if (message.type === "result") {
        // 結果メッセージでセッションIDを更新
        currentSessionId = message.session_id;
      } else if (message.type === "user") {
        // ユーザーメッセージ（tool_result など）を処理
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (
              item.type === "tool_result" &&
              typeof item.content === "string"
            ) {
              // tool_result の内容を追加（長い場合は切り詰める）
              const truncated =
                item.content.length > 300
                  ? item.content.substring(0, 300) + "..."
                  : item.content;
              toolResults += `\n\`\`\`\n${truncated}\n\`\`\`\n`;

              // 中間出力をコールバックに送信
              if (onProgress) {
                const progressContent = `📋 ツール実行結果:\n\`\`\`\n${truncated}\n\`\`\``;
                await onProgress(progressContent);
              }
            }
          }
        }
      } else {
        // 想定外のメッセージタイプをログ出力（最初の300文字まで）
        const messageStr = JSON.stringify(message);
        const truncated =
          messageStr.length > 300
            ? messageStr.substring(0, 300) + "..."
            : messageStr;
        console.log(
          formatLogMessage("その他のメッセージタイプ", {
            タイプ: (message as { type?: string }).type || "unknown",
            内容: truncated,
          })
        );
      }
    }

    // コードブロックがある場合は Discord のフォーマットに変換
    fullResponse = fullResponse.replace(/```(\w+)?\n/g, "```$1\n");

    // toolResults がある場合は、fullResponse に追加
    if (toolResults) {
      fullResponse = toolResults + (fullResponse ? "\n" + fullResponse : "");
    }

    return (
      fullResponse ||
      formatMessage(MessageType.INFO, "応答がありませんでした。")
    );
  } catch (error) {
    console.error("Claude への問い合わせエラー:", error);
    return formatMessage(MessageType.ERROR, (error as Error).message);
  }
}

// ==================== メッセージ送信 ====================
async function sendLongMessage(
  message: Message,
  content: string
): Promise<void> {
  const messages: string[] = [];
  let currentMessage = "";

  const lines = content.split("\n");
  for (const line of lines) {
    if (currentMessage.length + line.length + 1 > 1900) {
      messages.push(currentMessage);
      currentMessage = line;
    } else {
      currentMessage += (currentMessage ? "\n" : "") + line;
    }
  }
  if (currentMessage) {
    messages.push(currentMessage);
  }

  const channel = message.channel;
  if (!channel || !channel.isTextBased()) {
    return;
  }

  // 型アサーションを使用
  const textChannel = channel as TextChannel | ThreadChannel;

  for (const msg of messages) {
    try {
      await textChannel.send(msg);
      // レート制限を避けるため少し待機
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("メッセージ送信エラー:", error);
      // エラーが発生しても続行
    }
  }
}

// ==================== キュー処理 ====================
async function processQueue(): Promise<void> {
  if (taskQueue.isEmpty() || taskQueue.processing) {
    return;
  }

  taskQueue.setProcessing(true);

  while (!taskQueue.isEmpty()) {
    const task = taskQueue.next();
    if (!task) break;

    const { message } = task;
    const channel = message.channel;

    if (!channel || !channel.isTextBased()) {
      continue;
    }

    // 型アサーションを使用
    const textChannel = channel as TextChannel | ThreadChannel;

    try {
      // AbortController を作成
      const abortController = new AbortController();
      taskQueue.setAbortController(abortController);

      // "考え中..." メッセージを送信
      let thinkingMessage: Message | null = null;
      try {
        thinkingMessage = await textChannel.send(
          formatMessage(MessageType.THINKING)
        );
      } catch (error) {
        console.error("考え中メッセージの送信エラー:", error);
      }

      // 中間出力用のメッセージ
      let progressMessage: Message | undefined;

      // Claude に問い合わせ（応答処理をカスタマイズ）
      const response = await askClaudeWithCallback(
        message.content,
        abortController.signal,
        async (content: string) => {
          // 中間出力を表示
          try {
            if (progressMessage) {
              // 既存のメッセージを編集
              await progressMessage.edit(content).catch(async () => {
                // 編集できない場合は新しいメッセージを送信
                const newMessage = await textChannel.send(content);
                progressMessage = newMessage;
              });
            } else {
              // 初回は新しいメッセージを送信
              progressMessage = await textChannel.send(content);
            }
          } catch (error) {
            console.error("中間出力の送信エラー:", error);
          }
        }
      );

      // 中間出力メッセージを削除
      if (progressMessage) {
        try {
          await progressMessage.delete();
        } catch (error) {
          console.error("中間出力メッセージの削除エラー:", error);
        }
      }

      // "考え中..." メッセージを削除
      if (thinkingMessage) {
        try {
          await thinkingMessage.delete();
        } catch (error) {
          console.error("考え中メッセージの削除エラー:", error);
        }
      }

      // Claude の応答を Discord に送信
      try {
        await sendLongMessage(message, response);
      } catch (error) {
        console.error("応答メッセージの送信エラー:", error);
      }

      // 完了メッセージを送信
      try {
        await textChannel.send(formatMessage(MessageType.DONE));
      } catch (error) {
        console.error("完了メッセージの送信エラー:", error);
      }
    } catch (error) {
      console.error("メッセージ処理エラー:", error);
      if ((error as Error).message === "タスクが中断されました") {
        await textChannel.send("⛔ タスクが中断されました。");
      } else {
        await textChannel.send(formatMessage(MessageType.ERROR));
      }
    } finally {
      taskQueue.setAbortController(null);
    }
  }

  taskQueue.setProcessing(false);
}

// ==================== Discord クライアント ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Discord イベントハンドラー
client.once("ready", async () => {
  console.log(
    formatLogMessage("ボット準備完了", {
      タグ: client.user?.tag,
      チャンネルID: config.channelId,
      ユーザーID: config.userId,
    })
  );

  // チャンネルを取得してスレッドを作成
  try {
    const channel = await client.channels.fetch(config.channelId!);
    if (channel && channel.isTextBased() && !channel.isThread()) {
      const envInfo = getEnvironmentInfo();
      const threadName = `Claude Session - ${new Date().toLocaleString(
        "ja-JP"
      )}`;

      // スレッドを作成
      const thread = await (channel as TextChannel).threads.create({
        name: threadName,
        autoArchiveDuration: 1440, // 24時間
        reason: "Claude セッション用スレッド",
      });

      currentThread = thread;

      // 環境情報を投稿
      await thread.send(formatEnvironmentInfo(envInfo));

      console.log(
        formatLogMessage("スレッド作成完了", {
          スレッド名: threadName,
          スレッドID: thread.id,
        })
      );
    }
  } catch (error) {
    console.error("スレッド作成エラー:", error);
  }
});

client.on("messageCreate", async (message: Message) => {
  // スレッド内のメッセージのみに応答
  if (
    currentThread &&
    message.channel.id === currentThread.id &&
    message.author.id === config.userId &&
    !message.author.bot &&
    message.content.trim()
  ) {
    console.log(
      formatLogMessage("メッセージ受信", {
        送信者: message.author.username,
        内容: message.content,
      })
    );

    const channel = message.channel;
    if (!channel || !channel.isTextBased()) {
      return;
    }

    // 型アサーションを使用
    const textChannel = channel as TextChannel | ThreadChannel;

    // !exit コマンドの処理
    if (message.content === "!exit") {
      await textChannel.send(formatMessage(MessageType.EXIT));
      // 少し待機してメッセージが送信されるのを確認
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // クライアントを破棄して終了
      client.destroy();
      Deno.exit(0);
    }

    // !stop コマンドの処理
    if (message.content.includes("!stop")) {
      taskQueue.abort();
      taskQueue.clear();
      taskQueue.setProcessing(false);
      await textChannel.send("⛔ 実行中のタスクを停止しました。");
      return;
    }

    // リセットコマンドの処理
    if (message.content === "!reset" || message.content === "!clear") {
      isFirstQuery = true;
      currentSessionId = undefined;
      await textChannel.send(formatMessage(MessageType.RESET));
      return;
    }

    // ! で始まるコマンドの処理（!reset, !clear, !stop, !exit 以外）
    if (
      message.content.startsWith("!") &&
      !message.content.startsWith("!reset") &&
      !message.content.startsWith("!clear") &&
      !message.content.startsWith("!stop") &&
      !message.content.startsWith("!exit")
    ) {
      // コマンドを抽出（!を除く）
      const command = message.content.substring(1).trim();

      if (command) {
        // コマンドを実行
        const result = await executeCommand(command);
        await sendLongMessage(message, result);
      } else {
        await textChannel.send("❌ コマンドが指定されていません。");
      }
      return;
    }

    // タスクをキューに追加
    taskQueue.add(message);

    // 現在処理中でなければ、キューの処理を開始
    if (!taskQueue.processing) {
      processQueue();
    } else {
      // キューに追加されたことを通知
      await textChannel.send(
        `📝 キューに追加しました（待機中: ${taskQueue.size()}件）`
      );
    }
  }
});

// エラーハンドリング
client.on("error", (error) => {
  console.error("Discord クライアントエラー:", error);
});

// メイン処理
async function main(): Promise<void> {
  // 環境変数から API キーが読み取られるように設定
  if (config.claudeApiKey) {
    Deno.env.set("ANTHROPIC_API_KEY", config.claudeApiKey);
  }

  console.log(
    formatLogMessage("起動中", {
      モード: "Discord Claude ボット (Deno)",
    })
  );

  // Discord にログイン
  await client.login(config.discordToken);
}

// シグナルハンドリング
Deno.addSignalListener("SIGINT", async () => {
  console.log("\n終了処理を開始します...");

  // 現在のスレッドに終了メッセージを送信
  if (currentThread && currentThread.sendable) {
    try {
      await currentThread.send(formatMessage(MessageType.EXIT));
      // メッセージが送信されるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("終了メッセージの送信に失敗:", error);
    }
  }

  client.destroy();
  Deno.exit(0);
});

// 起動
main().catch((error) => {
  console.error("起動エラー:", error);
  Deno.exit(1);
});
