import { cloneRuntimeState, snapshotState } from "../engine/createRuntimeState.js";
import { assertRuntimeInvariants } from "../engine/invariants.js";
import { cellIndex, isInBounds } from "../grid/Grid.js";
import { checkMovementDestination } from "../grid/collision.js";
import type { DomainEvent, RuntimeSnapshot, RuntimeState } from "../engine/types.js";
import { cloneEvent } from "../journal/EventJournal.js";

export function replayEvents(initialState: RuntimeState, events: readonly DomainEvent[]): RuntimeSnapshot {
  const state = cloneRuntimeState(initialState);
  let previousSequence = state.nextServerSequence - 1;
  let currentGroup = "";
  let expectedEventIndex = 0;
  let currentGroupRevision = -1;

  for (const sourceEvent of events) {
    const event = cloneEvent(sourceEvent);
    if (event.protocolVersion !== "fable.protocol.v1" || event.schemaVersion !== 1 ||
      event.eventVersion !== 1 || event.eventType !== "scene.entity_moved") {
      throw new Error("Unsupported or invalid event contract");
    }
    if (event.serverSequence <= previousSequence) throw new Error("Replay sequence is not strictly increasing");
    if (event.campaignId !== state.campaignId || event.sessionId !== state.sessionId || event.sceneId !== state.scene.id) {
      throw new Error("Replay event scope does not match initial state");
    }
    if (event.eventIndex === 0) {
      if (event.sceneRevision !== state.sceneRevision + 1) throw new Error("Replay sceneRevision did not advance exactly once for the batch");
      currentGroup = event.eventGroupId;
      currentGroupRevision = event.sceneRevision;
      expectedEventIndex = 0;
    }
    if (event.eventGroupId !== currentGroup || event.sceneRevision !== currentGroupRevision || event.eventIndex !== expectedEventIndex) {
      throw new Error("Replay event group, revision, or eventIndex is inconsistent");
    }
    expectedEventIndex += 1;

    const entity = state.entities.get(event.payload.entityId);
    if (!entity || entity.aliveState !== "active" || !isInBounds(event.payload.from) || !isInBounds(event.payload.to)) {
      throw new Error("Replay movement references invalid entity or cell");
    }
    if (entity.position.x !== event.payload.from.x || entity.position.y !== event.payload.from.y) {
      throw new Error("Replay movement from-cell does not match current entity position");
    }
    const sourceCell = state.scene.cells[cellIndex(event.payload.from)];
    if (!sourceCell || sourceCell.occupantId !== entity.id) throw new Error("Replay source occupancy is inconsistent");
    const collision = checkMovementDestination(state.scene.cells, event.payload.to);
    if (!collision.ok) throw new Error(`Replay destination is invalid: ${collision.code}`);

    sourceCell.occupantId = null;
    const destinationCell = state.scene.cells[cellIndex(event.payload.to)];
    if (!destinationCell) throw new Error("Replay destination cell is missing");
    destinationCell.occupantId = entity.id;
    entity.position = { ...event.payload.to };
    state.serverTick = event.serverTick;
    state.sceneRevision = event.sceneRevision;
    state.nextServerSequence = event.serverSequence + 1;
    state.scene.inputWindow = { windowId: Math.floor(state.serverTick / 5), commands: [] };
    previousSequence = event.serverSequence;
    assertRuntimeInvariants(state);
  }

  return snapshotState(state);
}
