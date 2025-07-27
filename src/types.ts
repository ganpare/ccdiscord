// Type definitions for messages exchanged between Actors
export interface ActorMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: unknown;
  timestamp: Date;
}

// Response from Actor
export interface ActorResponse {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: unknown;
  timestamp: Date;
}

// Basic Actor interface
export interface Actor {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  handleMessage(message: ActorMessage): Promise<ActorResponse | null>;
}

// Message bus interface
export interface MessageBus {
  register(actor: Actor): void;
  unregister(actorName: string): void;
  send(message: ActorMessage): Promise<ActorResponse | null>;
  broadcast(message: ActorMessage): Promise<ActorResponse[]>;
}

// Basic Adapter interface
export interface Adapter {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Discord-related type definitions
export interface DiscordMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  timestamp: Date;
}

// ClaudeCode-related type definitions
export interface ClaudeMessage {
  type: "user" | "assistant" | "system" | "result";
  content?: string | Array<{ type: string; text?: string }>;
  session_id?: string;
  subtype?: string;
}