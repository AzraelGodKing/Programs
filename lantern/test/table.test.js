import assert from "node:assert/strict";
import test from "node:test";
import { describeSetup, normalizeCode, rollSummary, sharedSnapshot } from "../src/table.js";

test("room codes keep four letters or digits", () => {
  assert.equal(normalizeCode(" ab-12 "), "AB12");
  assert.equal(normalizeCode("toolong"), "TOOL");
});

test("a roll summary names the person purpose and the dice", () => {
  assert.equal(
    rollSummary({
      purpose: "Perception",
      formula: "1d20 advantage + 5",
      total: 23,
      detail: "18 (dropped 4)",
      tag: "natural-20",
    }),
    "Rolled 23 for Perception. 1d20 advantage + 5. 18 (dropped 4). Natural 20.",
  );
  assert.match(rollSummary({ formula: "1d6", total: 4, detail: "4" }), /unnamed roll/);
});

test("the setup line tells the DM what is about to be rolled", () => {
  assert.equal(
    describeSetup({ count: 1, sides: 20, modifier: 3, mode: "advantage" }, "Perception"),
    "1d20 advantage + 3 for Perception",
  );
  assert.equal(describeSetup({ count: 2, sides: 6, modifier: 0, mode: "normal" }, ""), "2d6");
});

test("the shared snapshot keeps the sheet and leaves Threat, Spark, and the local fight here", () => {
  const night = {
    character: { name: "Mara Vale" },
    dice: { count: 1, sides: 20, modifier: 3, mode: "advantage", history: [] },
    lights: [{ id: "l1", kind: "torch", endsAt: 1 }],
    lightsPausedAt: 100,
    pauseReason: "user",
    notes: "The ferry",
    tab: "notes",
    drafts: [{ id: "d1", title: "Private", body: "Stay here." }],
    party: [{ id: "h1", name: "Bram", level: 3 }],
    monsters: [{ id: "m1", name: "Wolves", count: 4, xp: 50 }],
    sparks: [{ id: "s1", kind: "place", title: "Place", body: "A ferry." }],
    combat: { round: 2, started: true, activeId: "c1", combatants: [{ id: "c1", name: "Mara Vale" }] },
  };
  const snapshot = sharedSnapshot(night);
  assert.equal(snapshot.character.name, "Mara Vale");
  assert.equal(snapshot.dice.sides, 20);
  assert.equal(snapshot.lights[0].kind, "torch");
  assert.equal(snapshot.lightsPausedAt, 100);
  assert.equal(snapshot.pauseReason, "user");
  assert.equal(snapshot.notes, "The ferry");
  assert.equal(snapshot.tab, "notes");
  assert.equal("drafts" in snapshot, false);
  assert.equal("party" in snapshot, false);
  assert.equal("monsters" in snapshot, false);
  assert.equal("sparks" in snapshot, false);
  assert.equal("combat" in snapshot, false);
  assert.equal(night.party.length, 1);
  assert.equal(night.sparks.length, 1);
  assert.equal(night.combat.round, 2);
  assert.deepEqual(sharedSnapshot(null), {});
});
