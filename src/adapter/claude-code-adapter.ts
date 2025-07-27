import { type Options, query } from "@anthropic-ai/claude-code";
import type { Adapter, ClaudeMessage } from "../types.ts";
import type { Config } from "../config.ts";

// Adapter that manages communication with ClaudeCode API
export class ClaudeCodeAdapter implements Adapter {
  name = "claude-code";
  private config: Config;
  private currentSessionId?: string;
  private isFirstQuery = true;
  private abortController?: AbortController;

  constructor(config: Config) {
    this.config = config;
    
    // Set first query flag to false for resume sessions
    if (config.sessionId) {
      this.isFirstQuery = false;
      this.currentSessionId = config.sessionId;
    }

    // Set Claude API key to environment variable
    if (config.claudeApiKey) {
      Deno.env.set("ANTHROPIC_API_KEY", config.claudeApiKey);
    }
  }

  async start(): Promise<void> {
    console.log(`[${this.name}] Claude Code adapter started`);
    console.log(`[${this.name}] Model: ${this.config.model}`);
    if (this.currentSessionId) {
      console.log(`[${this.name}] Resuming session: ${this.currentSessionId}`);
    }
  }

  async stop(): Promise<void> {
    console.log(`[${this.name}] Stopping Claude Code adapter...`);
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Send query to Claude API
  async query(prompt: string, onProgress?: (message: ClaudeMessage) => Promise<void>): Promise<string> {
    const options: Options = {
      maxTurns: this.config.maxTurns,
      model: this.config.model,
      permissionMode: "bypassPermissions",
      ...(this.isFirstQuery ? {} : { continue: true }),
      ...(this.config.sessionId && this.isFirstQuery ? { resume: this.config.sessionId } : {}),
    };

    this.abortController = new AbortController();
    
    try {
      const response = query({
        prompt,
        options,
        abortController: this.abortController,
      });

      let fullResponse = "";
      let toolResults = "";
      
      for await (const message of response) {
        // Call progress callback if available
        if (onProgress) {
          await onProgress(message as ClaudeMessage);
        }

        if (message.type === "assistant") {
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
          // Save session ID
          this.currentSessionId = message.session_id;
          console.log(`[${this.name}] Session started: ${this.currentSessionId}`);
          
          if (this.isFirstQuery) {
            this.isFirstQuery = false;
          }
        } else if (message.type === "result") {
          // Update session ID from result message
          this.currentSessionId = message.session_id;
        } else if (message.type === "user") {
          // Process tool execution results
          const content = message.message.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "tool_result" && typeof item.content === "string") {
                const truncated = item.content.length > 300
                  ? item.content.substring(0, 300) + "..."
                  : item.content;
                toolResults += `\n📋 Tool execution result:\n\`\`\`\n${truncated}\n\`\`\`\n`;
              }
            }
          }
        }
      }

      // Add toolResults to fullResponse if available
      if (toolResults) {
        fullResponse = toolResults + (fullResponse ? "\n" + fullResponse : "");
      }

      return fullResponse || "No response received.";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Query was aborted");
      }
      throw error;
    }
  }

  // Reset session
  resetSession(): void {
    this.isFirstQuery = true;
    this.currentSessionId = undefined;
    console.log(`[${this.name}] Session reset`);
  }

  // Get current session ID
  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  // Abort query
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      console.log(`[${this.name}] Query aborted`);
    }
  }

  // Adapter state
  isReady(): boolean {
    return !!this.config.claudeApiKey;
  }

  hasActiveSession(): boolean {
    return !!this.currentSessionId;
  }
}