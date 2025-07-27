import type { Actor, ActorMessage, ActorResponse, MessageBus } from "./types.ts";

// MessageBus that manages messaging between Actors
export class SimpleMessageBus implements MessageBus {
  private actors: Map<string, Actor> = new Map();

  register(actor: Actor): void {
    console.log(`[MessageBus] Registering actor: ${actor.name}`);
    this.actors.set(actor.name, actor);
  }

  unregister(actorName: string): void {
    console.log(`[MessageBus] Unregistering actor: ${actorName}`);
    this.actors.delete(actorName);
  }

  async send(message: ActorMessage): Promise<ActorResponse | null> {
    const targetActor = this.actors.get(message.to);
    
    if (!targetActor) {
      console.log(`[MessageBus] Actor not found: ${message.to}`);
      return null;
    }

    console.log(`[MessageBus] Sending message from ${message.from} to ${message.to}`);
    return await targetActor.handleMessage(message);
  }

  async broadcast(message: ActorMessage): Promise<ActorResponse[]> {
    console.log(`[MessageBus] Broadcasting message from ${message.from}`);
    const responses: ActorResponse[] = [];

    for (const [actorName, actor] of this.actors) {
      // Don't send to the sender
      if (actorName === message.from) continue;

      const broadcastMessage: ActorMessage = {
        ...message,
        to: actorName,
      };

      const response = await actor.handleMessage(broadcastMessage);
      if (response) {
        responses.push(response);
      }
    }

    return responses;
  }

  // Utility methods
  getActorNames(): string[] {
    return Array.from(this.actors.keys());
  }

  hasActor(actorName: string): boolean {
    return this.actors.has(actorName);
  }

  async startAll(): Promise<void> {
    console.log("[MessageBus] Starting all actors...");
    for (const actor of this.actors.values()) {
      await actor.start();
    }
  }

  async stopAll(): Promise<void> {
    console.log("[MessageBus] Stopping all actors...");
    for (const actor of this.actors.values()) {
      await actor.stop();
    }
  }
}