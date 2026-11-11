import assert from "node:assert/strict";
import test from "node:test";
import { blankMap, cellAt, cleanMap, fogged, freeCell, mapFor, paintFog, resizeMap, tokenLabel } from "../src/mapgrid.js";
import { discordRecap, nextSessionLine, recapDraft, validWebhook } from "../src/recap.js";
import { TableError, TableRoom } from "../worker/room.js";
import { memoryStorage } from "../worker/memory-storage.js";


async function table() {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mira = await room.join("", { name: "Mira" });
  const bo = await room.join("", { name: "Bo" });
  return { room, dm, mira: mira.token, bo: bo.token };
}

const PIXEL = "data:image/png;base64,iVBORw0KGgo=";
const HOOK = "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789";

test("the grid cleans itself, paints fog, and keeps its drawing when resized", () => {
  const map = cleanMap({ cols: 99, rows: 2, fog: "1x1", tokens: [{ id: "a".repeat(16), name: " Goblin   2 ", x: 500, y: -3 }, { name: "no id" }] });
  assert.equal(map.cols, 40);
  assert.equal(map.rows, 4);
  assert.equal(map.fog.length, 160);
  assert.equal(map.fog.slice(0, 4), "1010");
  assert.deepEqual(map.tokens, [{ id: "a".repeat(16), name: "Goblin 2", kind: "foe", color: "#d1603d", x: 39, y: 0, size: 1 }]);

  const small = { ...blankMap(), cols: 4, rows: 4, fog: "0".repeat(16) };
  small.fog = paintFog(small, [0, 5, 99, -1], true);
  assert.equal(small.fog, "1000010000000000");
  assert.equal(fogged(small, 1, 1), true);
  assert.equal(paintFog(small, "all", true), "1".repeat(16));
  assert.equal(paintFog(small, [5], false), "1000000000000000");
  const bigger = resizeMap({ ...small, tokens: [] }, 5, 4);
  assert.equal(fogged(bigger, 1, 1), true);
  assert.equal(fogged(bigger, 4, 0), false);

  assert.deepEqual(freeCell({ cols: 4, rows: 4, tokens: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }), { x: 2, y: 0 });
  assert.equal(tokenLabel("Goblin 2"), "G2");
  assert.equal(tokenLabel("Mira Thorn"), "MT");
  assert.equal(tokenLabel("Orc"), "OR");
  assert.deepEqual(cellAt({ cols: 10, rows: 5 }, { left: 100, top: 50, width: 200, height: 100 }, 139, 71), { x: 1, y: 1 });
  assert.equal(cellAt({ cols: 10, rows: 5 }, { left: 100, top: 50, width: 200, height: 100 }, 99, 71), null);
});

test("players see the map only when it is out, and never what the fog or the DM hides", () => {
  const map = cleanMap({
    on: false, cols: 4, rows: 4, fog: "0000" + "1111" + "0000" + "0000",
    tokens: [
      { id: "1".repeat(16), name: "Mira", kind: "pc", seat: "Mira", x: 0, y: 1 },
      { id: "2".repeat(16), name: "Ogre", kind: "foe", x: 1, y: 1 },
      { id: "3".repeat(16), name: "Spy", kind: "foe", x: 0, y: 0, hidden: true },
      { id: "4".repeat(16), name: "Wolf", kind: "foe", x: 2, y: 2 },
    ],
  });
  assert.equal(mapFor(map, { role: "player", name: "Mira" }), null);
  assert.equal(mapFor(map, { role: "dm" }).tokens.length, 4);
  const seen = mapFor({ ...map, on: true }, { role: "player", name: "Mira" });
  assert.deepEqual(seen.tokens.map((token) => token.name), ["Mira", "Wolf"]);
});

test("the DM draws the map and a player moves only their own token", async () => {
  const { room, dm, mira, bo } = await table();
  await assert.rejects(room.map(mira, { op: "show" }), /Only the DM draws the map/);
  await assert.rejects(room.map("f".repeat(32), { op: "show" }), TableError);
  await room.map(dm, { op: "size", cols: 6, rows: 5 });
  await room.map(dm, { op: "party" });
  let view = (await room.map(dm, { op: "party" })).map;
  assert.deepEqual(view.tokens.map((token) => [token.name, token.seat, token.kind]), [["Mira", "Mira", "pc"], ["Bo", "Bo", "pc"]]);
  view = (await room.map(dm, { op: "token-add", name: "Ogre", kind: "foe", x: 5, y: 4, hidden: true })).map;
  const ogre = view.tokens.find((token) => token.name === "Ogre");
  const own = view.tokens.find((token) => token.seat === "Mira");

  assert.equal((await room.view(mira)).map, null, "nothing shows before the DM puts the map out");
  await assert.rejects(room.map(mira, { op: "token-move", id: own.id, x: 1, y: 1 }), /Move your own token/);
  await room.map(dm, { op: "show", on: true });
  await room.map(dm, { op: "fog", cells: [4 * 6 + 5, 3 * 6 + 3], hidden: true });

  const seen = (await room.view(mira)).map;
  assert.deepEqual(seen.tokens.map((token) => token.name), ["Mira", "Bo"]);
  const moved = await room.map(mira, { op: "token-move", id: own.id, x: 2, y: 2 });
  assert.deepEqual([moved.map.tokens[0].x, moved.map.tokens[0].y], [2, 2]);
  await assert.rejects(room.map(bo, { op: "token-move", id: own.id, x: 0, y: 0 }), /Move your own token/);
  await assert.rejects(room.map(mira, { op: "token-move", id: ogre.id, x: 0, y: 0 }), /Move your own token/);
  await assert.rejects(room.map(mira, { op: "token-move", id: own.id, x: 3, y: 3 }), /cannot see that far/);
  await assert.rejects(room.map(mira, { op: "token-move", id: own.id, x: 9, y: 9 }), /off the map/);

  // Showing the ogre is not enough while it stands in the fog.
  await room.map(dm, { op: "token-edit", id: ogre.id, hidden: false });
  assert.equal((await room.view(mira)).map.tokens.some((token) => token.name === "Ogre"), false);
  await room.map(dm, { op: "fog", all: true, hidden: false });
  assert.equal((await room.view(mira)).map.tokens.some((token) => token.name === "Ogre"), true);
  await room.map(dm, { op: "token-remove", id: ogre.id });
  assert.equal((await room.view(dm)).map.tokens.length, 2);
});

test("the map picture is kept apart from the view and only handed out once the map is out", async () => {
  const { room, dm, mira } = await table();
  await assert.rejects(room.map(dm, { op: "image", image: "data:text/html;base64,AAAA" }), /PNG, JPEG, or WebP/);
  await assert.rejects(room.map(dm, { op: "image", image: `data:image/png;base64,${"A".repeat(300_000)}` }), /too large/);
  const set = await room.map(dm, { op: "image", image: PIXEL });
  assert.ok(set.map.image > 0);
  assert.equal(JSON.stringify(await room.view(dm)).includes("iVBOR"), false);
  await assert.rejects(room.map(mira, { op: "image-get" }), /not out yet/);
  await room.map(dm, { op: "show" });
  assert.equal((await room.map(mira, { op: "image-get" })).image, PIXEL);
  await room.map(dm, { op: "clear" });
  const cleared = await room.map(dm, { op: "image-get" });
  assert.equal(cleared.image, "");
});

test("a spectator link reads the public table and cannot touch it", async () => {
  const { room, dm, mira, bo } = await table();
  await assert.rejects(room.board(mira, { op: "watch-link" }), /Only the DM/);
  const { token } = await room.board(dm, { op: "watch-link" });
  assert.match(token, /^[a-f0-9]{32}$/);
  assert.equal((await room.board(dm, { op: "watch-link" })).token, token, "asking again gives the same link");
  assert.equal((await room.view(dm)).watch, true);

  await room.update(mira, { snapshot: { character: { name: "Mira Thorn", classId: "rogue", level: 3, notes: "private" }, scratch: "secret plan", purse: 99 }, summaries: ["Rolled 14 for Stealth.", { text: "Rolled 3 in secret.", secret: true }] });
  await room.talk(mira, { text: "Open the door." });
  await room.talk(mira, { text: "I pocket the gem.", to: "Dungeon Master" });
  await room.talk(dm, { text: "Bo, you notice it.", to: "Bo" });
  await room.board(dm, { op: "quest-add", title: "Find the barrow" });
  await room.board(dm, { op: "quest-add", title: "The traitor", hidden: true });
  await room.board(mira, { op: "notes", text: "Party plans" });
  await room.board(dm, { op: "handout", title: "Letter", text: "Dear heroes" });
  await room.map(dm, { op: "show" });
  await room.map(dm, { op: "token-add", name: "Spy", hidden: true });

  const view = await room.view(token);
  assert.equal(view.watching, true);
  assert.equal(view.locked, false);
  assert.deepEqual(view.messages.map((message) => message.text), ["Open the door."]);
  assert.deepEqual(view.events.map((event) => event.summary), ["Rolled 14 for Stealth."]);
  assert.deepEqual(view.board.quests.map((quest) => quest.title), ["Find the barrow"]);
  assert.equal(view.board.notes.text, "");
  assert.deepEqual(view.board.handouts, []);
  assert.deepEqual(view.players.find((player) => player.name === "Mira").snapshot, { character: { name: "Mira Thorn", classId: "rogue", level: 3 } });
  assert.equal(JSON.stringify(view).includes("secret plan"), false);
  assert.deepEqual(view.map.tokens, []);

  await assert.rejects(room.talk(token, { text: "hello" }), /Sit down/);
  await assert.rejects(room.board(token, { op: "xcard" }), /Sit down/);
  await assert.rejects(room.update(token, { snapshot: {} }), /Sit down/);
  await assert.rejects(room.map(token, { op: "token-add", name: "x" }), /only watches/);
  await assert.rejects(room.map(token, { op: "fog", all: true }), /only watches/);
  await assert.rejects(room.recap(token, { webhook: HOOK, recap: "x" }), /Only the DM/);
  assert.equal((await room.map(token, { op: "image-get" })).image, "");

  await room.board(dm, { op: "watch-off" });
  assert.equal((await room.view(token)).locked, true, "the old link stops working");
  assert.equal((await room.view(dm)).watch, false);
  assert.notEqual((await room.board(dm, { op: "watch-link" })).token, token);
  assert.equal((await room.view(bo)).watch, undefined);
});

test("the Discord recap is built safely and sent only to a Discord webhook", async () => {
  assert.equal(validWebhook(HOOK), true);
  assert.equal(validWebhook("https://discordapp.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"), true);
  assert.equal(validWebhook("https://example.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(validWebhook("https://discord.com.evil.test/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(validWebhook(`${HOOK}?wait=true`), false);

  const at = Date.UTC(2026, 10, 14, 19, 0);
  assert.equal(nextSessionLine({ at, label: "Session 5" }), `Session 5\n<t:${at / 1000}:F> (<t:${at / 1000}:R>)`);
  assert.equal(nextSessionLine(null), "");
  assert.equal(discordRecap({}), null);
  const body = discordRecap({ recap: "@everyone the barrow fell.", next: { at, label: "Session 5" }, title: "Table ABCD", link: "https://lantern.azraelsmods.com/player.html?room=ABCD" });
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  assert.equal(body.embeds[0].title, "Table ABCD");
  assert.deepEqual(body.embeds[0].fields.map((field) => field.name), ["Next session", "Join the table"]);

  const draft = recapDraft({
    players: [{ name: "Mira", snapshot: { character: { name: "Mira Thorn" } } }, { name: "Bo", snapshot: {} }],
    events: [{ at: 5, by: "Dungeon Master", name: "Mira", summary: "The DM gave Mira 50 gp." }, { at: 1, by: "Dungeon Master", name: "Bo", summary: "The DM gave Bo a sword." }],
    board: { quests: [{ title: "Find the barrow", done: true }, { title: "The traitor", hidden: true }, { title: "Go home" }] },
  }, 2);
  assert.equal(draft, "**At the table:** Mira Thorn, Bo\n**Finished:** Find the barrow\n**Still open:** Go home\n**Rewards:**\n- The DM gave Mira 50 gp.");

  const { room, dm, mira } = await table();
  const sent = [];
  const fetchOk = async (url, init) => { sent.push([url, JSON.parse(init.body)]); return new Response(null, { status: 204 }); };
  await assert.rejects(room.recap(mira, { webhook: HOOK, recap: "x" }, fetchOk), /Only the DM/);
  await assert.rejects(room.recap(dm, { webhook: "https://example.com/hook", recap: "x" }, fetchOk), /not a Discord webhook/);
  await assert.rejects(room.recap(dm, { webhook: HOOK, recap: "" }, fetchOk), /Write a recap/);
  assert.equal(sent.length, 0);
  await room.board(dm, { op: "next", at, label: "Session 5" });
  assert.deepEqual(await room.recap(dm, { webhook: HOOK, recap: "The barrow fell." }, fetchOk), { ok: true, next: true });
  assert.equal(sent[0][0], HOOK);
  assert.equal(sent[0][1].embeds[0].description, "The barrow fell.");
  assert.match(sent[0][1].embeds[0].fields[0].value, /Session 5/);
  assert.deepEqual(await room.recap(dm, { webhook: HOOK, recap: "Only words.", next: false }, fetchOk), { ok: true, next: false });
  await assert.rejects(room.recap(dm, { webhook: HOOK, recap: "x" }, async () => new Response(null, { status: 404 })), /does not know that webhook/);
  await assert.rejects(room.recap(dm, { webhook: HOOK, recap: "x" }, async () => { throw new Error("down"); }), /did not answer/);
  assert.equal(JSON.stringify([...(await room.storage.list({ prefix: "" })).values()]).includes("webhooks"), false, "the webhook address is never stored");
});

test("a spectator link carries the table code and the watch token", async () => {
  const { parseWatchLink } = await import("../src/watch.js");
  assert.deepEqual(parseWatchLink(`#abcd.${"a1".repeat(16)}`), { code: "ABCD", token: "a1".repeat(16) });
  assert.equal(parseWatchLink("#ABCD"), null);
  assert.equal(parseWatchLink(`#ABCD.${"z".repeat(32)}`), null);
  assert.equal(parseWatchLink(""), null);
});
