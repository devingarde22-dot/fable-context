import { cellIndex, isInBounds } from "../grid/Grid.js";
import { GRID_HEIGHT, GRID_WIDTH, type RuntimeState } from "./types.js";

export function assertRuntimeInvariants(state: RuntimeState): void {
  if (state.serverTick < 0 || state.sceneRevision < 0 || state.nextServerSequence < 1) {
    throw new Error("Invalid tick, revision, or sequence counter");
  }
  if (state.scene.width !== GRID_WIDTH || state.scene.height !== GRID_HEIGHT || state.scene.cells.length !== GRID_WIDTH * GRID_HEIGHT) {
    throw new Error("Scene grid must contain exactly 81 cells");
  }
  const seenOccupants = new Set<string>();
  for (let index = 0; index < state.scene.cells.length; index += 1) {
    const cell = state.scene.cells[index];
    if (!cell || cell.x !== index % GRID_WIDTH || cell.y !== Math.floor(index / GRID_WIDTH)) {
      throw new Error("Grid cells are not in canonical row-major order");
    }
    if (cell.occupantId === null) continue;
    if (seenOccupants.has(cell.occupantId)) throw new Error(`Entity ${cell.occupantId} occupies multiple cells`);
    seenOccupants.add(cell.occupantId);
  }
  for (const cell of state.scene.cells) {
    if (cell.occupantId === null) continue;
    const entity = state.entities.get(cell.occupantId);
    if (!entity || entity.aliveState !== "active" || !isInBounds(entity.position) ||
      entity.position.x !== cell.x || entity.position.y !== cell.y) {
      throw new Error(`Cell occupancy is inconsistent for ${cell.occupantId}`);
    }
  }
  for (const entity of state.entities.values()) {
    if (!isInBounds(entity.position)) throw new Error(`Entity ${entity.id} is outside the grid`);
    const cell = state.scene.cells[cellIndex(entity.position)];
    if (entity.aliveState === "active" && cell?.occupantId !== entity.id) {
      throw new Error(`Active entity ${entity.id} is not recorded as occupant`);
    }
    if (entity.aliveState === "removed" && cell?.occupantId === entity.id) {
      throw new Error(`Removed entity ${entity.id} still occupies a cell`);
    }
  }
}
