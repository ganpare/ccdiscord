import type { Actor, ActorMessage, ActorResponse } from "../types.ts";

// Auto-responder Actor (Never Sleep feature, etc.)
export class AutoResponderActor implements Actor {
  name: string;
  private startTime: Date;
  private maxExecutionTime: number;
  private idleTimeout: number;

  constructor(name = "auto-responder") {
    this.name = name;
    this.startTime = new Date();
    this.maxExecutionTime = 6 * 60 * 60 * 1000; // 6 hours
    this.idleTimeout = 5 * 60 * 1000; // 5 minutes
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
      case "check-tasks":
        return this.handleCheckTasks(message);

      case "idle-check":
        return this.handleIdleCheck(message);

      case "check-execution-time":
        return this.handleExecutionTimeCheck(message);

      case "suggest-task":
        return this.handleTaskSuggestion(message);

      case "task-status-update":
        return this.handleTaskStatusUpdate(message);

      case "chat":
        return this.handleChat(message);

      default:
        return this.createResponse(
          message.from,
          "error",
          { error: `Unknown message type: ${message.type}` },
          message.id
        );
    }
  }

  private handleCheckTasks(message: ActorMessage): ActorResponse {
    const tasks = (message.payload as { tasks?: string[] })?.tasks || [];
    
    // Schedule tasks
    const scheduledTasks = tasks.map((task, index) => ({
      task,
      scheduledAt: new Date(Date.now() + (index + 1) * 1000), // Schedule every 1 second
      priority: index === 0 ? "high" : "normal",
    }));

    return this.createResponse(
      message.from,
      "task-scheduled",
      { scheduledTasks },
      message.id
    );
  }

  private handleIdleCheck(message: ActorMessage): ActorResponse | null {
    const payload = message.payload as {
      lastActivityTime?: Date;
      timeout?: number;
    };

    const lastActivityTime = payload.lastActivityTime || new Date();
    const timeout = payload.timeout || this.idleTimeout;
    const timeSinceLastActivity = Date.now() - new Date(lastActivityTime).getTime();

    if (timeSinceLastActivity > timeout) {
      // Idle timeout exceeded
      return this.createResponse(
        message.from,
        "trigger-next-task",
        { 
          reason: "idle-timeout",
          idleTime: timeSinceLastActivity,
        },
        message.id
      );
    }

    return null;
  }

  private handleExecutionTimeCheck(message: ActorMessage): ActorResponse {
    const payload = message.payload as {
      startTime?: Date;
      maxExecutionTime?: number;
    };

    const startTime = payload.startTime || this.startTime;
    const maxTime = payload.maxExecutionTime || this.maxExecutionTime;
    const executionTime = Date.now() - new Date(startTime).getTime();

    if (executionTime > maxTime) {
      return this.createResponse(
        message.from,
        "execution-time-exceeded",
        { shouldStop: true },
        message.id
      );
    }

    return this.createResponse(
      message.from,
      "execution-time-ok",
      { 
        remainingTime: maxTime - executionTime,
        shouldStop: false,
      },
      message.id
    );
  }

  private handleTaskSuggestion(message: ActorMessage): ActorResponse {
    const payload = message.payload as {
      currentTasks?: string[];
      context?: string;
    };

    const context = payload.context || "";
    const suggestions: string[] = [];

    // Suggest tasks based on context
    if (context.includes("initial setup") || context.includes("setup")) {
      suggestions.push("Install project dependencies");
      suggestions.push("Verify environment variable settings");
      suggestions.push("Update README file");
    } else if (context.includes("test") || context.includes("testing")) {
      suggestions.push("Run unit tests");
      suggestions.push("Generate coverage report");
      suggestions.push("Create integration tests");
    } else {
      // Default suggestions
      suggestions.push("Check TODO.md for next tasks");
      suggestions.push("Conduct code review");
      suggestions.push("Update documentation");
    }

    return this.createResponse(
      message.from,
      "task-suggestion",
      { suggestions },
      message.id
    );
  }

  private handleTaskStatusUpdate(message: ActorMessage): ActorResponse {
    // Confirm task status update
    return this.createResponse(
      message.from,
      "task-acknowledged",
      { 
        message: "Task status confirmed.",
        nextAction: "continue-monitoring",
      },
      message.id
    );
  }

  private handleChat(message: ActorMessage): ActorResponse {
    const text = (message.payload as { text?: string })?.text || "";
    
    // Simple logic for auto-response
    let responseText = "";
    
    if (text.includes("task") || text.includes("progress")) {
      responseText = "Checking current tasks. Please wait a moment...";
    } else if (text.includes("break") || text.includes("stop")) {
      responseText = "Understood. Pausing automatic execution.";
    } else {
      responseText = "Auto-response: Message received. Continuing task monitoring.";
    }

    return this.createResponse(
      message.from,
      "chat-response",
      { text: responseText },
      message.id
    );
  }
}