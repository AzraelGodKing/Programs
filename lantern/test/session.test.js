import assert from "node:assert/strict";
import test from "node:test";
import { icsFor, sessionLog, spotlight } from "../src/session.js";
import { parseSet } from "../src/dmstory.js";

const room = {
  code: "ABCD",
  players: [{ name: "Mara", snapshot: { character: { name: "Mara Vell" } } }, { name: "Bram", snapshot: {} }],
  messages: [
    { at: 10, from: "Mara", text: "Hello", to: "" },
    { at: 11, from: "Mara", text: "psst", to: "Bram" },
    { at: 12, from: "Dungeon Master", text: "The door creaks.", kind: "read", to: "" },
  ],
  events: [
    { at: 9, name: "Mara", summary: "Rolled 1d20 for Stealth: 15." },
    { at: 13, name: "Bram", summary: "Rolled 19 for Insight.", secret: true },
    { at: 14, name: "Mara", by: "Dungeon Master", summary: "The DM gave Mara 450 XP." },
  ],
  board: { quests: [{ title: "Find the door", done: false }, { title: "Secret", hidden: true }] },
};

test("the spotlight puts the quietest seat first", () => {
  const rows = spotlight(room, 0);
  assert.equal(rows[0].name, "Bram");
  assert.equal(rows[1].talk, 2);
});

test("the session log is Markdown without secrets or whispers", () => {
  const log = sessionLog(room, 0, { title: "Night 4" });
  assert.match(log, /^# Night 4/);
  assert.match(log, /- Mara Vell \(Mara\)/);
  assert.match(log, /The DM gave Mara 450 XP/);
  assert.match(log, /> The door creaks\./);
  assert.match(log, /- \[ \] Find the door/);
  assert.doesNotMatch(log, /psst|Insight|Secret/);
});

test("a calendar file for the next session", () => {
  const ics = icsFor({ at: Date.UTC(2026, 10, 7, 19), label: "Night 5, the barrow" }, "https://lantern.example/player.html?room=ABCD", 0);
  assert.match(ics, /DTSTART:20261107T190000Z/);
  assert.match(ics, /SUMMARY:Night 5\\, the barrow/);
  assert.equal(icsFor({ at: 0 }), "");
});

test("ready encounters read counts and names", () => {
  assert.deepEqual(parseSet("3 Wolf, 1 Dire wolf"), [{ count: 3, name: "Wolf" }, { count: 1, name: "Dire wolf" }]);
});
