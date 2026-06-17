import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { HookEvent, HookEventName } from "@game-panel/protocol";

/**
 * The internal hook bus. Core services emit typed lifecycle events here; the
 * addon runtime (Phase 5) subscribes and dispatches to sandboxed addons. Built
 * now so the core is event-driven from the start. In-memory for a single API
 * instance — moves to Redis pub/sub when we scale horizontally.
 */
@Injectable()
export class HookBus {
  private readonly logger = new Logger(HookBus.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<P>(name: HookEventName, orgId: string, payload: P): void {
    const event: HookEvent<P> = { name, orgId, at: new Date().toISOString(), payload };
    this.logger.debug(`event ${name} org=${orgId}`);
    this.emitter.emit(name, event);
    this.emitter.emit("*", event);
  }

  on(name: HookEventName | "*", handler: (event: HookEvent) => void): void {
    this.emitter.on(name, handler);
  }
}
