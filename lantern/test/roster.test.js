import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCharacter,
  addCharacter,
  characterFilename,
  charactersAt,
  chooseCharacter,
  exportCharacter,
  markDead,
  normalizeRoster,
  writeSheet,
} from "../src/roster.js";

const mara = { name: "Mara Vale", touched: true, raceId: "human", classId: "fighter" };

test("a table starts empty and keeps every character added to it", () => {
  const empty = normalizeRoster(null);
  assert.deepEqual(charactersAt(empty, "AB12"), []);
  const first = addCharacter(empty, "ab12", mara);
  const second = addCharacter(first.roster, "AB12", { name: "Bram", touched: true });
  const list = charactersAt(second.roster, "AB12");
  assert.equal(list.length, 2);
  assert.equal(list[0].sheet.name, "Mara Vale");
  assert.equal(list[1].sheet.name, "Bram");
  assert.equal(list.every((entry) => entry.dead), false);
  assert.equal(activeCharacter(second.roster, "AB12").id, second.entry.id);
  assert.equal(charactersAt(second.roster, "ZZZZ").length, 0);
});

test("a dead character can be viewed and exported, and is not loaded", () => {
  const made = addCharacter(normalizeRoster(null), "ROOM", mara);
  const dead = markDead(made.roster, "ROOM", made.entry.id);
  const entry = charactersAt(dead, "ROOM")[0];
  assert.equal(entry.dead, true);
  assert.equal(activeCharacter(dead, "ROOM"), null);
  assert.equal(chooseCharacter(dead, "ROOM", entry.id).active.ROOM, undefined);

  const other = addCharacter(dead, "ROOM", { name: "Bram", touched: true });
  const written = writeSheet(other.roster, "ROOM", entry.id, { name: "Should stay dead", touched: true });
  assert.equal(charactersAt(written, "ROOM")[0].sheet.name, "Mara Vale");
  const living = writeSheet(written, "ROOM", other.entry.id, { name: "Bram Holt", touched: true });
  assert.equal(charactersAt(living, "ROOM")[1].sheet.name, "Bram Holt");

  const when = new Date("2026-10-05T18:00:00.000Z");
  const file = exportCharacter(charactersAt(living, "ROOM")[0], when);
  assert.equal(file.lantern, 1);
  assert.equal(file.kind, "character");
  assert.equal(file.dead, true);
  assert.equal(file.character.name, "Mara Vale");
  assert.equal(file.savedAt, "2026-10-05T18:00:00.000Z");
  assert.equal(characterFilename(charactersAt(living, "ROOM")[0], when), "lantern-character-mara-vale-2026-10-05.json");
});

test("a bad roster drops unknown codes and duplicate ids", () => {
  const roster = normalizeRoster({
    tables: {
      no: [{ id: "a", sheet: { name: "Nope" } }],
      "ab12": [
        { id: "hero-1", dead: false, sheet: mara },
        { id: "hero-1", sheet: { name: "Copy" } },
        { id: "bad id", sheet: mara },
      ],
    },
    active: { AB12: "hero-1", ZZZZ: "hero-1" },
  });
  assert.deepEqual(Object.keys(roster.tables), ["AB12"]);
  assert.equal(roster.tables.AB12.length, 1);
  assert.equal(roster.active.AB12, "hero-1");
});
