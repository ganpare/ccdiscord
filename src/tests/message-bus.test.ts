import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { ActorMessage } from "../types.ts";
import { DebugActor } from "../actors/debug-actor.ts";
import { AutoResponderActor } from "../actors/auto-responder-actor.ts";
import { SimpleMessageBus } from "../message-bus.ts";

// MessageBus tests
Deno.test("MessageBus", async (t) => {
  await t.step("should register and send messages to actors", async () => {
    const bus = new SimpleMessageBus();
    
    const debugActor = new DebugActor("debug1");
    bus.register(debugActor);
    
    const message: ActorMessage = {
      id: "bus-1",
      from: "test",
      to: "debug1",
      type: "echo",
      payload: { text: "Hello Bus!" },
      timestamp: new Date(),
    };
    
    const response = await bus.send(message);
    assertExists(response);
    assertEquals(response?.type, "echo-response");
  });

  await t.step("should broadcast messages to multiple actors", async () => {
    const bus = new SimpleMessageBus();
    
    const actor1 = new DebugActor("debug1");
    const actor2 = new DebugActor("debug2");
    bus.register(actor1);
    bus.register(actor2);
    
    const message: ActorMessage = {
      id: "broadcast-1",
      from: "test",
      to: "*", // broadcast to all
      type: "echo",
      payload: { text: "Broadcast message" },
      timestamp: new Date(),
    };
    
    const responses = await bus.broadcast(message);
    assertEquals(responses.length, 2);
    responses.forEach(response => {
      assertEquals(response.type, "echo-response");
    });
  });

  await t.step("should handle complex conversation flow", async () => {
    const bus = new SimpleMessageBus();
    
    const debugActor = new DebugActor("debug");
    const autoActor = new AutoResponderActor("auto");
    bus.register(debugActor);
    bus.register(autoActor);
    
    // AutoResponder queries DebugActor for tasks
    const taskQuery: ActorMessage = {
      id: "flow-1",
      from: "auto",
      to: "debug",
      type: "chat",
      payload: { text: "タスクの進捗を教えてください" },
      timestamp: new Date(),
    };
    
    const debugResponse = await bus.send(taskQuery);
    assertExists(debugResponse);
    
    // AutoResponder processes DebugActor's response
    const statusUpdate: ActorMessage = {
      id: "flow-2",
      from: "debug",
      to: "auto",
      type: "task-status-update",
      payload: debugResponse?.payload,
      timestamp: new Date(),
    };
    
    const autoResponse = await bus.send(statusUpdate);
    assertExists(autoResponse);
    assertEquals(autoResponse?.type, "task-acknowledged");
  });

  await t.step("should unregister actors", async () => {
    const bus = new SimpleMessageBus();
    
    const actor = new DebugActor("debug1");
    bus.register(actor);
    bus.unregister("debug1");
    
    const message: ActorMessage = {
      id: "unreg-1",
      from: "test",
      to: "debug1",
      type: "echo",
      payload: { text: "Should not receive" },
      timestamp: new Date(),
    };
    
    const response = await bus.send(message);
    assertEquals(response, null);
  });
});