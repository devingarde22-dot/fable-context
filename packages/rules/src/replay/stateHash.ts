import { createHash } from "node:crypto";
import { snapshotState } from "../engine/createRuntimeState.js";
import type { RuntimeState, RuntimeSnapshot } from "../engine/types.js";

export function canonicalizeSnapshot(snapshot: RuntimeSnapshot): string {
  return JSON.stringify({
    campaignId: snapshot.campaignId,
    sessionId: snapshot.sessionId,
    scene: {
      id: snapshot.scene.id,
      width: snapshot.scene.width,
      height: snapshot.scene.height,
      cells: [...snapshot.scene.cells].sort((a, b) => a.y - b.y || a.x - b.x),
      playerEntityIds: [...snapshot.scene.playerEntityIds].sort(),
      enemyEntityIds: [...snapshot.scene.enemyEntityIds].sort(),
      startedAtTick: snapshot.scene.startedAtTick,
      inputWindow: {
        windowId: snapshot.scene.inputWindow.windowId,
        commands: [...snapshot.scene.inputWindow.commands]
          .sort((a, b) => a.serverReceiveSequence - b.serverReceiveSequence || a.actorId.localeCompare(b.actorId) || a.requestId.localeCompare(b.requestId))
          .map((command) => ({
            requestId: command.requestId,
            sessionId: command.sessionId,
            actorId: command.actorId,
            role: command.role,
            command: command.command,
            payload: command.payload,
            clientRevision: command.clientRevision,
            serverReceiveSequence: command.serverReceiveSequence,
          })),
      },
    },
    entities: [...snapshot.entities].sort((a, b) => a.id.localeCompare(b.id)),
    heroIdByActorId: [...snapshot.heroIdByActorId].sort(([a], [b]) => a.localeCompare(b)),
    serverTick: snapshot.serverTick,
    sceneRevision: snapshot.sceneRevision,
    nextServerSequence: snapshot.nextServerSequence,
    rootSeed: snapshot.rootSeed,
    phase: snapshot.phase,
    paused: snapshot.paused,
    outcome: snapshot.outcome,
  });
}

export function stateHashFromSnapshot(snapshot: RuntimeSnapshot): string {
  return createHash("sha256").update(canonicalizeSnapshot(snapshot)).digest("hex");
}

export function stateHash(state: RuntimeState): string {
  return stateHashFromSnapshot(snapshotState(state));
}
