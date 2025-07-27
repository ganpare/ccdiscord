import {
  Client,
  GatewayIntentBits,
  Message,
  TextChannel,
  ThreadChannel,
} from "npm:discord.js@14.14.1";
import type { Adapter, MessageBus, ActorMessage } from "../types.ts";
import type { Config } from "../config.ts";
import { t } from "../i18n.ts";

// Adapter that manages Discord connection
export class DiscordAdapter implements Adapter {
  name = "discord";
  private client: Client;
  private config: Config;
  private messageBus: MessageBus;
  private currentThread: ThreadChannel | null = null;
  private isRunning = false;

  constructor(config: Config, messageBus: MessageBus) {
    this.config = config;
    this.messageBus = messageBus;
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    console.log(`[${this.name}] ${t("discord.starting")}`);
    
    try {
      await this.client.login(this.config.discordToken);
      this.isRunning = true;
    } catch (error) {
      console.error(`[${this.name}] ${t("discord.failedLogin")}`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log(`[${this.name}] ${t("discord.stopping")}`);
    
    if (this.currentThread && this.currentThread.sendable) {
      try {
        await this.currentThread.send(t("discord.goodbye"));
      } catch (error) {
        console.error(`[${this.name}] ${t("discord.failedGoodbye")}`, error);
      }
    }

    this.client.destroy();
    this.isRunning = false;
  }

  private setupEventHandlers(): void {
    this.client.once("ready", () => this.handleReady());
    this.client.on("messageCreate", (message) => this.handleMessage(message));
    this.client.on("error", (error) => this.handleError(error));
  }

  private async handleReady(): Promise<void> {
    console.log(`[${this.name}] ${t("discord.ready")} ${this.client.user?.tag}`);
    
    try {
      const channel = await this.client.channels.fetch(this.config.channelId);
      if (channel && channel.isTextBased() && !channel.isThread()) {
        await this.createThread(channel as TextChannel);
      }
    } catch (error) {
      console.error(`[${this.name}] ${t("discord.failedSetup")}`, error);
    }
  }

  private async createThread(channel: TextChannel): Promise<void> {
    const threadName = `Claude Session - ${new Date().toLocaleString("ja-JP")}`;
    
    try {
      this.currentThread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 1440, // 24 hours
        reason: "Claude session thread",
      });

      // Send initial message
      const initialMessage = this.createInitialMessage();
      await this.currentThread.send(initialMessage);

      console.log(`[${this.name}] ${t("discord.threadCreated")} ${threadName}`);
    } catch (error) {
      console.error(`[${this.name}] ${t("discord.failedCreateThread")}`, error);
    }
  }

  private createInitialMessage(): string {
    return `## ${t("discord.sessionInfo.title")}

**${t("discord.sessionInfo.startTime")}**: ${new Date().toISOString()}
**${t("discord.sessionInfo.workDir")}**: \`${Deno.cwd()}\`
**${t("discord.sessionInfo.mode")}**: ${this.config.debugMode ? "Debug" : "Production"}
${this.config.neverSleep ? `**${t("discord.sessionInfo.neverSleepEnabled")}**` : ""}

---

${t("discord.instructions.header")}
- \`!reset\` or \`!clear\`: ${t("discord.instructions.reset")}
- \`!stop\`: ${t("discord.instructions.stop")}
- \`!exit\`: ${t("discord.instructions.exit")}
- \`!<command>\`: ${t("discord.instructions.shellCommand")}
- ${t("discord.instructions.normalMessage")}`;
  }

  private async handleMessage(message: Message): Promise<void> {
    // Ignore own messages and messages from other bots
    if (message.author.bot) return;
    
    // Ignore messages outside current thread
    if (!this.currentThread || message.channel.id !== this.currentThread.id) return;
    
    // Ignore messages from users other than specified
    if (message.author.id !== this.config.userId) return;

    const content = message.content.trim();
    if (!content) return;

    console.log(`[${this.name}] ${t("discord.receivedMessage")} ${message.author.username}: ${content}`);

    // Convert Discord message to ActorMessage
    const actorMessage: ActorMessage = {
      id: message.id,
      from: "discord",
      to: "user",
      type: "discord-message",
      payload: {
        text: content,
        authorId: message.author.id,
        channelId: message.channel.id,
      },
      timestamp: new Date(),
    };

    // Send message to UserActor
    const response = await this.messageBus.send(actorMessage);
    
    if (response) {
      // Process response
      await this.handleActorResponse(message, response);
    }
  }

  private async handleActorResponse(originalMessage: Message, response: ActorMessage): Promise<void> {
    // Handle system commands
    if (response.to === "system") {
      await this.handleSystemCommand(originalMessage, response);
      return;
    }

    // Forward regular messages to assistant
    if (response.to === "assistant" || response.to === "auto-responder") {
      const assistantResponse = await this.messageBus.send(response);
      
      if (assistantResponse) {
        const text = (assistantResponse.payload as { text?: string })?.text;
        if (text) {
          await this.sendLongMessage(originalMessage, text);
        }
      }
    }
  }

  private async handleSystemCommand(message: Message, response: ActorMessage): Promise<void> {
    const channel = message.channel as TextChannel | ThreadChannel;
    
    switch (response.type) {
      case "reset-session":
        await channel.send(t("discord.commands.resetComplete"));
        break;
        
      case "stop-tasks":
        await channel.send(t("discord.commands.stopComplete"));
        break;
        
      case "shutdown":
        await channel.send(t("discord.commands.exitMessage"));
        await this.stop();
        Deno.exit(0);
        
      case "execute-command":
        const command = (response.payload as { command?: string })?.command;
        if (command) {
          await channel.send(`${t("discord.commands.executing")} \`${command}\``);
          // TODO: Implement command execution functionality
        }
        break;
    }
  }

  private async sendLongMessage(message: Message, content: string): Promise<void> {
    const channel = message.channel as TextChannel | ThreadChannel;
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

    for (const msg of messages) {
      try {
        await channel.send(msg);
        // Wait a bit to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[${this.name}] ${t("discord.failedSendMessage")}`, error);
      }
    }
  }

  private handleError(error: Error): void {
    console.error(`[${this.name}] ${t("discord.clientError")}`, error);
  }

  // Utility methods
  getCurrentThread(): ThreadChannel | null {
    return this.currentThread;
  }

  isConnected(): boolean {
    return this.isRunning && this.client.ws.status === 0;
  }
}