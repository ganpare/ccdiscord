import type { Actor, ActorMessage, ActorResponse } from "../types.ts";

// Debug Actor (doesn't use ClaudeCode)
export class DebugActor implements Actor {
  name: string;
  private readonly responses = [
    "I see, that's interesting.",
    "Understood!",
    "Could you tell me more details?",
    "Let me think about that...",
    "That's a great idea!",
  ];

  constructor(name = "debug") {
    this.name = name;
  }

  async start(): Promise<void> {
    console.log(`[${this.name}] Actor started`);
  }

  async stop(): Promise<void> {
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
    console.log(`[${this.name}] Received message:`, message);

    switch (message.type) {
      case "echo":
        // Echo back
        return this.createResponse(
          message.from,
          "echo-response",
          message.payload,
          message.id
        );

      case "random":
        // Random response
        const randomIndex = Math.floor(Math.random() * this.responses.length);
        return this.createResponse(
          message.from,
          "random-response",
          { text: this.responses[randomIndex] },
          message.id
        );

      case "think":
        // Thinking simulation
        const duration = (message.payload as { duration?: number })?.duration || 1000;
        await new Promise(resolve => setTimeout(resolve, duration));
        return this.createResponse(
          message.from,
          "think-response",
          { text: "Finished thinking!", duration },
          message.id
        );

      case "chat":
        // Conversation simulation
        const inputText = (message.payload as { text?: string })?.text || "";
        const responseText = this.generateChatResponse(inputText);
        return this.createResponse(
          message.from,
          "chat-response",
          { text: responseText },
          message.id
        );

      case "user-message":
        // Message from user
        const userText = (message.payload as { text?: string })?.text || "";
        const userResponse = this.generateChatResponse(userText);
        return this.createResponse(
          message.from,
          "assistant-response",
          { text: userResponse },
          message.id
        );

      default:
        // Unknown message type
        return this.createResponse(
          message.from,
          "error",
          { error: `Unknown message type: ${message.type}` },
          message.id
        );
    }
  }

  private generateChatResponse(input: string): string {
    // Simple conversation logic
    if (input.includes("task") || input.includes("Task")) {
      return "Today's tasks are as follows:\n1. Conduct code review\n2. Update documentation\n3. Add test cases";
    }
    if (input.includes("hello") || input.includes("Hello") || input.includes("hi") || input.includes("Hi")) {
      return "Hello! How are you?";
    }
    if (input.includes("how are you") || input.includes("How are you")) {
      return "I'm doing well! What did you do today?";
    }
    if (input.includes("？")) {
      return "That's a good question. Let me think about it more.";
    }
    
    // Default to random response
    const randomIndex = Math.floor(Math.random() * this.responses.length);
    return this.responses[randomIndex];
  }
}