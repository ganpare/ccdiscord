import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { ActorMessage } from "../types.ts";
import { AutoResponderActor } from "../actors/auto-responder-actor.ts";
import { DebugActor } from "../actors/debug-actor.ts";

// AutoResponderActor tests
Deno.test("AutoResponderActor", async (t) => {
  await t.step("should schedule periodic tasks", async () => {
    const actor = new AutoResponderActor();
    
    // Mock task list
    const mockTasks = [
      "TODO.mdを確認する",
      "進行中のタスクを完了する",
      "新しいタスクを探す",
    ];

    // Test message
    const message: ActorMessage = {
      id: "auto-1",
      from: "scheduler",
      to: "auto-responder",
      type: "check-tasks",
      payload: { tasks: mockTasks },
      timestamp: new Date(),
    };

    const response = await actor.handleMessage(message);
    assertExists(response);
    assertEquals(response?.type, "task-scheduled");
    assertExists(response?.payload);
  });

  await t.step("should handle idle timeout", async () => {
    const actor = new AutoResponderActor();
    
    const message: ActorMessage = {
      id: "auto-2",
      from: "timer",
      to: "auto-responder",
      type: "idle-check",
      payload: { 
        lastActivityTime: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
        timeout: 5 * 60 * 1000, // 5 minute timeout
      },
      timestamp: new Date(),
    };

    const response = await actor.handleMessage(message);
    assertExists(response);
    assertEquals(response?.type, "trigger-next-task");
  });

  await t.step("should respect max execution time", async () => {
    const actor = new AutoResponderActor();
    const startTime = new Date(Date.now() - 7 * 60 * 60 * 1000); // 7 hours ago
    
    const message: ActorMessage = {
      id: "auto-3",
      from: "timer",
      to: "auto-responder",
      type: "check-execution-time",
      payload: { 
        startTime,
        maxExecutionTime: 6 * 60 * 60 * 1000, // 6 hours
      },
      timestamp: new Date(),
    };

    const response = await actor.handleMessage(message);
    assertExists(response);
    assertEquals(response?.type, "execution-time-exceeded");
    assertEquals(response?.payload, { shouldStop: true });
  });

  await t.step("should generate task suggestions", async () => {
    const actor = new AutoResponderActor();
    
    const message: ActorMessage = {
      id: "auto-4",
      from: "user",
      to: "auto-responder",
      type: "suggest-task",
      payload: { 
        currentTasks: [],
        context: "プロジェクトの初期セットアップ",
      },
      timestamp: new Date(),
    };

    const response = await actor.handleMessage(message);
    assertExists(response);
    assertEquals(response?.type, "task-suggestion");
    const suggestions = response?.payload as { suggestions: string[] };
    assert(suggestions.suggestions.length > 0, "Should suggest at least one task");
  });

  await t.step("should handle conversation between auto-responder and debug actor", async () => {
    const autoActor = new AutoResponderActor();
    const debugActor = new DebugActor();
    
    // AutoResponder sends task check message
    const taskCheckMessage: ActorMessage = {
      id: "conv-auto-1",
      from: "auto-responder",
      to: "debug",
      type: "chat",
      payload: { text: "現在のタスクの進捗はどうですか？" },
      timestamp: new Date(),
    };

    const debugResponse = await debugActor.handleMessage(taskCheckMessage);
    assertExists(debugResponse);
    
    // AutoResponder processes DebugActor's response
    const autoResponse = await autoActor.handleMessage({
      ...debugResponse!,
      type: "task-status-update",
    });
    assertExists(autoResponse);
    assertEquals(autoResponse?.type, "task-acknowledged");
  });
});