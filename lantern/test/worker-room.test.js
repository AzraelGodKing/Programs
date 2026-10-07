import assert from "node:assert/strict";
import test from "node:test";
import { DM_NAME, TableError, TableRoom, cleanTalk } from "../worker/room.js";
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

async function call(env, method, path, payload) {
  const response = await handleRequest(new Request(`https://lantern.azraelsmods.com${path}`, {
    method,
    headers: payload === undefined ? {} : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }), env);
  return { status: response.status, body: await response.json().catch(() => null), response };
}

test("a sale can be bought back until the shop closes", async () => {
  const table = new TableRoom(memoryStorage());
  assert.equal(await table.create(), true);
  await table.setShop({
    open: true,
    name: "Smith",
    stall: "smith",
    goods: [{ id: "longsword", name: "Longsword", cp: 1500, service: false }],
  });
  const sold = await table.tradeBuyback({ name: "Mara", action: "sell", id: "longsword", cp: 750 });
  await table.tradeBuyback({ name: "Mara", action: "sell", id: "longsword", cp: 750 });
  assert.equal(sold[0].qty, 1);
  const stacked = await table.view();
  assert.equal(stacked.buybacks[0].qty, 2);
  await assert.rejects(
    () => table.tradeBuyback({ name: "Ivo", action: "buy", id: "longsword", cp: 750 }),
    (error) => error instanceof TableError && error.message === "That is no longer held for buy back.",
  );
  await table.setShop({ open: true, name: "Tavern", stall: "tavern", goods: [] });
  assert.equal((await table.view()).buybacks[0].qty, 2);
  const bought = await table.tradeBuyback({ name: "Mara", action: "buy", id: "longsword", cp: 750 });
  assert.equal(bought[0].qty, 1);
  await table.setShop({ open: false, name: "Tavern", stall: "tavern", goods: [] });
  assert.deepEqual((await table.view()).buybacks, []);
  await assert.rejects(
    () => table.tradeBuyback({ name: "Mara", action: "buy", id: "longsword", cp: 750 }),
    (error) => error instanceof TableError && error.message === "The shop is closed.",
  );
  await table.setShop({ open: true, name: "Smith", stall: "smith", goods: [] });
  assert.deepEqual((await table.view()).buybacks, []);
});

test("a boolean shop switch still closes the counter", async () => {
  const table = new TableRoom(memoryStorage());
  await table.create();
  assert.equal(await table.setShop({ open: false }), false);
  assert.equal((await table.view()).shop, false);
  assert.equal(await table.setShop({ open: true }), true);
});

test("the worker routes shop, buy back, and pages", async () => {
  const env = envFor(new TableRoom(memoryStorage()));
  const opened = await call(env, "POST", "/api/rooms");
  assert.equal(opened.status, 201);
  const code = opened.body.code;
  const counter = await call(env, "POST", `/api/rooms/${code}/shop`, {
    open: true,
    name: "Apothecary",
    stall: "apothecary",
    goods: [{ id: "potion-of-healing", name: "Potion of healing", cp: 5000, service: false }],
  });
  assert.equal(counter.status, 200);
  assert.equal(counter.body.shop.name, "Apothecary");
  const sale = await call(env, "POST", `/api/rooms/${code}/buyback`, {
    name: "Mara",
    action: "sell",
    id: "potion-of-healing",
    cp: 2500,
  });
  assert.equal(sale.status, 200);
  assert.equal(sale.body.buybacks[0].cp, 2500);
  const view = await call(env, "GET", `/api/rooms/${code}?as=Mara`);
  assert.equal(view.body.buybacks[0].seller, "Mara");
  const page = await handleRequest(new Request("https://lantern.azraelsmods.com/player"), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "page");
  const closed = await call(env, "POST", `/api/rooms/${code}/shop`, { open: false });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.shop, false);
  const after = await call(env, "GET", `/api/rooms/${code}`);
  assert.deepEqual(after.body.buybacks, []);
});

test("only the DM can ask a seat for a roll", async () => {
  const room = new TableRoom(memoryStorage());
  await room.create();
  const asked = await room.talk(cleanTalk({ name: DM_NAME, text: "Roll Stealth.", to: "Mara", ask: " Stealth " }));
  assert.equal(asked.ask, "Stealth");
  const plain = await room.talk(cleanTalk({ name: DM_NAME, text: "Quiet now.", to: "" }));
  assert.equal("ask" in plain, false);
  assert.throws(() => cleanTalk({ name: "Mara", text: "Roll.", to: "", ask: "Stealth" }), TableError);
  const view = await room.view("Mara");
  assert.equal(view.messages[0].ask, "Stealth");
});
