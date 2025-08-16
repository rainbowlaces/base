import { describe, it } from "node:test";
import assert from "node:assert";
import { BaseHttpContext } from "../../../src/core/requestHandler/httpContext.js";
import { BaseWebSocketContext } from "../../../src/core/requestHandler/websocketContext.js";
import { WebSocket } from "ws";
import type * as http from "http";
import type { Duplex } from "stream";
import { type WebSocketServer } from "ws";

describe("WebSocket Data Handoff", () => {
  it("should properly transfer data from HTTP context to WebSocket context", () => {
    // Create mock objects
    const mockRequest = {
      url: "/chat/secure",
      method: "GET",
      headers: { host: "localhost" }
    } as http.IncomingMessage;

    const mockSocket = {
      destroy: () => { /* noop */ }
    } as unknown as Duplex;

    const mockHead = Buffer.from("mock-head");
    
    const mockWSS = {
      handleUpgrade: (_req: any, _socket: any, _head: any, callback: any) => {
        const mockWS = {
          readyState: WebSocket.OPEN,
          send: () => { /* noop */ },
          on: () => { /* noop */ }
        } as any;
        callback(mockWS);
      }
    } as unknown as WebSocketServer;

    // Create upgradable HTTP context
    const httpContext = new BaseHttpContext(mockRequest, undefined, mockSocket, mockHead, mockWSS);
    
    // Simulate middleware setting user data (like authentication)
    (httpContext.data as any).user = { id: 123, name: "TestUser" };
    (httpContext.data as any).sessionId = "abc123";
    (httpContext.data as any).permissions = ["read", "write"];

    // Verify data is set on HTTP context
    assert.strictEqual((httpContext.data as any).user.id, 123);
    assert.strictEqual((httpContext.data as any).sessionId, "abc123");
    assert.deepStrictEqual((httpContext.data as any).permissions, ["read", "write"]);

    // Create a mock WebSocket and WebSocket context
    const mockWS = {
      readyState: WebSocket.OPEN,
      send: () => { /* noop */ },
      on: () => { /* noop */ }
    } as any;

    const wsContext = new BaseWebSocketContext(mockWS, httpContext);

    // Verify data was properly transferred to WebSocket context
    assert.strictEqual((wsContext.data as any).user.id, 123, "User ID should be transferred");
    assert.strictEqual((wsContext.data as any).sessionId, "abc123", "Session ID should be transferred");
    assert.deepStrictEqual((wsContext.data as any).permissions, ["read", "write"], "Permissions should be transferred");

    // Verify they share the same object reference for efficiency (per Bob's feedback)
    assert.strictEqual(wsContext.data, httpContext.data, "Data objects should share the same reference for efficiency");

    // Since they share the same object, modifying one affects the other
    // This is expected behavior since HTTP context becomes inert after promotion
    (wsContext.data as any).wsSpecificData = "websocket-only";
    assert.strictEqual((wsContext.data as any).wsSpecificData, "websocket-only");
    assert.strictEqual((httpContext.data as any).wsSpecificData, "websocket-only", "Both contexts share the same data object");
  });
});
