export const GRID_WIDTH = 9 as const;
export const GRID_HEIGHT = 9 as const;
export const TICK_RATE = 20 as const;
export const TICK_DURATION_MS = 50 as const;
export const INPUT_WINDOW_TICKS = 5 as const;

export type EntityId = string;
export type Cell = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";
export type Terrain = "floor" | "wall" | "statue";
export type RuntimeEntityKind = "hero" | "enemy";
export type RuntimeFaction = "party" | "enemy";

export type CellRuntime = {
  x: number;
  y: number;
  terrain: Terrain;
  blocksMovement: boolean;
  blocksLineOfSight: boolean;
  occupantId: EntityId | null;
};

export type EntityRuntime = {
  id: EntityId;
  kind: RuntimeEntityKind;
  faction: RuntimeFaction;
  position: Cell;
  aliveState: "active" | "removed";
  mode: "movement" | null;
};

export type InternalPlayerMoveCommand = {
  requestId: string;
  sessionId: string;
  actorId: string;
  role: "player";
  command: "player.move";
  payload: { direction: Direction };
  clientRevision: number;
  serverReceiveSequence: number;
};

export type InternalCommand = InternalPlayerMoveCommand;

export type InputWindowRuntime = {
  windowId: number;
  commands: InternalCommand[];
};

export type SceneRuntime = {
  id: string;
  width: typeof GRID_WIDTH;
  height: typeof GRID_HEIGHT;
  cells: CellRuntime[];
  playerEntityIds: EntityId[];
  enemyEntityIds: EntityId[];
  inputWindow: InputWindowRuntime;
  startedAtTick: number;
};

export type RuntimeState = {
  campaignId: string;
  sessionId: string;
  scene: SceneRuntime;
  entities: Map<EntityId, EntityRuntime>;
  heroIdByActorId: Map<string, EntityId>;
  serverTick: number;
  sceneRevision: number;
  nextServerSequence: number;
  rootSeed: string;
  phase: "active";
  paused: false;
  outcome: null;
};

export type DomainEvent = {
  protocolVersion: "fable.protocol.v1";
  schemaVersion: 1;
  eventId: string;
  eventType: "scene.entity_moved";
  eventVersion: 1;
  campaignId: string;
  sessionId: string;
  sceneId: string;
  sceneRevision: number;
  serverTick: number;
  serverSequence: number;
  eventGroupId: string;
  eventIndex: number;
  causedByRequestId: string;
  actorId: string;
  replay: { seedRef: string } | null;
  payload: {
    entityId: EntityId;
    from: Cell;
    to: Cell;
  };
};

export type RuntimeSnapshot = {
  campaignId: string;
  sessionId: string;
  scene: SceneRuntime;
  entities: EntityRuntime[];
  heroIdByActorId: Array<[string, EntityId]>;
  serverTick: number;
  sceneRevision: number;
  nextServerSequence: number;
  rootSeed: string;
  phase: "active";
  paused: false;
  outcome: null;
};

export type EngineErrorCode =
  | "SCHEMA_INVALID"
  | "AUTH_FORBIDDEN"
  | "STALE_SCENE_REVISION"
  | "DUPLICATE_REQUEST"
  | "STATE_LOCKED"
  | "INVALID_MODE"
  | "CELL_OUT_OF_BOUNDS"
  | "CELL_BLOCKED"
  | "CELL_OCCUPIED"
  | "CONFLICTING_BATCH_STATE"
  | "INVALID_STATE";

export type SubmitResult =
  | { status: "queued"; requestId: string; windowId: number }
  | { status: "rejected"; requestId: string; code: EngineErrorCode; sceneRevision: number }
  | { status: "duplicate"; requestId: string; original: SubmitResult };

export type FinalCommandResult =
  | { requestId: string; status: "accepted"; eventIds: string[]; sceneRevision: number }
  | { requestId: string; status: "rejected"; code: EngineErrorCode; sceneRevision: number };

export type TickResult = {
  serverTick: number;
  closedWindowId: number | null;
  events: readonly DomainEvent[];
  commandResults: readonly FinalCommandResult[];
  sceneRevision: number;
  stateHash: string;
};

export type SimulationEngineConfig = {
  campaignId: string;
  sessionId: string;
  sceneId: string;
  rootSeed: string;
  terrain?: readonly { cell: Cell; terrain: Terrain }[];
  entities: readonly EntityRuntime[];
  heroIdByActorId: Readonly<Record<string, EntityId>>;
  initialServerTick?: number;
  initialSceneRevision?: number;
  initialServerSequence?: number;
};
