import { createSimulationEngine } from "../src/engine/SimulationEngine.js";
import type { EntityRuntime, SimulationEngineConfig } from "../src/engine/types.js";

export function hero(id: string, x: number, y: number, mode: "movement" | null = "movement"): EntityRuntime {
  return { id, kind: "hero", faction: "party", position: { x, y }, aliveState: "active", mode };
}

export function enemy(id: string, x: number, y: number): EntityRuntime {
  return { id, kind: "enemy", faction: "enemy", position: { x, y }, aliveState: "active", mode: null };
}

export function testConfig(overrides: Partial<SimulationEngineConfig> = {}): SimulationEngineConfig {
  return {
    campaignId: "campaign-test",
    sessionId: "session-test",
    sceneId: "scene-test",
    rootSeed: "fable-step-c-test",
    entities: [hero("hero-1", 1, 1), enemy("enemy-1", 7, 7)],
    heroIdByActorId: { "actor-1": "hero-1" },
    ...overrides,
  };
}

export function moveCommand(
  requestId: string,
  direction: "up" | "down" | "left" | "right",
  options: { actorId?: string; revision?: number; sequence?: number; sessionId?: string } = {},
) {
  return {
    requestId,
    sessionId: options.sessionId ?? "session-test",
    actorId: options.actorId ?? "actor-1",
    role: "player" as const,
    command: "player.move" as const,
    payload: { direction },
    clientRevision: options.revision ?? 0,
    serverReceiveSequence: options.sequence ?? 1,
  };
}

export function makeEngine(overrides: Partial<SimulationEngineConfig> = {}) {
  return createSimulationEngine(testConfig(overrides));
}
