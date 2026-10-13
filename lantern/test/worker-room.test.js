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
