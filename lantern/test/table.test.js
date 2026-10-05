import assert from "node:assert/strict";
import test from "node:test";
import { describeSetup, normalizeCode, rollSummary } from "../src/table.js";

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
