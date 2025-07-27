import type { Actor, ActorMessage, ActorResponse } from "../types.ts";

// Base Actor class
export abstract class BaseActor implements Actor {
  constructor(public name: string) {}

  async start(): Promise<void> {
    console.log(`[${this.name}] Actor started`);
  }

  async stop(): Promise<void> {
    console.log(`[${this.name}] Actor stopped`);
  }

  abstract handleMessage(message: ActorMessage): Promise<ActorResponse | null>;

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
}