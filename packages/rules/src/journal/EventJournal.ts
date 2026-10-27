import type { DomainEvent } from "../engine/types.js";

export class EventJournal {
  private readonly entries: DomainEvent[] = [];

  appendBatch(events: readonly DomainEvent[]): void {
    let expected = this.entries.at(-1)?.serverSequence ?? 0;
    for (const event of events) {
      if (event.serverSequence <= expected) throw new Error("Journal serverSequence must increase strictly");
      expected = event.serverSequence;
    }
    this.entries.push(...events.map(cloneEvent));
  }

  events(): readonly DomainEvent[] {
    return this.entries.map(cloneEvent);
  }

  get length(): number {
    return this.entries.length;
  }
}

export function cloneEvent(event: DomainEvent): DomainEvent {
  return {
    ...event,
    payload: { entityId: event.payload.entityId, from: { ...event.payload.from }, to: { ...event.payload.to } },
    replay: event.replay ? { ...event.replay } : null,
  };
}
