import assert from "node:assert/strict";
import test from "node:test";
import { applyOrder, blankOrder, cleanOrder, turnRows } from "../src/order.js";

const dm = { name: "Dungeon Master", dm: true };
const mara = { name: "Mara", dm: false };

function add(order, label, init, hp = 10) {
  const result = applyOrder(order, { op: "add", label, init, hp, maxHp: hp }, dm);
  assert.equal(result.ok, true, result.reason);
  return result.order;
}

test("the DM adds a creature and a player cannot remove it or step the round", () => {
  let order = add(blankOrder(), "Guard", 12, 8);
  assert.equal(order.rows.length, 1);
  assert.equal(order.rows[0].name, "Guard");
  assert.equal(order.rows[0].seat, "");
  assert.equal(order.rows[0].hp, 8);
  assert.equal(order.rev, 1);
  assert.equal(applyOrder(order, { op: "remove", id: order.rows[0].id }, mara).reason, "The DM removes a name.");
  assert.equal(applyOrder(order, { op: "next" }, mara).reason, "The DM advances the round.");
  assert.equal(applyOrder(order, { op: "add", label: "Wolf" }, mara).reason, "The DM adds creatures.");
  assert.equal(order.rev, 1);
});

test("initiative keeps the same row and its marks", () => {
  let order = add(blankOrder(), "Guard", 5);
  const first = applyOrder(order, {
    op: "initiative",
    label: "Mara",
    init: 15,
    bonus: 2,
    hp: 9,
    maxHp: 12,
    marks: ["poisoned", "nope", "concentrating"],
  }, mara);
  assert.equal(first.ok, true);
  const row = first.order.rows.find((item) => item.seat === "Mara");
  assert.equal(row.init, 15);
  assert.deepEqual(row.marks, ["poisoned", "concentrating"]);
  const again = applyOrder(first.order, {
    op: "initiative",
    label: "Mara",
    init: 18,
    bonus: 2,
    hp: 9,
    maxHp: 12,
  }, mara);
  const kept = again.order.rows.find((item) => item.seat === "Mara");
  assert.equal(kept.id, row.id);
  assert.equal(kept.added, row.added);
  assert.deepEqual(kept.marks, ["poisoned", "concentrating"]);
  assert.equal(kept.init, 18);
  assert.equal(again.order.started, false);
});

test("next wraps the round and back does not leave round 1", () => {
  let order = add(blankOrder(), "Late", 1);
  order = add(order, "Early", 20);
  const names = () => turnRows(order).map((row) => row.name);
  assert.deepEqual(names(), ["Early", "Late"]);
  const started = applyOrder(order, { op: "next" }, dm);
  order = started.order;
  assert.equal(order.started, true);
  assert.equal(order.round, 1);
  assert.equal(turnRows(order).find((row) => row.id === order.activeId).name, "Early");
  order = applyOrder(order, { op: "next" }, dm).order;
  assert.equal(turnRows(order).find((row) => row.id === order.activeId).name, "Late");
  assert.equal(order.round, 1);
  order = applyOrder(order, { op: "next" }, dm).order;
  assert.equal(order.round, 2);
  assert.equal(turnRows(order).find((row) => row.id === order.activeId).name, "Early");
  order = applyOrder(order, { op: "back" }, dm).order;
  assert.equal(order.round, 1);
  assert.equal(turnRows(order).find((row) => row.id === order.activeId).name, "Late");
  order = applyOrder(order, { op: "back" }, dm).order;
  assert.equal(order.round, 1);
  assert.equal(turnRows(order).find((row) => row.id === order.activeId).name, "Early");
  const stayed = applyOrder(order, { op: "back" }, dm).order;
  assert.equal(stayed.round, 1);
  assert.equal(turnRows(stayed).find((row) => row.id === stayed.activeId).name, "Early");
  const idle = applyOrder(blankOrder(), { op: "back" }, dm);
  assert.equal(idle.ok, true);
  assert.equal(idle.order.started, false);
  assert.equal(idle.order.round, 1);
});

test("vitals follow the seat, and a step clamps hit points", () => {
  const made = applyOrder(blankOrder(), { op: "vitals", label: "Mara", hp: 4, maxHp: 6, marks: ["prone"] }, mara);
  assert.equal(made.ok, true);
  const row = made.order.rows[0];
  assert.equal(row.seat, "Mara");
  assert.equal(row.init, 0);
  assert.equal(row.hp, 4);
  assert.equal(made.order.started, false);
  const stepped = applyOrder(made.order, { op: "step", delta: 10 }, mara);
  assert.equal(stepped.order.rows[0].hp, 6);
  const down = applyOrder(stepped.order, { op: "step", delta: -99 }, mara);
  assert.equal(down.order.rows[0].hp, 0);
  const denied = applyOrder(made.order, { op: "step", id: row.id, delta: -1 }, { name: "Ivo", dm: false });
  assert.equal(denied.reason, "Roll initiative, or the DM has not added you.");
  const healed = applyOrder(down.order, { op: "vitals", id: row.id, hp: 3 }, dm);
  assert.equal(healed.ok, true);
  assert.equal(healed.order.rows[0].hp, 3);
  assert.equal(healed.order.rev, made.order.rev + 3);
});

test("a bad action leaves the order alone", () => {
  const order = add(blankOrder(), "Guard", 4);
  const before = cleanOrder(order);
  const result = applyOrder(order, { op: "dance" }, dm);
  assert.equal(result.ok, false);
  assert.deepEqual(cleanOrder(order), before);
});
