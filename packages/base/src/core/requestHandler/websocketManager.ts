import { registerDi } from "../di/decorators/registerDi.js";
import type { BaseWebSocketContext } from "./websocketContext.js";
import type { BaseLogger } from "../logger/baseLogger.js";
import { BaseDi } from "../di/baseDi.js";

/**
 * Manages WebSocket connections for broadcasting and connection tracking
 * Singleton service that maintains a registry of active WebSocket contexts grouped by their connection path
 */
@registerDi({ singleton: true, teardown: true })
export class BaseWebSocketManager {
  private logger: BaseLogger;

  /**
   * Map of connection paths to sets of active WebSocket contexts
   * Key: exact connection path (e.g., "/chat/123")
   * Value: Set of BaseWebSocketContext instances connected to that path
   */
  private connectionsByPath: Map<string, Set<BaseWebSocketContext>> = new Map();

  constructor() {
    this.logger = BaseDi.resolve("BaseLogger");
  }

  /**
   * Register a new WebSocket context
   * Called automatically by BaseWebSocketContext constructor
   * @param context - The WebSocket context to register
   */
  register(context: BaseWebSocketContext): void {
    const path = context.path;
    
    if (!this.connectionsByPath.has(path)) {
      this.connectionsByPath.set(path, new Set());
    }
    
    this.connectionsByPath.get(path)!.add(context);
    this.logger.debug(`WebSocket context registered`, [context.id], { 
      path, 
      totalConnections: this.connectionsByPath.get(path)!.size 
    });
  }

  /**
   * Unregister a WebSocket context
   * Called automatically by BaseWebSocketContext on close/destroy
   * @param context - The WebSocket context to unregister
   */
  unregister(context: BaseWebSocketContext): void {
    const path = context.path;
    const connections = this.connectionsByPath.get(path);
    
    if (connections) {
      connections.delete(context);
      this.logger.debug(`WebSocket context unregistered`, [context.id], { 
        path, 
        remainingConnections: connections.size 
      });
      
      // Clean up empty sets
      if (connections.size === 0) {
        this.connectionsByPath.delete(path);
        this.logger.debug(`Removed empty connection set for path`, [], { path });
      }
    }
  }

  /**
   * Broadcast data to all WebSocket contexts matching a path pattern
   * Uses URLPattern for flexible path matching (e.g., "/chat/*" matches "/chat/123", "/chat/456")
   * 
   * @param pathPattern - URLPattern-compatible pathname pattern (e.g., "/chat/:id", "/chat/*")
   * @param data - Data to send (will be JSON stringified)
   * @param options - Optional configuration
   * @param options.exclude - Single context or array of contexts to exclude from broadcast
   * 
   * @example
   * // Broadcast to all connections in any chat room
   * manager.broadcast("/chat/*", { type: "announcement", text: "Server maintenance in 5 minutes" });
   * 
   * @example
   * // Broadcast to specific chat room, excluding sender
   * manager.broadcast("/chat/123", { type: "message", text: "Hello!" }, { exclude: senderContext });
   */
  broadcast(
    pathPattern: string, 
    data: unknown, 
    options?: { exclude?: BaseWebSocketContext | BaseWebSocketContext[] }
  ): void {
    const pattern = new URLPattern({ pathname: pathPattern });
    const excludeSet = new Set<BaseWebSocketContext>();
    
    // Build exclusion set
    if (options?.exclude) {
      if (Array.isArray(options.exclude)) {
        options.exclude.forEach(ctx => excludeSet.add(ctx));
      } else {
        excludeSet.add(options.exclude);
      }
    }

    let matchedPaths = 0;
    let sentCount = 0;
    let excludedCount = 0;

    // Iterate through all connection paths
    for (const [connectionPath, contexts] of this.connectionsByPath.entries()) {
      // Test if this path matches the pattern
      if (pattern.test({ pathname: connectionPath })) {
        matchedPaths++;
        
        // Send to all contexts on this path
        for (const context of contexts) {
          if (excludeSet.has(context)) {
            excludedCount++;
            continue;
          }
          
          context.send(data as object);
          sentCount++;
        }
      }
    }

    this.logger.debug(`Broadcast completed`, [], { 
      pathPattern, 
      matchedPaths, 
      sentCount, 
      excludedCount 
    });
  }

  /**
   * Get count of active connections for a specific path or pattern
   * @param pathPattern - URLPattern-compatible pathname pattern
   * @returns Total number of active connections matching the pattern
   */
  getConnectionCount(pathPattern?: string): number {
    if (!pathPattern) {
      // Count all connections
      let total = 0;
      for (const contexts of this.connectionsByPath.values()) {
        total += contexts.size;
      }
      return total;
    }

    const pattern = new URLPattern({ pathname: pathPattern });
    let count = 0;

    for (const [connectionPath, contexts] of this.connectionsByPath.entries()) {
      if (pattern.test({ pathname: connectionPath })) {
        count += contexts.size;
      }
    }

    return count;
  }

  /**
   * Cleanup method called during DI container teardown
   */
  teardown(): void {
    this.logger.debug(`WebSocket manager teardown`, [], { 
      totalPaths: this.connectionsByPath.size,
      totalConnections: this.getConnectionCount()
    });
    this.connectionsByPath.clear();
  }
}
