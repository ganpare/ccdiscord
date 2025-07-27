import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { ActorMessage } from "../types.ts";
import { DebugActor } from "../actors/debug-actor.ts";

// DebugActor tests
Deno.test("DebugActor", async (t) => {
  await t.step("should echo messages when type is 'echo'", async () => {
    const actor = new DebugActor();
    
    const message: ActorMessage = {
      id: "test-1",
      from: "test",
      to: "debug",
      type: "echo",
      payload: { text: "Hello, World!" },
      timestamp: new Date(),
    };

    const response = await actor.handleMessage(message);
    assertExists(response);
    assertEquals(response?.type, "echo-response");
    assertEquals(response?.payload, { text: "Hello, World!" });
  });

  await t.step("should return predefined responses for 'random' type", async () => {
    const actor = new DebugActor();
    
    const message: ActorMessage = {
      id: "test-2",
      from: "test",
      to: "debug",
      type: "random",
      payload: {},
      timestamp: new Date(),
    };

    const response = await actor.handleMessage(message);
    assertExists(response);
    assertEquals(response?.type, "random-response");
    assertExists(response?.payload);
  });

  await t.step("should simulate thinking delay", async () => {
    const actor = new DebugActor();
    
    const message: ActorMessage = {
      id: "test-3",
      from: "test",
      to: "debug",
      type: "think",
      payload: { duration: 100 }, // 100ms delay
      timestamp: new Date(),
    };

    const start = Date.now();
    const response = await actor.handleMessage(message);
    const end = Date.now();
    
    assertExists(response);
    assertEquals(response?.type, "think-response");
    assert(end - start >= 100, "Should delay at least 100ms");
  });

  await t.step("should handle conversation between two debug actors", async () => {
    const actor1 = new DebugActor("debug1");
    const actor2 = new DebugActor("debug2");
    
    // Actor1 sends message to Actor2
    const message1: ActorMessage = {
      id: "conv-1",
      from: "debug1",
      to: "debug2",
      type: "chat",
      payload: { text: "こんにちは！" },
      timestamp: new Date(),
    };

    const response1 = await actor2.handleMessage(message1);
    assertExists(response1);
    assertEquals(response1?.from, "debug2");
    assertEquals(response1?.to, "debug1");
    assertEquals(response1?.type, "chat-response");
    
    // Actor1 receives response from Actor2
    const message2: ActorMessage = {
      ...response1!,
      from: response1!.from,
      to: response1!.to,
      type: "chat",
    };
    
    const response2 = await actor1.handleMessage(message2);
    assertExists(response2);
    assertEquals(response2?.from, "debug1");
    assertEquals(response2?.to, "debug2");
  });
});