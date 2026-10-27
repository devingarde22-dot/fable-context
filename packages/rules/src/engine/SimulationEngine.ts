import { TickClock } from "../clock/TickClock.js";
import { EventJournal } from "../journal/EventJournal.js";
import { stateHash } from "../replay/stateHash.js";
import { replayEvents } from "../replay/replay.js";
import { closedWindowIdAtTick, windowIdAtTick } from "../scheduler/InputWindow.js";
import { orderCommands, phaseOrder, type SchedulerPhase } from "../scheduler/orderCommands.js";
import { validateMove } from "../movement/playerMove.js";
import { cellIndex } from "../grid/Grid.js";
import { assertRuntimeInvariants } from "./invariants.js";
import { cloneRuntimeState, createRuntimeState, snapshotState } from "./createRuntimeState.js";
import type {
  DomainEvent,
  EngineErrorCode,
  FinalCommandResult,
  InternalCommand,
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
  replay(events: readonly DomainEvent[]): RuntimeSnapshot;
}

export type SimulationEngineOptions = {
  onPhase?: (phase: SchedulerPhase, tick: number) => void;
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
  }

  get state(): Readonly<RuntimeState> {
    return cloneRuntimeState(this.runtime);
  }

  submit(command: InternalCommand): SubmitResult {
    const previous = this.requestResults.get(command.requestId);
    if (previous) return { status: "duplicate", requestId: command.requestId, original: previous };

    const rejected = (code: EngineErrorCode): SubmitResult => {
      const result: SubmitResult = { status: "rejected", requestId: command.requestId, code, sceneRevision: this.runtime.sceneRevision };
      if (command.requestId) this.requestResults.set(command.requestId, result);
      return result;
    };

    if (!this.isValidCommand(command)) return rejected("SCHEMA_INVALID");
    if (command.role !== "player" || command.sessionId !== this.runtime.sessionId) return rejected("AUTH_FORBIDDEN");
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
    const result: SubmitResult = { status: "queued", requestId: command.requestId, windowId };
    this.requestResults.set(command.requestId, result);
    return result;
  }

  advanceOneTick(): TickResult {
    const previousWindowCommands = this.runtime.scene.inputWindow.commands;
    this.runtime.serverTick = this.clock.advance();
    const closedWindowId = closedWindowIdAtTick(this.runtime.serverTick);
    const emitted: DomainEvent[] = [];
    const commandResults: FinalCommandResult[] = [];

    if (closedWindowId !== null) {
      const commands = previousWindowCommands;
      this.runtime.scene.inputWindow = { windowId: windowIdAtTick(this.runtime.serverTick), commands: [] };
      const ordered = orderCommands(commands);
      let batchMutated = false;
      const tentative: Array<{ command: InternalCommand; event: Omit<DomainEvent, "sceneRevision" | "eventIndex" | "eventGroupId" | "serverSequence" | "eventId"> }> = [];
      const reservations = new Set<number>();

      for (const phase of phaseOrder()) {
        this.options.onPhase?.(phase, this.runtime.serverTick);
        if (phase !== "players") continue;
        for (const command of ordered) {
          const result = this.applyMove(command, reservations);
          commandResults.push(result.result);
          if (!result.event) continue;
          batchMutated = true;
          tentative.push({ command, event: result.event });
          reservations.add(cellIndex(result.event.payload.to));
        }
      }

      if (batchMutated) {
        this.runtime.sceneRevision += 1;
        const revision = this.runtime.sceneRevision;
        const groupId = `scene-${revision}`;
        for (let index = 0; index < tentative.length; index += 1) {
          const item = tentative[index];
          if (!item) continue;
          const sequence = this.runtime.nextServerSequence;
          this.runtime.nextServerSequence += 1;
          emitted.push({
            ...item.event,
            eventId: `evt-${sequence}`,
            eventGroupId: groupId,
            eventIndex: index,
            serverSequence: sequence,
            sceneRevision: revision,
          });
          const commandResult = commandResults.find((result) => result.requestId === item.command.requestId);
          if (commandResult?.status === "accepted") {
            commandResult.eventIds = [`evt-${sequence}`];
            commandResult.sceneRevision = revision;
          }
        }
        this.journal.appendBatch(emitted);
      }
    }

    assertRuntimeInvariants(this.runtime);
    return {
      serverTick: this.runtime.serverTick,
      closedWindowId,
      events: emitted.map((event) => ({ ...event, payload: { ...event.payload, from: { ...event.payload.from }, to: { ...event.payload.to } } })),
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

  replay(events: readonly DomainEvent[]): RuntimeSnapshot {
    return replayEvents(this.initialState, events);
  }

  private applyMove(
    command: InternalCommand,
    reservations: ReadonlySet<number>,
  ): { result: FinalCommandResult; event?: Omit<DomainEvent, "sceneRevision" | "eventIndex" | "eventGroupId" | "serverSequence" | "eventId"> } {
    const heroId = this.runtime.heroIdByActorId.get(command.actorId);
    const hero = heroId ? this.runtime.entities.get(heroId) : undefined;
    const reject = (code: EngineErrorCode): { result: FinalCommandResult } => ({
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
    const event: Omit<DomainEvent, "sceneRevision" | "eventIndex" | "eventGroupId" | "serverSequence" | "eventId"> = {
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
    };
    return {
      result: { requestId: command.requestId, status: "accepted", eventIds: [], sceneRevision: this.runtime.sceneRevision + 1 },
      event,
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
