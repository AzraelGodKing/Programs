import assert from "node:assert/strict";
import test from "node:test";
import { DM_NAME, TableError, TableRoom } from "../worker/room.js";
import { handleRequest } from "../worker/router.js";

function memoryStorage() {
  const data = new Map();
  return {
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : undefined;
    },
    async put(key, value) {
      if (typeof key === "object") {
        for (const [name, stored] of Object.entries(key)) data.set(name, structuredClone(stored));
        return;
      }
      data.set(key, structuredClone(value));
    },
    async list({ prefix }) {
      const out = new Map();
      for (const [name, stored] of data) {
        if (name.startsWith(prefix)) out.set(name, structuredClone(stored));
      }
      return out;
    },
    async delete(key) {
      return data.delete(key);
    },
    async setAlarm() {},
    async deleteAll() {
      data.clear();
    },
  };
}

function envFor(table) {
  return {
    TABLE: {
      idFromName(code) {
        return code;
      },
      get() {
        return table;
      },
    },
    ASSETS: {
      async fetch() {
        return new Response("page", { status: 200, headers: { "content-type": "text/html" } });
      },
    },
  };
}

async function call(env, method, path, payload, token = "") {
  const headers = {};
  if (payload !== undefined) headers["content-type"] = "application/json";
  if (token) headers["x-lantern-token"] = token;
  const response = await handleRequest(new Request(`https://lantern.azraelsmods.com${path}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }), env);
  return { status: response.status, body: await response.json().catch(() => null), response };
}

async function openedRoom() {
  const table = new TableRoom(memoryStorage());
  const dmToken = await table.create();
  const mara = await table.join("", { name: "Mara" });
  return { table, dmToken, mara };
}

test("a sale can be bought back until the shop closes", async () => {
  const { table, dmToken, mara } = await openedRoom();
  await table.setShop(dmToken, {
    open: true,
    name: "Smith",
    stall: "smith",
    goods: [{ id: "longsword", name: "Longsword", cp: 1500, service: false }],
  });
  const sold = await table.tradeBuyback(mara.token, { action: "sell", id: "longsword", cp: 750 });
  await table.tradeBuyback(mara.token, { action: "sell", id: "longsword", cp: 750 });
  assert.equal(sold[0].qty, 1);
  const stacked = await table.view(dmToken);
  assert.equal(stacked.buybacks[0].qty, 2);
  const ivo = await table.join("", { name: "Ivo" });
  await assert.rejects(
    () => table.tradeBuyback(ivo.token, { action: "buy", id: "longsword", cp: 750 }),
    (error) => error instanceof TableError && error.message === "That is no longer held for buy back.",
  );
  await table.setShop(dmToken, { open: true, name: "Tavern", stall: "tavern", goods: [] });
  assert.equal((await table.view(dmToken)).buybacks[0].qty, 2);
  const bought = await table.tradeBuyback(mara.token, { action: "buy", id: "longsword", cp: 750 });
  assert.equal(bought[0].qty, 1);
  await table.setShop(dmToken, { open: false, name: "Tavern", stall: "tavern", goods: [] });
  assert.deepEqual((await table.view(dmToken)).buybacks, []);
  await assert.rejects(
    () => table.tradeBuyback(mara.token, { action: "buy", id: "longsword", cp: 750 }),
    (error) => error instanceof TableError && error.message === "The shop is closed.",
  );
  await table.setShop(dmToken, { open: true, name: "Smith", stall: "smith", goods: [] });
  assert.deepEqual((await table.view(dmToken)).buybacks, []);
});

test("a boolean shop switch still closes the counter", async () => {
  const { table, dmToken } = await openedRoom();
  assert.equal(await table.setShop(dmToken, { open: false }), false);
  assert.equal((await table.view(dmToken)).shop, false);
  assert.equal(await table.setShop(dmToken, { open: true }), true);
});

test("the worker routes shop, buy back, and pages", async () => {
  const env = envFor(new TableRoom(memoryStorage()));
  const opened = await call(env, "POST", "/api/rooms");
  assert.equal(opened.status, 201);
  const { code, dmToken } = opened.body;
  assert.equal(dmToken.length, 32);
  const joined = await call(env, "POST", `/api/rooms/${code}/join`, { name: "Mara" });
  assert.equal(joined.status, 200);
  const counter = await call(env, "POST", `/api/rooms/${code}/shop`, {
    open: true,
    name: "Apothecary",
    stall: "apothecary",
    goods: [{ id: "potion-of-healing", name: "Potion of healing", cp: 5000, service: false }],
  }, dmToken);
  assert.equal(counter.status, 200);
  assert.equal(counter.body.shop.name, "Apothecary");
  const sale = await call(env, "POST", `/api/rooms/${code}/buyback`, {
    action: "sell",
    id: "potion-of-healing",
    cp: 2500,
  }, joined.body.token);
  assert.equal(sale.status, 200);
  assert.equal(sale.body.buybacks[0].cp, 2500);
  const view = await call(env, "GET", `/api/rooms/${code}`, undefined, joined.body.token);
  assert.equal(view.body.buybacks[0].seller, "Mara");
  const locked = await call(env, "GET", `/api/rooms/${code}`);
  assert.equal(locked.body.locked, true);
  assert.equal(locked.body.players.length, 0);
  const page = await handleRequest(new Request("https://lantern.azraelsmods.com/player"), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "page");
  const closed = await call(env, "POST", `/api/rooms/${code}/shop`, { open: false }, dmToken);
  assert.equal(closed.status, 200);
  assert.equal(closed.body.shop, false);
  const after = await call(env, "GET", `/api/rooms/${code}`, undefined, dmToken);
  assert.deepEqual(after.body.buybacks, []);
});

test("only the DM can ask a seat for a roll", async () => {
  const room = new TableRoom(memoryStorage());
  const dmToken = await room.create();
  const mara = await room.join("", { name: "Mara" });
  const asked = await room.talk(dmToken, { text: "Roll Stealth.", to: "Mara", ask: " Stealth " });
  assert.equal(asked.ask, "Stealth");
  assert.equal(asked.from, DM_NAME);
  const plain = await room.talk(dmToken, { text: "Quiet now.", to: "" });
  assert.equal("ask" in plain, false);
  await assert.rejects(
    () => room.talk(mara.token, { text: "Roll.", to: "", ask: "Stealth" }),
    TableError,
  );
  const view = await room.view(mara.token);
  assert.equal(view.messages[0].ask, "Stealth");
});

test("a player rolls initiative onto the shared order and a second roll updates that seat", async () => {
  const { table, dmToken, mara } = await openedRoom();
  const ivo = await table.join("", { name: "Ivo" });
  await assert.rejects(
    () => table.rollInitiative(dmToken, { name: "Mara", init: 15, bonus: 2, die: 13, hp: 12, maxHp: 12, ac: 16 }),
    TableError,
  );
  await table.setOrder(dmToken, {
    round: 2,
    started: true,
    activeId: "guard",
    combatants: [
      { id: "mara", name: "Mara", seat: "Mara", init: 4, bonus: 2, hp: 12, maxHp: 12, ac: 16, marks: ["concentrating"], order: 1 },
      { id: "guard", name: "Guard", seat: "", init: 11, bonus: 1, hp: 11, maxHp: 11, ac: 16, order: 2 },
    ],
  });
  const rolled = await table.rollInitiative(mara.token, {
    name: "Mara",
    init: 17,
    bonus: 2,
    die: 15,
    hp: 12,
    maxHp: 12,
    ac: 16,
  });
  assert.equal(rolled.round, 2);
  assert.equal(rolled.started, true);
  assert.equal(rolled.activeId, "guard");
  assert.equal(rolled.combatants.length, 2);
  const maraRow = rolled.combatants.find((person) => person.id === "mara");
  assert.equal(maraRow.init, 17);
  assert.equal(maraRow.die, 15);
  assert.equal(maraRow.seat, "Mara");
  assert.deepEqual(maraRow.marks, ["concentrating"]);
  assert.equal(rolled.combatants.find((person) => person.id === "guard").init, 11);
  const again = await table.rollInitiative(mara.token, {
    name: "Mara",
    init: 9,
    bonus: 2,
    die: 7,
    hp: 8,
    maxHp: 12,
    ac: 15,
  });
  assert.equal(again.combatants.length, 2);
  assert.equal(again.combatants.find((person) => person.id === "mara").init, 9);
  assert.equal(again.combatants.find((person) => person.id === "mara").hp, 8);
  const joined = await table.rollInitiative(ivo.token, {
    name: "Ivo",
    init: 14,
    bonus: 1,
    die: 13,
    hp: 10,
    maxHp: 10,
    ac: 14,
  });
  assert.equal(joined.combatants.length, 3);
  assert.equal(joined.combatants.find((person) => person.seat === "Ivo").init, 14);
  assert.equal(joined.combatants.find((person) => person.seat === "Mara").init, 9);
  const renamed = await table.rollInitiative(ivo.token, {
    name: "Mara",
    init: 1,
    bonus: 0,
    die: 1,
    hp: 10,
    maxHp: 10,
    ac: 14,
  });
  assert.equal(renamed.combatants.find((person) => person.seat === "Mara").init, 9);
  assert.equal(renamed.combatants.find((person) => person.seat === "Ivo").init, 1);
  await assert.rejects(() => table.setOrder(mara.token, renamed), TableError);
  await assert.rejects(
    () => table.rollInitiative(mara.token, { name: "  ", init: 10, bonus: 0, die: 10, hp: 1, maxHp: 1, ac: 10 }),
    TableError,
  );
});

test("the initiative route adds only the caller's row", async () => {
  const table = new TableRoom(memoryStorage());
  const env = envFor(table);
  const opened = await call(env, "POST", "/api/rooms");
  const { code, dmToken } = opened.body;
  const joined = await call(env, "POST", `/api/rooms/${code}/join`, { name: "Mara" });
  const denied = await call(env, "POST", `/api/rooms/${code}/initiative`, {
    name: "Mara",
    init: 12,
    bonus: 2,
    die: 10,
    hp: 9,
    maxHp: 12,
    ac: 14,
  }, dmToken);
  assert.equal(denied.status, 400);
  const posted = await call(env, "POST", `/api/rooms/${code}/initiative`, {
    name: "Mara",
    init: 12,
    bonus: 2,
    die: 10,
    hp: 9,
    maxHp: 12,
    ac: 14,
  }, joined.body.token);
  assert.equal(posted.status, 200);
  assert.equal(posted.body.order.combatants.length, 1);
  assert.equal(posted.body.order.combatants[0].init, 12);
  assert.equal(posted.body.order.combatants[0].seat, "Mara");
  const view = await call(env, "GET", `/api/rooms/${code}`, undefined, dmToken);
  assert.equal(view.body.order.combatants[0].name, "Mara");
});

test("the DM owns the order and a player can only change their own hit points", async () => {
  const { table, dmToken, mara } = await openedRoom();
  const order = await table.setOrder(dmToken, {
    round: 1,
    started: true,
    activeId: "mara",
    combatants: [{
      id: "mara",
      name: "Mara",
      seat: "Mara",
      init: 14,
      bonus: 2,
      hp: 12,
      maxHp: 12,
      ac: 16,
      marks: [],
      exhaustion: 0,
      order: 1,
    }],
  });
  assert.equal(order.combatants[0].hp, 12);
  await assert.rejects(() => table.setOrder(mara.token, order), TableError);
  const next = await table.setVitals(mara.token, { hp: 7, maxHp: 12, ac: 16 });
  assert.equal(next.combatants[0].hp, 7);
  assert.equal((await table.view(dmToken)).order.combatants[0].name, "Mara");
});

test("a secret roll reaches the DM and the roller, not the other players", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  const bram = await room.join("", { name: "Bram" });
  await room.update(mara.token, { summaries: ["Rolled 12 for Stealth.", { text: "Rolled 19 for Insight.", secret: true }] });
  const dmView = await room.view(dm);
  assert.equal(dmView.events.length, 2);
  assert.equal(dmView.events.find((event) => event.secret).summary, "Rolled 19 for Insight.");
  assert.equal((await room.view(mara.token)).events.length, 2);
  const other = await room.view(bram.token);
  assert.deepEqual(other.events.map((event) => event.summary), ["Rolled 12 for Stealth."]);
});

test("a player sets their own conditions on the order", async () => {
  const room = new TableRoom(memoryStorage());
  await room.create();
  const mara = await room.join("", { name: "Mara" });
  await room.rollInitiative(mara.token, { name: "Mara", init: 12, hp: 10, maxHp: 10 });
  const order = await room.setVitals(mara.token, { marks: ["prone", "concentrating", "made-up"] });
  assert.deepEqual(order.combatants[0].marks, ["prone", "concentrating"]);
});

test("the party board keeps notes, quests, a glossary, and a stash", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  await room.board(mara.token, { op: "notes", text: "Owe the ferryman" });
  let { board } = await room.board(mara.token, { op: "quest-add", title: "Find the mill" });
  await room.board(mara.token, { op: "quest-toggle", id: board.quests[0].id });
  await room.board(dm, { op: "glossary-add", name: "Old Wend", body: "Ferryman" });
  await room.board(mara.token, { op: "glossary-add", name: "old wend", body: "Lies about tolls" });
  await room.board(mara.token, { op: "stash-put", name: "Rope", gearId: "rope", qty: 2 });
  await room.board(mara.token, { op: "coin-put", cp: 1000 });
  board = (await room.view(mara.token)).board;
  assert.equal(board.notes.text, "Owe the ferryman");
  assert.equal(board.notes.by, "Mara");
  assert.equal(board.quests[0].done, true);
  assert.equal(board.glossary.length, 1);
  assert.equal(board.glossary[0].body, "Lies about tolls");
  const took = await room.board(mara.token, { op: "stash-take", id: board.stash.items[0].id });
  assert.deepEqual(took.taken, { name: "Rope", gearId: "rope" });
  await assert.rejects(room.board(mara.token, { op: "coin-take", cp: 5000 }), TableError);
  assert.equal((await room.board(mara.token, { op: "coin-take", cp: 400 })).board.stash.cp, 600);
  const loot = await room.board(dm, { op: "stash-put", name: "Cloak of Protection" });
  assert.equal(loot.board.stash.items.at(-1).by, "Dungeon Master");
  await assert.rejects(room.board(dm, { op: "stash-take", id: loot.board.stash.items.at(-1).id }), TableError);
});

test("polls, ready checks, and the X-card", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  const bram = await room.join("", { name: "Bram" });
  await assert.rejects(room.board(mara.token, { op: "poll-open", question: "When?", options: ["Friday"] }), TableError);
  await room.board(mara.token, { op: "poll-open", question: "When?", options: ["Friday", "Saturday"] });
  await room.board(bram.token, { op: "poll-vote", option: "1" });
  let { board } = await room.board(mara.token, { op: "poll-vote", option: "1" });
  assert.deepEqual(board.poll.options[1].votes, ["Bram", "Mara"]);
  ({ board } = await room.board(mara.token, { op: "poll-vote", option: "1" }));
  assert.deepEqual(board.poll.options[1].votes, ["Bram"]);
  await room.board(mara.token, { op: "ready-call" });
  ({ board } = await room.board(bram.token, { op: "ready-answer", answer: "wait" }));
  assert.deepEqual(board.ready.answers, { Mara: "ready", Bram: "wait" });
  ({ board } = await room.board(bram.token, { op: "xcard" }));
  assert.deepEqual(Object.keys(board.xcard), ["at"]);
  assert.ok((await room.view(dm)).board.xcard);
  await room.board(dm, { op: "xcard-clear" });
  assert.equal((await room.view(mara.token)).board.xcard, null);
});

test("help is seen by the two players in it and cleared once used", async () => {
  const room = new TableRoom(memoryStorage());
  await room.create();
  const mara = await room.join("", { name: "Mara" });
  const bram = await room.join("", { name: "Bram" });
  const cora = await room.join("", { name: "Cora" });
  await assert.rejects(room.board(mara.token, { op: "help", to: "Mara" }), TableError);
  await room.board(mara.token, { op: "help", to: "Bram" });
  assert.equal((await room.view(bram.token)).board.helps.length, 1);
  assert.equal((await room.view(cora.token)).board.helps.length, 0);
  await room.board(bram.token, { op: "help-used" });
  assert.equal((await room.view(bram.token)).board.helps.length, 0);
});

test("reactions, pins, voice, and typing ride on the messages", async () => {
  const room = new TableRoom(memoryStorage());
  await room.create();
  const mara = await room.join("", { name: "Mara" });
  const bram = await room.join("", { name: "Bram" });
  const said = await room.talk(mara.token, { text: "draws her blade", kind: "emote", as: "Mara the Bold" });
  assert.equal(said.kind, "emote");
  assert.equal(said.as, "Mara the Bold");
  const ooc = await room.talk(mara.token, { text: "brb", kind: "ooc", as: "Mara the Bold" });
  assert.equal(ooc.as, undefined);
  await room.board(bram.token, { op: "react", id: said.id, emoji: "😮" });
  await assert.rejects(room.board(bram.token, { op: "react", id: said.id, emoji: "🦄" }), TableError);
  await room.board(bram.token, { op: "pin", id: said.id, on: true });
  await room.board(bram.token, { op: "typing" });
  const view = await room.view(mara.token);
  assert.deepEqual(view.messages[0].reactions, { "😮": ["Bram"] });
  assert.equal(view.messages[0].pinned, true);
  assert.ok(view.players.find((player) => player.name === "Bram").typing > 0);
  const whisper = await room.talk(mara.token, { text: "psst", to: "Dungeon Master" });
  await assert.rejects(room.board(bram.token, { op: "react", id: whisper.id, emoji: "👍" }), TableError);
});

test("a player ends only their own turn", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  const bram = await room.join("", { name: "Bram" });
  await room.rollInitiative(mara.token, { name: "Mara", init: 18, hp: 10 });
  let order = await room.rollInitiative(bram.token, { name: "Bram", init: 9, hp: 10 });
  const first = order.combatants.find((person) => person.seat === "Mara");
  await room.setOrder(dm, { ...order, started: true, activeId: first.id });
  await assert.rejects(room.board(bram.token, { op: "end-turn" }), TableError);
  ({ order } = await room.board(mara.token, { op: "end-turn" }));
  assert.equal(order.combatants.find((person) => person.id === order.activeId).seat, "Bram");
  ({ order } = await room.board(bram.token, { op: "end-turn" }));
  assert.equal(order.round, 2);
});

test("hidden rows stay off player views and the DM keeps them", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  await room.setOrder(dm, {
    started: true,
    activeId: "g1",
    combatants: [
      { id: "g1", name: "Ghost", init: 15, hp: 10, hidden: true, attacks: [{ name: "Touch", hit: 5, damage: "4d6" }] },
      { id: "o1", name: "Orc", init: 9, hp: 15, mods: { str: 3 } },
    ],
  });
  const player = await room.view(mara.token);
  assert.deepEqual(player.order.combatants.map((person) => person.name), ["Orc"]);
  assert.equal(player.order.hiddenTurn, true);
  assert.equal(player.order.combatants[0].mods, undefined);
  const theirs = await room.view(dm);
  assert.equal(theirs.order.combatants.length, 2);
  assert.equal(theirs.order.combatants[0].attacks[0].damage, "4d6");
  const vitals = await room.rollInitiative(mara.token, { name: "Mara", init: 12, hp: 10 });
  assert.ok(!vitals.combatants.some((person) => person.name === "Ghost"));
});

test("answers to an ask carry its id and total, and the DM can roll for a player", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  const ask = await room.talk(dm, { text: "Roll Stealth (DC 13).", ask: "Stealth", dc: 13 });
  assert.equal(ask.dc, 13);
  await assert.rejects(room.talk(mara.token, { text: "x", ask: "Stealth" }), TableError);
  await room.update(mara.token, { summaries: [{ text: "Rolled 15 for Stealth.", ask: ask.id, total: 15 }] });
  await assert.rejects(room.board(mara.token, { op: "dm-roll", name: "Mara", text: "x" }), TableError);
  await room.board(dm, { op: "dm-roll", name: "Mara", text: "The DM rolled Stealth for Mara: 9.", ask: ask.id, total: 9 });
  const view = await room.view(dm);
  const answers = view.events.filter((event) => event.ask === ask.id);
  assert.deepEqual(answers.map((event) => event.total), [9, 15]);
  assert.equal(answers[0].by, DM_NAME);
});

test("rewards, handouts, hidden entries, the world, and deals", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  const bram = await room.join("", { name: "Bram" });
  await assert.rejects(room.board(mara.token, { op: "gift", kind: "coin", cp: 100 }), TableError);
  await room.board(dm, { op: "gift", kind: "inspiration", to: "Mara", reason: "Good plan" });
  await room.board(dm, { op: "gift", kind: "xp", xp: 100 });
  let view = await room.view(mara.token);
  assert.equal(view.board.gifts.length, 2);
  assert.equal((await room.view(bram.token)).board.gifts.length, 1);
  assert.ok(view.events.some((event) => event.summary === "The DM gave Mara inspiration: Good plan"));
  const taken = await room.board(mara.token, { op: "gift-take", id: view.board.gifts[0].id });
  assert.equal(taken.gift.kind, "inspiration");
  await assert.rejects(room.board(bram.token, { op: "gift-take", id: view.board.gifts[1].id }), TableError);

  await room.board(dm, { op: "handout", title: "Letter", text: "Meet at dawn.", to: "Bram" });
  view = await room.view(mara.token);
  assert.equal(view.board.handouts.length, 0);
  const bramView = await room.view(bram.token);
  const got = await room.board(bram.token, { op: "handout-get", id: bramView.board.handouts[0].id });
  assert.equal(got.handout.text, "Meet at dawn.");
  await assert.rejects(room.board(mara.token, { op: "handout-get", id: bramView.board.handouts[0].id }), TableError);

  await room.board(dm, { op: "quest-add", title: "The secret door", hidden: true });
  await room.board(mara.token, { op: "quest-add", title: "Buy rope", hidden: true });
  await room.board(dm, { op: "glossary-add", name: "The Pale King", hidden: true });
  view = await room.view(mara.token);
  assert.deepEqual(view.board.quests.map((quest) => quest.title), ["Buy rope"]);
  assert.equal(view.board.glossary.length, 0);
  const full = await room.view(dm);
  await room.board(dm, { op: "glossary-reveal", id: full.board.glossary[0].id });
  assert.equal((await room.view(mara.token)).board.glossary.length, 1);

  await room.board(dm, { op: "world", day: 3, hour: 19, weather: "Fog" });
  assert.deepEqual({ ...(await room.view(bram.token)).board.world, at: 0 }, { day: 3, hour: 19, weather: "Fog", at: 0 });

  await room.setShop(dm, { open: true, name: "Smith", goods: [], deals: { Mara: -20, Bram: 10 } });
  assert.deepEqual((await room.view(mara.token)).shop.deals, { Mara: -20 });
  assert.deepEqual((await room.view(dm)).shop.deals, { Mara: -20, Bram: 10 });

  await assert.rejects(room.talk(mara.token, { text: "Hear ye", kind: "read" }), TableError);
  const read = await room.talk(dm, { text: "The door creaks.", kind: "read" });
  assert.equal(read.kind, "read");
});

test("pause, mood, chat control, safety, the X-card log, the next session, and seats", async () => {
  const room = new TableRoom(memoryStorage());
  const dm = await room.create();
  const mara = await room.join("", { name: "Mara" });
  await room.join("", { name: "Bram" });
  await assert.rejects(room.board(mara.token, { op: "pause" }), TableError);
  await room.board(dm, { op: "pause", text: "Snacks" });
  await room.board(dm, { op: "mood", label: "Storm" });
  await room.board(dm, { op: "safety", lines: "spiders\ndrowning", veils: "torture" });
  await room.board(dm, { op: "rules", text: "Crits roll max plus a die." });
  await room.board(dm, { op: "next", at: 1800000000000, label: "Night 5" });
  await room.board(mara.token, { op: "xcard" });
  let view = await room.view(mara.token);
  assert.equal(view.board.pause.text, "Snacks");
  assert.equal(view.board.mood.label, "Storm");
  assert.deepEqual(view.board.safety, { lines: ["spiders", "drowning"], veils: ["torture"] });
  assert.equal(view.board.next.label, "Night 5");
  assert.deepEqual(view.board.xlog, []);
  assert.equal((await room.view(dm)).board.xlog.length, 1);

  await room.board(dm, { op: "chat-mode", mode: "muted" });
  await assert.rejects(room.talk(mara.token, { text: "hi" }), TableError);
  await room.talk(mara.token, { text: "brb", to: DM_NAME });
  await room.board(dm, { op: "chat-mode", mode: "slow", slow: 60 });
  await room.talk(mara.token, { text: "one" });
  await assert.rejects(room.talk(mara.token, { text: "two" }), TableError);
  await room.talk(dm, { text: "The DM is never slowed." });

  const link = await room.board(dm, { op: "seat-link", name: "Mara" });
  assert.equal(link.token, mara.token);
  await room.board(dm, { op: "seat-rename", name: "Mara", to: "Mira" });
  assert.equal((await room.view(mara.token)).players.some((player) => player.name === "Mira"), true);
  await assert.rejects(room.board(dm, { op: "seat-rename", name: "Mira", to: "Bram" }), TableError);
  await room.board(dm, { op: "seat-kick", name: "Mira" });
  assert.equal((await room.view(mara.token)).locked, true);
  assert.deepEqual((await room.view(dm)).players.map((player) => player.name), ["Bram"]);
});
