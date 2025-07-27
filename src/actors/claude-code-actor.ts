import type { Actor, ActorMessage, ActorResponse } from "../types.ts";
import { ClaudeCodeAdapter } from "../adapter/claude-code-adapter.ts";
import type { Config } from "../config.ts";

// Actor that communicates with ClaudeCode API
export class ClaudeCodeActor implements Actor {
  name: string;
  private adapter: ClaudeCodeAdapter;

  constructor(config: Config, name = "claude-code") {
    this.name = name;
    this.adapter = new ClaudeCodeAdapter(config);
  }

  async start(): Promise<void> {
    console.log(`[${this.name}] Actor started`);
    await this.adapter.start();
  }

  async stop(): Promise<void> {
    await this.adapter.stop();
    console.log(`[${this.name}] Actor stopped`);
  }

  protected createResponse(
    to: string,
    type: string,
    payload: unknown,
    originalMessageId?: string
  ): ActorResponse {
    return {
      id: originalMessageId ? `${originalMessageId}-response` : crypto.randomUUID(),
      from: this.name,
      to,
      type,
      payload,
      timestamp: new Date(),
    };
  }

  async handleMessage(message: ActorMessage): Promise<ActorResponse | null> {
    console.log(`[${this.name}] Processing message with Claude Code`);

    const content = message.payload as { text?: string };
    const text = content.text;

    if (!text) {
      return this.createResponse(
        message.from,
        "error",
        { error: "No text provided for Claude" },
        message.id
      );
    }

    try {
      const response = await this.adapter.query(text);
      
      return this.createResponse(
        message.from,
        "claude-response",
        { text: response, sessionId: this.adapter.getCurrentSessionId() },
        message.id
      );
    } catch (error) {
      console.error(`[${this.name}] Error querying Claude:`, error);
      
      return this.createResponse(
        message.from,
        "error",
        { error: error instanceof Error ? error.message : "Unknown error" },
        message.id
      );
    }
  }

  // Reset session
  resetSession(): void {
    this.adapter.resetSession();
  }

  getCurrentSessionId(): string | undefined {
    return this.adapter.getCurrentSessionId();
  }
}