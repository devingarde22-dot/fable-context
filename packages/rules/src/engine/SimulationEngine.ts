import { TickClock } from "../clock/TickClock.js";
import { EventJournal } from "../journal/EventJournal.js";
import { stateHash } from "../replay/stateHash.js";
import { replayEvents, replayJournalRecords } from "../replay/replay.js";
import { closedWindowIdAtTick, windowIdAtTick } from "../scheduler/InputWindow.js";
import { orderCommands, phaseOrder, type SchedulerPhase } from "../scheduler/orderCommands.js";
import { validateMove } from "../movement/playerMove.js";
import { cellIndex } from "../grid/Grid.js";
import { activateScene, resolveDueIntents } from "../intents/intentSystem.js";
import { groupEvents, type PendingJournalEvent } from "../intents/events.js";
import { assertRuntimeInvariants } from "./invariants.js";
import { cloneRuntimeState, createRuntimeState, snapshotState } from "./createRuntimeState.js";
import type {
  DomainEvent,
  EngineErrorCode,
  FinalCommandResult,
  InternalCommand,
  JournalRecord,
  RuntimeSnapshot,
  RuntimeState,
  SimulationEngineConfig,
  SubmitResult,
  TickResult,
} from "./types.js";

export interface SimulationEngine {
  readonly state: Readonly<RuntimeState>;
  submit(command: InternalCommand): SubmitResult;
  advanceOneTick(): TickResult;
  advanceTicks(count: number): TickResult[];
  snapshot(): RuntimeSnapshot;
  events(): readonly DomainEvent[];
  journalRecords(): readonly JournalRecord[];
  replay(events: readonly DomainEvent[]): RuntimeSnapshot;
  replayJournal(): RuntimeSnapshot;
}

export type SimulationEngineOptions = {
  onPhase?: (phase: SchedulerPhase, tick: number) => void;
};

type AppliedMove = {
  result: FinalCommandResult;
  pendingEvent?: PendingJournalEvent;
};

export class HeadlessSimulationEngine implements SimulationEngine {
  private runtime: RuntimeState;
  private readonly initialState: RuntimeState;
  private readonly clock: TickClock;
  private readonly journal = new EventJournal();
  private readonly requestResults = new Map<string, SubmitResult>();
  private readonly options: SimulationEngineOptions;

  constructor(config: SimulationEngineConfig, options: SimulationEngineOptions = {}) {
    this.runtime = createRuntimeState(config);
    this.initialState = cloneRuntimeState(this.runtime);
    this.clock = new TickClock(this.runtime.serverTick);
    this.options = options;

    const initialPending = activateScene(this.runtime);
    const initialBatch = groupEvents(this.runtime, initialPending);
    this.journal.appendBatch(initialBatch.events, initialBatch.auditByEventId);
    this.journal.appendTick(this.runtime.serverTick, this.runtime.sceneRevision, this.runtime.scene.inputWindow);
    assertRuntimeInvariants(this.runtime);
  }

  get state(): Readonly<RuntimeState> {
    return cloneRuntimeState(this.runtime);
  }

  submit(command: InternalCommand): SubmitResult {
    const previous = this.requestResults.get(command.requestId);
    if (previous) return { status: "duplicate", requestId: command.requestId, original: previous };

    const rejected = (code: EngineErrorCode): SubmitResult => {
      const result: SubmitResult = { status: "rejected", requestId: command.requestId, code, sceneRevision: this.runtime.sceneRevision };
      if (typeof command?.requestId === "string" && command.requestId.length > 0) this.requestResults.set(command.requestId, result);
      return result;
    };

    if (!this.isValidCommand(command)) return rejected("SCHEMA_INVALID");
    if (this.runtime.phase !== "active" || command.role !== "player" || command.sessionId !== this.runtime.sessionId) return rejected("AUTH_FORBIDDEN");
    const heroId = this.runtime.heroIdByActorId.get(command.actorId);
    const hero = heroId ? this.runtime.entities.get(heroId) : undefined;
    if (!hero || hero.kind !== "hero" || hero.aliveState !== "active") return rejected("AUTH_FORBIDDEN");
    if (command.clientRevision !== this.runtime.sceneRevision) return rejected("STALE_SCENE_REVISION");
    if (hero.mode !== "movement") return rejected("INVALID_MODE");

    const windowId = windowIdAtTick(this.runtime.serverTick);
    if (this.runtime.scene.inputWindow.windowId !== windowId) {
      this.runtime.scene.inputWindow = { windowId, commands: [] };
    }
    this.runtime.scene.inputWindow.commands.push(cloneCommand(command));
    this.journal.appendInputWindow(this.runtime.serverTick, this.runtime.scene.inputWindow);
    const result: SubmitResult = { status: "queued", requestId: command.requestId, windowId };
    this.requestResults.set(command.requestId, result);
    return result;
  }

  advanceOneTick(): TickResult {
    const commandsInOpenWindow = this.runtime.scene.inputWindow.commands;
    this.runtime.serverTick = this.clock.advance();
    const closedWindowId = closedWindowIdAtTick(this.runtime.serverTick);
    const pending: PendingJournalEvent[] = [];
    const commandResults: FinalCommandResult[] = [];
    const orderedCommands = closedWindowId === null ? [] : orderCommands(commandsInOpenWindow);
    const reservations = new Set<number>();

    if (closedWindowId !== null) {
      this.runtime.scene.inputWindow = { windowId: windowIdAtTick(this.runtime.serverTick), commands: [] };
    }

    for (const phase of phaseOrder()) {
      this.options.onPhase?.(phase, this.runtime.serverTick);
      if (phase === "players" && closedWindowId !== null) {
        for (const command of orderedCommands) {
          const applied = this.applyMove(command, reservations);
          commandResults.push(applied.result);
          if (!applied.pendingEvent) continue;
          pending.push(applied.pendingEvent);
          if (applied.pendingEvent.event.eventType === "scene.entity_moved") {
            reservations.add(cellIndex(applied.pendingEvent.event.payload.to));
          }
        }
      } else if (phase === "enemies") {
        pending.push(...resolveDueIntents(this.runtime, this.runtime.serverTick));
      }
      // Environment has no active effects in this increment; its phase remains explicit and ordered.
    }

    const committed = groupEvents(this.runtime, pending);
    this.journal.appendBatch(committed.events, committed.auditByEventId);
    this.journal.appendTick(this.runtime.serverTick, this.runtime.sceneRevision, this.runtime.scene.inputWindow);

    for (const result of commandResults) {
      if (result.status !== "accepted") continue;
      const requestEvent = committed.events.find((event) => event.causedByRequestId === result.requestId);
      if (requestEvent) {
        result.eventIds = [requestEvent.eventId];
        result.sceneRevision = requestEvent.sceneRevision;
      }
    }

    assertRuntimeInvariants(this.runtime);
    return {
      serverTick: this.runtime.serverTick,
      closedWindowId,
      events: committed.events.map((event) => structuredClone(event)),
      commandResults,
      sceneRevision: this.runtime.sceneRevision,
      stateHash: stateHash(this.runtime),
    };
  }

  advanceTicks(count: number): TickResult[] {
    if (!Number.isInteger(count) || count < 0) throw new RangeError("count must be a non-negative integer");
    const results: TickResult[] = [];
    for (let index = 0; index < count; index += 1) results.push(this.advanceOneTick());
    return results;
  }

  snapshot(): RuntimeSnapshot {
    return snapshotState(this.runtime);
  }

  events(): readonly DomainEvent[] {
    return this.journal.events();
  }

  journalRecords(): readonly JournalRecord[] {
    return this.journal.records();
  }

  replay(events: readonly DomainEvent[]): RuntimeSnapshot {
    return replayEvents(this.initialState, events);
  }

  replayJournal(): RuntimeSnapshot {
    return replayJournalRecords(this.initialState, this.journal.records());
  }

  private applyMove(command: InternalCommand, reservations: ReadonlySet<number>): AppliedMove {
    const heroId = this.runtime.heroIdByActorId.get(command.actorId);
    const hero = heroId ? this.runtime.entities.get(heroId) : undefined;
    const reject = (code: EngineErrorCode): AppliedMove => ({
      result: { requestId: command.requestId, status: "rejected", code, sceneRevision: this.runtime.sceneRevision },
    });
    if (!hero || hero.kind !== "hero" || hero.aliveState !== "active") return reject("AUTH_FORBIDDEN");
    if (command.clientRevision !== this.runtime.sceneRevision) return reject("STALE_SCENE_REVISION");
    if (hero.mode !== "movement") return reject("INVALID_MODE");

    const validated = validateMove(this.runtime.scene.cells, hero.position, command.payload.direction, reservations);
    if (!validated.ok) return reject(validated.code);
    const from = { ...hero.position };
    const fromCell = this.runtime.scene.cells[validated.fromIndex];
    const toCell = this.runtime.scene.cells[validated.toIndex];
    if (!fromCell || !toCell || fromCell.occupantId !== hero.id || toCell.occupantId !== null) return reject("INVALID_STATE");

    fromCell.occupantId = null;
    toCell.occupantId = hero.id;
    hero.position = { ...validated.destination };
    return {
      result: { requestId: command.requestId, status: "accepted", eventIds: [], sceneRevision: this.runtime.sceneRevision + 1 },
      pendingEvent: {
        event: {
          protocolVersion: "fable.protocol.v1",
          schemaVersion: 1,
          eventType: "scene.entity_moved",
          eventVersion: 1,
          campaignId: this.runtime.campaignId,
          sessionId: this.runtime.sessionId,
          sceneId: this.runtime.scene.id,
          serverTick: this.runtime.serverTick,
          causedByRequestId: command.requestId,
          actorId: command.actorId,
          replay: null,
          payload: { entityId: hero.id, from, to: { ...validated.destination } },
        },
      },
    };
  }

  private isValidCommand(command: InternalCommand): boolean {
    if (!command || typeof command !== "object") return false;
    if (typeof command.requestId !== "string" || command.requestId.length === 0 ||
      typeof command.sessionId !== "string" || typeof command.actorId !== "string") return false;
    if (command.command !== "player.move" || command.role !== "player" ||
      !["up", "down", "left", "right"].includes(command.payload?.direction)) return false;
    if (!Number.isInteger(command.clientRevision) || command.clientRevision < 0 ||
      !Number.isInteger(command.serverReceiveSequence) || command.serverReceiveSequence < 0) return false;
    const keys = Object.keys(command as unknown as Record<string, unknown>).sort();
    return keys.join(",") === ["actorId", "clientRevision", "command", "payload", "requestId", "role", "serverReceiveSequence", "sessionId"].sort().join(",") &&
      Object.keys(command.payload).sort().join(",") === "direction";
  }
}

export function createSimulationEngine(config: SimulationEngineConfig, options?: SimulationEngineOptions): SimulationEngine {
  return new HeadlessSimulationEngine(config, options);
}

function cloneCommand(command: InternalCommand): InternalCommand {
  return { ...command, payload: { ...command.payload } };
}
