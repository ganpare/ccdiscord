import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { SimpleMessageBus } from "../message-bus.ts";
import { DebugActor } from "../actors/debug-actor.ts";
import { AutoResponderActor } from "../actors/auto-responder-actor.ts";
import type { ActorMessage } from "../types.ts";

// Integration test: Verify actors can communicate in debug mode
Deno.test("Integration: Debug Mode Conversation", async (t) => {
  await t.step("should simulate full conversation flow without ClaudeCode", async () => {
    const bus = new SimpleMessageBus();
    
    // Register 3 actors
    const user = new DebugActor("user");
    const autoResponder = new AutoResponderActor("auto-responder");
    const assistant = new DebugActor("assistant");
    
    bus.register(user);
    bus.register(autoResponder);
    bus.register(assistant);
    
    await bus.startAll();
    
    // Record conversation log
    const conversationLog: Array<{ from: string; to: string; type: string; text?: string }> = [];
    
    // User asks a question
    const userQuestion: ActorMessage = {
      id: "conv-1",
      from: "user",
      to: "assistant",
      type: "chat",
      payload: { text: "現在のタスクの進捗はどうですか？" },
      timestamp: new Date(),
    };
    
    const assistantResponse = await bus.send(userQuestion);
    assertExists(assistantResponse);
    conversationLog.push({
      from: userQuestion.from,
      to: userQuestion.to,
      type: userQuestion.type,
      text: (userQuestion.payload as { text?: string })?.text,
    });
    conversationLog.push({
      from: assistantResponse.from,
      to: assistantResponse.to,
      type: assistantResponse.type,
      text: (assistantResponse.payload as { text?: string })?.text,
    });
    
    // AutoResponder performs idle check
    const idleCheck: ActorMessage = {
      id: "idle-1",
      from: "auto-responder",
      to: "auto-responder",
      type: "idle-check",
      payload: {
        lastActivityTime: new Date(Date.now() - 6 * 60 * 1000),
        timeout: 5 * 60 * 1000,
      },
      timestamp: new Date(),
    };
    
    const idleResponse = await bus.send(idleCheck);
    assertExists(idleResponse);
    assertEquals(idleResponse.type, "trigger-next-task");
    
    // AutoResponder suggests next task
    const taskSuggestion: ActorMessage = {
      id: "suggest-1",
      from: "auto-responder",
      to: "assistant",
      type: "suggest-task",
      payload: {
        context: "アイドルタイムアウト後",
        currentTasks: [],
      },
      timestamp: new Date(),
    };
    
    const suggestionResponse = await bus.send(taskSuggestion);
    assertExists(suggestionResponse);
    
    // Verify conversation log
    console.log("\n=== Conversation Log ===");
    conversationLog.forEach((log, index) => {
      console.log(`${index + 1}. ${log.from} → ${log.to}: ${log.text || log.type}`);
    });
    
    await bus.stopAll();
  });

  await t.step("should handle broadcast messages in debug mode", async () => {
    const bus = new SimpleMessageBus();
    
    // Create multiple DebugActors
    const actors = [
      new DebugActor("actor1"),
      new DebugActor("actor2"),
      new DebugActor("actor3"),
    ];
    
    actors.forEach(actor => bus.register(actor));
    
    // Send broadcast message
    const broadcast: ActorMessage = {
      id: "broadcast-1",
      from: "system",
      to: "*",
      type: "random",
      payload: {},
      timestamp: new Date(),
    };
    
    const responses = await bus.broadcast(broadcast);
    assertEquals(responses.length, 3);
    
    // Verify all actors responded
    responses.forEach((response, index) => {
      assertExists(response);
      assertEquals(response.type, "random-response");
      console.log(`Actor ${index + 1} responded: ${(response.payload as { text?: string })?.text}`);
    });
  });

  await t.step("should simulate Never Sleep mode with debug actors", async () => {
    const bus = new SimpleMessageBus();
    
    const autoResponder = new AutoResponderActor("auto");
    const debugAssistant = new DebugActor("debug-assistant");
    
    bus.register(autoResponder);
    bus.register(debugAssistant);
    
    // Never Sleep mode simulation
    let executionCount = 0;
    const maxExecutions = 3;
    
    while (executionCount < maxExecutions) {
      // Task check
      const checkTasks: ActorMessage = {
        id: `task-check-${executionCount}`,
        from: "auto",
        to: "debug-assistant",
        type: "chat",
        payload: { text: "Check TODO.md to continue" },
        timestamp: new Date(),
      };
      
      const response = await bus.send(checkTasks);
      assertExists(response);
      
      console.log(`Execution ${executionCount + 1}: ${(response.payload as { text?: string })?.text}`);
      
      // Small delay (simulating actual Never Sleep mode)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      executionCount++;
    }
    
    assertEquals(executionCount, maxExecutions);
  });
});