import { describe, expect, it } from "vitest";
import { EventJournal } from "../src/journal/EventJournal.js";
import { makeEngine, moveCommand } from "./createTestEngine.js";

describe("EventJournal", () => {
  it("retains appended events and returns defensive copies", () => {
    const engine = makeEngine();
    engine.submit(moveCommand("move-1", "right"));
    engine.advanceTicks(5);
    const journal = new EventJournal();
    const event = engine.events()[0];
    if (!event) throw new Error("expected movement event");
    journal.appendBatch([event]);
    const copy = journal.events();
    expect(journal.length).toBe(1);
    if (copy[0]) copy[0].payload.to.x = 8;
    expect(journal.events()[0]?.payload.to.x).toBe(2);
    expect(() => journal.appendBatch([event])).toThrow(/increase strictly/);
  });
});
