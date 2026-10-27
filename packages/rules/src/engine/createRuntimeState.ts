import { createGrid, cellIndex, isInBounds } from "../grid/Grid.js";
import { GRID_HEIGHT, GRID_WIDTH, type EntityRuntime, type RuntimeState, type SimulationEngineConfig } from "./types.js";
import { assertRuntimeInvariants } from "./invariants.js";

export function createRuntimeState(config: SimulationEngineConfig): RuntimeState {
  const entities = new Map<string, EntityRuntime>();
  const cells = createGrid(config.terrain);
  const playerEntityIds: string[] = [];
  const enemyEntityIds: string[] = [];

  for (const source of config.entities) {
    if (entities.has(source.id)) throw new Error(`Duplicate entity id: ${source.id}`);
    const entity: EntityRuntime = { ...source, position: { ...source.position } };
    if (!isInBounds(entity.position)) throw new Error(`Entity ${entity.id} starts outside the grid`);
    const cell = cells[cellIndex(entity.position)];
    if (!cell) throw new Error(`Missing cell at ${entity.position.x},${entity.position.y}`);
    if (cell.blocksMovement) throw new Error(`Entity ${entity.id} starts on blocked terrain`);
    if (cell.occupantId !== null) throw new Error(`Entities overlap at ${entity.position.x},${entity.position.y}`);
    if (entity.aliveState === "active") cell.occupantId = entity.id;
    entities.set(entity.id, entity);
    if (entity.kind === "hero") playerEntityIds.push(entity.id);
    else enemyEntityIds.push(entity.id);
  }

  const heroIdByActorId = new Map(Object.entries(config.heroIdByActorId));
  for (const [actorId, heroId] of heroIdByActorId) {
    const hero = entities.get(heroId);
    if (!hero || hero.kind !== "hero" || hero.aliveState !== "active") {
      throw new Error(`Actor ${actorId} is mapped to a non-active hero ${heroId}`);
    }
  }

  const state: RuntimeState = {
    campaignId: config.campaignId,
    sessionId: config.sessionId,
    scene: {
      id: config.sceneId,
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      cells,
      playerEntityIds: playerEntityIds.sort(),
      enemyEntityIds: enemyEntityIds.sort(),
      inputWindow: { windowId: Math.floor((config.initialServerTick ?? 0) / 5), commands: [] },
      startedAtTick: config.initialServerTick ?? 0,
    },
    entities,
    heroIdByActorId,
    serverTick: config.initialServerTick ?? 0,
    sceneRevision: config.initialSceneRevision ?? 0,
    nextServerSequence: config.initialServerSequence ?? 1,
    rootSeed: config.rootSeed,
    phase: "active",
    paused: false,
    outcome: null,
  };
  assertRuntimeInvariants(state);
  return state;
}

export function cloneRuntimeState(state: RuntimeState): RuntimeState {
  return {
    ...state,
    scene: {
      ...state.scene,
      cells: state.scene.cells.map((cell) => ({ ...cell })),
      playerEntityIds: [...state.scene.playerEntityIds],
      enemyEntityIds: [...state.scene.enemyEntityIds],
      inputWindow: {
        windowId: state.scene.inputWindow.windowId,
        commands: state.scene.inputWindow.commands.map((command) => ({
          ...command,
          payload: { ...command.payload },
        })),
      },
    },
    entities: new Map([...state.entities].map(([id, entity]) => [id, { ...entity, position: { ...entity.position } }])),
    heroIdByActorId: new Map(state.heroIdByActorId),
  };
}

export function snapshotState(state: RuntimeState) {
  const copy = cloneRuntimeState(state);
  return {
    ...copy,
    entities: [...copy.entities.values()].sort((a, b) => a.id.localeCompare(b.id)),
    heroIdByActorId: [...copy.heroIdByActorId.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}
