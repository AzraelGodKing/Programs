/** Shared table rules. The local server and the Worker both use this module. */

import { blankDeath, blankOrder, cleanOrder, sortOrder } from "../src/order.js";
import { MARKS } from "../src/marks.js";

export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const EVENT_CAP = 500;
export const SUMMARY_CAP = 20;
export const SUMMARY_LENGTH = 300;
export const NAME_LENGTH = 40;
export const INTENT_LENGTH = 60;
export const SNAPSHOT_BYTES = 200_000;
export const BODY_BYTES = 300_000;
export const MESSAGE_CAP = 200;
export const MESSAGE_LENGTH = 400;
export const DM_NAME = "Dungeon Master";
export const IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const GOODS_CAP = 60;
const BUYBACK_CAP = 60;
const PRICE_CAP = 10_000_000;

export class TableError extends Error {}

export function collapse(value) {
  return value.split(/\s+/).filter(Boolean).join(" ");
}

export function cleanName(value) {
  if (typeof value !== "string") throw new TableError("A name is required.");
  const name = collapse(value).slice(0, NAME_LENGTH);
  if (!name) throw new TableError("A name is required.");
  return name;
}

export function cleanIntent(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new TableError("The roll note has to be text.");
  return collapse(value).slice(0, INTENT_LENGTH);
}

export function cleanSummaries(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") value = [value];
  if (!Array.isArray(value)) throw new TableError("The activity log has to be a list.");
  const summaries = [];
  for (const item of value.slice(0, SUMMARY_CAP)) {
    const raw = typeof item === "string" ? item : item && typeof item === "object" && typeof item.text === "string" ? item.text : null;
    if (raw === null) continue;
    const text = collapse(raw).slice(0, SUMMARY_LENGTH);
    if (!text) continue;
    summaries.push(typeof item === "object" && item.secret === true ? { text, secret: true } : text);
  }
  return summaries;
}

export function cleanUpdate(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TableError("Expected an object.");
  }
  const name = cleanName(payload.name);
  const summaries = cleanSummaries(payload.summaries);
  const intent = cleanIntent(payload.intent);
  const snapshot = payload.snapshot === undefined ? {} : payload.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TableError("The table snapshot has to be an object.");
  }
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > SNAPSHOT_BYTES) {
    throw new TableError("That update is too large.");
  }
  return { name, summaries, intent, snapshot };
}

export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validToken(token) {
  return typeof token === "string" && /^[a-f0-9]{32}$/.test(token);
}

export function validCode(code) {
  return typeof code === "string" && /^[A-Z0-9]{4}$/.test(code);
}

export function cleanViewer(value) {
  if (typeof value !== "string") return "";
  return collapse(value).slice(0, NAME_LENGTH);
}

export function cleanMessage(value) {
  if (typeof value !== "string") throw new TableError("A message has to be text.");
  const text = collapse(value).slice(0, MESSAGE_LENGTH);
  if (!text) throw new TableError("Write a message first.");
  return text;
}

export function cleanTarget(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new TableError("Whisper a name, or leave it open to the table.");
  return collapse(value).slice(0, NAME_LENGTH);
}

export function messageVisible(message, viewer) {
  const target = message.to || "";
  if (!target) return true;
  if (!viewer) return false;
  return message.from === viewer || target === viewer;
}

export function cleanTalk(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TableError("Expected an object.");
  }
  const name = cleanName(payload.name);
  const text = cleanMessage(payload.text);
  const to = cleanTarget(payload.to);
  if (to === name) throw new TableError("Whisper someone else.");
  const ask = cleanAsk(payload.ask, name);
  const kind = TALK_KINDS.includes(payload.kind) ? payload.kind : "";
  const as = typeof payload.as === "string" ? collapse(payload.as).slice(0, 80) : "";
  const message = { name, text, to };
  if (ask) message.ask = ask;
  if (kind) message.kind = kind;
  if (as && kind !== "ooc") message.as = as;
  return message;
}

export const TALK_KINDS = ["ic", "ooc", "emote"];
export const REACTIONS = ["👍", "😂", "😮", "💀", "❤️", "🎲"];
const BOARD_LIST_CAP = 60;
const HELP_MS = 10 * 60 * 1000;
const XCARD_MS = 30 * 60 * 1000;

export function blankBoard() {
  return {
    notes: { text: "", by: "", at: 0 },
    glossary: [],
    quests: [],
    stash: { items: [], cp: 0 },
    poll: null,
    ready: null,
    xcard: null,
    helps: [],
  };
}

function boardText(value, max, what) {
  if (typeof value !== "string") throw new TableError(`${what} has to be text.`);
  const text = collapse(value).slice(0, max);
  if (!text) throw new TableError(`${what} is empty.`);
  return text;
}

function boardId(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{16}$/.test(value)) throw new TableError("That is not on the board.");
  return value;
}

function cleanBoard(raw) {
  const board = { ...blankBoard(), ...(raw && typeof raw === "object" ? raw : {}) };
  board.helps = (board.helps || []).filter((help) => Date.now() - help.at < HELP_MS);
  if (board.xcard && Date.now() - board.xcard.at > XCARD_MS) board.xcard = null;
  return board;
}

/** A roll the DM asks for, like "Perception" or "Dexterity save". Only the DM can ask. */
export function cleanAsk(value, name) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new TableError("Ask for a roll by name.");
  if (name !== DM_NAME) throw new TableError("Only the DM asks for rolls.");
  return collapse(value).slice(0, INTENT_LENGTH);
}

export function shopIsOpen(shop) {
  if (shop && typeof shop === "object" && !Array.isArray(shop)) return shop.open !== false;
  return shop !== false;
}

function cleanPrice(value) {
  return Number.isInteger(value) && value >= 0 && value <= PRICE_CAP;
}

export function cleanShop(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TableError("Expected an object.");
  }
  const open = payload.open;
  if (typeof open !== "boolean") throw new TableError("The shop switch has to be on or off.");
  if (!("goods" in payload) && !("name" in payload) && !("stall" in payload)) return open;
  if (typeof payload.name !== "string" && payload.name !== undefined) {
    throw new TableError("The shop needs a name.");
  }
  const name = typeof payload.name === "string" ? collapse(payload.name).slice(0, 40) : "";
  let stall = "";
  if (typeof payload.stall === "string" && /^[a-z0-9-]{0,20}$/.test(payload.stall.trim())) {
    stall = payload.stall.trim();
  }
  if (!Array.isArray(payload.goods)) throw new TableError("The counter has to be a list.");
  const goods = [];
  const seen = new Set();
  for (const raw of payload.goods) {
    if (goods.length === GOODS_CAP) break;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    if (typeof raw.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(raw.id) || seen.has(raw.id)) continue;
    if (typeof raw.name !== "string") continue;
    const label = collapse(raw.name).slice(0, 60);
    if (!label || !cleanPrice(raw.cp)) continue;
    goods.push({ id: raw.id, name: label, cp: raw.cp, service: raw.service === true });
    seen.add(raw.id);
  }
  return { open, name: name || "Shop", stall, goods };
}

export function cleanBuyback(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TableError("Expected an object.");
  }
  const name = cleanName(payload.name);
  if (payload.action !== "sell" && payload.action !== "buy") {
    throw new TableError("Say whether this is a sale or a buy back.");
  }
  if (typeof payload.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(payload.id)) {
    throw new TableError("That is not on the counter.");
  }
  if (!cleanPrice(payload.cp)) throw new TableError("That price is not a price.");
  return { name, action: payload.action, id: payload.id, cp: payload.cp };
}

function hexId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export class TableRoom {
  constructor(storage) {
    this.storage = storage;
  }

  async role(token) {
    const meta = await this.storage.get("meta");
    if (!meta) return null;
    if (validToken(token) && token === meta.dmToken) return { role: "dm", name: DM_NAME };
    if (!validToken(token)) return null;
    const seat = await this.storage.get(`seat:${token}`);
    if (!seat) return null;
    return { role: "player", name: seat.name, token };
  }

  async create() {
    if (await this.storage.get("meta")) return null;
    const now = Date.now();
    const dmToken = randomToken();
    await this.storage.put({
      meta: { created: now, dmToken },
      events: [],
      shop: true,
      messages: [],
      buybacks: [],
      order: blankOrder(),
    });
    await this.storage.setAlarm(now + IDLE_MS);
    return dmToken;
  }

  async join(token, payload) {
    if (!await this.storage.get("meta")) return null;
    if (validToken(token)) {
      const existing = await this.storage.get(`seat:${token}`);
      if (existing) return { token, name: existing.name };
    }
    const name = cleanName(payload?.name);
    if (name.toLowerCase() === DM_NAME.toLowerCase()) {
      throw new TableError("That name is the DM's. Pick another.");
    }
    const stored = await this.storage.list({ prefix: "seat:" });
    for (const seat of stored.values()) {
      if (seat.name.toLowerCase() === name.toLowerCase()) {
        throw new TableError("That name is already at the table.");
      }
    }
    const seatToken = randomToken();
    const now = Date.now();
    await this.storage.put(`seat:${seatToken}`, {
      name,
      seen: now,
      intent: "",
      snapshot: {},
    });
    await this.storage.setAlarm(now + IDLE_MS);
    return { token: seatToken, name };
  }

  async view(token = "") {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    const storedShop = await this.storage.get("shop");
    const shop = storedShop === undefined || storedShop === null ? true : storedShop;
    const order = cleanOrder((await this.storage.get("order")) || blankOrder());
    if (!who) {
      return {
        locked: true,
        events: [],
        players: [],
        shop,
        buybacks: [],
        messages: [],
        board: blankBoard(),
        order: blankOrder(),
      };
    }
    const events = ((await this.storage.get("events")) || [])
      .filter((event) => !event.secret || who.role === "dm" || event.name === who.name);
    const stored = await this.storage.list({ prefix: "seat:" });
    const players = [...stored.values()]
      .map((seat) => ({
        name: seat.name,
        seen: seat.seen,
        typing: seat.typing || 0,
        intent: seat.intent || "",
        snapshot: seat.snapshot || {},
      }))
      .sort((a, b) => b.seen - a.seen);
    const messages = ((await this.storage.get("messages")) || []).filter((message) => messageVisible(message, who.name));
    const buybacks = shopIsOpen(shop) ? ((await this.storage.get("buybacks")) || []) : [];
    const board = cleanBoard(await this.storage.get("board"));
    board.helps = board.helps.filter((help) => who.role === "dm" || help.to === who.name || help.from === who.name);
    return {
      events: [...events].reverse(),
      board,
      players,
      shop,
      buybacks: buybacks.map((line) => ({ ...line })),
      messages,
      order,
      locked: false,
    };
  }

  async update(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who || who.role !== "player") throw new TableError("Sit down before you share the night.");
    const update = cleanUpdate({ ...payload, name: who.name });
    const now = Date.now();
    const writes = {
      [`seat:${token}`]: {
        name: who.name,
        seen: now,
        typing: (await this.storage.get(`seat:${token}`))?.typing || 0,
        intent: update.intent,
        snapshot: update.snapshot,
      },
    };
    if (update.summaries.length) {
      let events = (await this.storage.get("events")) || [];
      for (const summary of update.summaries) {
        if (typeof summary === "string") events.push({ id: hexId(), at: now, name: who.name, summary });
        else events.push({ id: hexId(), at: now, name: who.name, summary: summary.text, secret: true });
      }
      if (events.length > EVENT_CAP) events = events.slice(-EVENT_CAP);
      writes.events = events;
    }
    await this.storage.put(writes);
    await this.storage.setAlarm(now + IDLE_MS);
    const view = await this.view(token);
    return { shop: view.shop, order: view.order };
  }

  async setShop(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who || who.role !== "dm") throw new TableError("Only the DM sets the shop.");
    const shop = cleanShop(payload);
    const writes = { shop };
    if (!shopIsOpen(shop)) writes.buybacks = [];
    await this.storage.put(writes);
    await this.storage.setAlarm(Date.now() + IDLE_MS);
    return shop;
  }

  async tradeBuyback(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who || who.role !== "player") throw new TableError("Sit down before you trade.");
    const trade = cleanBuyback({ ...payload, name: who.name });
    const storedShop = await this.storage.get("shop");
    const shop = storedShop === undefined || storedShop === null ? true : storedShop;
    if (!shopIsOpen(shop)) throw new TableError("The shop is closed.");
    const lines = clone((await this.storage.get("buybacks")) || []);
    const found = lines.find((line) => line.seller === trade.name && line.id === trade.id && line.cp === trade.cp);
    if (trade.action === "sell") {
      if (found) found.qty = Math.min(99, found.qty + 1);
      else if (lines.length >= BUYBACK_CAP) throw new TableError("The counter is holding too much.");
      else lines.push({ id: trade.id, seller: trade.name, cp: trade.cp, qty: 1 });
    } else if (!found || found.qty < 1) {
      throw new TableError("That is no longer held for buy back.");
    } else {
      found.qty -= 1;
      if (found.qty <= 0) lines.splice(lines.indexOf(found), 1);
    }
    await this.storage.put("buybacks", lines);
    await this.storage.setAlarm(Date.now() + IDLE_MS);
    return lines.map((line) => ({ ...line }));
  }

  async talk(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who) throw new TableError("Sit down before you speak.");
    const message = cleanTalk({ ...payload, name: who.name });
    const now = Date.now();
    let messages = (await this.storage.get("messages")) || [];
    const stored = { id: hexId(), at: now, from: message.name, to: message.to, text: message.text };
    if (message.ask) stored.ask = message.ask;
    if (message.kind) stored.kind = message.kind;
    if (message.as) stored.as = message.as;
    messages.push(stored);
    if (messages.length > MESSAGE_CAP) messages = messages.slice(-MESSAGE_CAP);
    await this.storage.put("messages", messages);
    await this.storage.setAlarm(now + IDLE_MS);
    return { ...stored };
  }

  async setOrder(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who || who.role !== "dm") throw new TableError("Only the DM moves the order.");
    const order = cleanOrder(payload);
    await this.storage.put("order", order);
    await this.storage.setAlarm(Date.now() + IDLE_MS);
    return order;
  }

  async rollInitiative(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who || who.role !== "player") throw new TableError("Sit down before you roll initiative.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new TableError("Expected an object.");
    }
    const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "";
    if (!name) throw new TableError("Name the character first.");
    const order = cleanOrder((await this.storage.get("order")) || blankOrder());
    const seatName = who.name.toLowerCase();
    const characterName = name.toLowerCase();
    let person = order.combatants.find((item) => item.seat.toLowerCase() === seatName);
    if (!person) {
      person = order.combatants.find((item) => (
        item.name.toLowerCase() === characterName
        && (!item.seat || item.seat.toLowerCase() === seatName || item.seat.toLowerCase() === characterName)
      ));
    }
    const init = intField(payload.init, 0, -100, 200);
    const bonus = intField(payload.bonus, 0, -30, 30);
    const die = payload.die == null || payload.die === "" ? null : intField(payload.die, null, 1, 20);
    const hp = intField(payload.hp, 1, 0, 9999);
    const maxHp = intField(payload.maxHp, Math.max(hp, 1), 1, 9999);
    const ac = payload.ac == null || payload.ac === "" ? null : intField(payload.ac, 10, 0, 40);
    if (person) {
      person.name = name;
      person.seat = who.name;
      person.init = init;
      person.bonus = bonus;
      person.die = die;
      person.hp = hp;
      person.maxHp = maxHp;
      person.ac = ac;
      if (person.hp > 0) person.death = blankDeath();
    } else {
      if (order.combatants.length >= 24) throw new TableError("The order holds 24.");
      const sequence = order.combatants.reduce((max, item) => Math.max(max, item.order), 0) + 1;
      order.combatants.push({
        id: hexId(),
        name,
        seat: who.name,
        init,
        bonus,
        die,
        hp,
        maxHp,
        ac,
        marks: [],
        exhaustion: 0,
        death: blankDeath(),
        order: sequence,
      });
    }
    const next = cleanOrder(order);
    await this.storage.put("order", next);
    await this.storage.setAlarm(Date.now() + IDLE_MS);
    return next;
  }

  async setVitals(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who || who.role !== "player") throw new TableError("Sit down before you change hit points.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new TableError("Expected an object.");
    }
    const order = cleanOrder((await this.storage.get("order")) || blankOrder());
    const person = order.combatants.find((item) => (
      item.seat.toLowerCase() === who.name.toLowerCase()
      || item.name.toLowerCase() === who.name.toLowerCase()
    ));
    if (!person) throw new TableError("You are not in the order yet.");
    if (payload.hp != null && payload.hp !== "") person.hp = intField(payload.hp, person.hp, 0, 9999);
    if (payload.maxHp != null && payload.maxHp !== "") person.maxHp = intField(payload.maxHp, person.maxHp, 1, 9999);
    if (payload.ac === null || payload.ac === "") person.ac = null;
    else if (payload.ac != null) person.ac = intField(payload.ac, person.ac ?? 10, 0, 40);
    if (Array.isArray(payload.marks)) {
      person.marks = [...new Set(payload.marks.filter((mark) => MARKS.includes(mark)))];
    }
    if (person.hp > 0) person.death = blankDeath();
    const next = cleanOrder(order);
    await this.storage.put("order", next);
    await this.storage.setAlarm(Date.now() + IDLE_MS);
    return next;
  }
  /** The party board: shared notes, glossary, quests, stash, polls, ready checks, the X-card, help, reactions, pins, typing, and ending your own turn. */
  async board(token, payload) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who) throw new TableError("Sit down before you use the board.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TableError("Expected an object.");
    const now = Date.now();
    const op = payload.op;
    if (op === "typing") {
      if (who.role !== "player") return { ok: true };
      const seat = await this.storage.get(`seat:${token}`);
      await this.storage.put(`seat:${token}`, { ...seat, typing: payload.on === false ? 0 : now, seen: now });
      return { ok: true };
    }
    if (op === "react" || op === "pin") {
      const messages = (await this.storage.get("messages")) || [];
      const message = messages.find((item) => item.id === payload.id && messageVisible(item, who.name));
      if (!message) throw new TableError("That message is gone.");
      if (op === "react") {
        if (!REACTIONS.includes(payload.emoji)) throw new TableError("Pick one of the table reactions.");
        const reactions = message.reactions && typeof message.reactions === "object" ? message.reactions : {};
        const names = new Set(reactions[payload.emoji] || []);
        if (names.has(who.name)) names.delete(who.name);
        else names.add(who.name);
        reactions[payload.emoji] = [...names];
        if (!names.size) delete reactions[payload.emoji];
        message.reactions = reactions;
      } else {
        message.pinned = payload.on !== false;
      }
      await this.storage.put("messages", messages);
      await this.storage.setAlarm(now + IDLE_MS);
      return { ok: true, message: { ...message } };
    }
    if (op === "end-turn") {
      const order = cleanOrder((await this.storage.get("order")) || blankOrder());
      const turns = sortOrder(order.combatants);
      const index = turns.findIndex((person) => person.id === order.activeId);
      const active = turns[index];
      if (!active || (who.role !== "dm" && active.seat.toLowerCase() !== who.name.toLowerCase())) {
        throw new TableError("It is not your turn.");
      }
      const nextIndex = (index + 1) % turns.length;
      if (nextIndex === 0) order.round = Math.min(999, order.round + 1);
      order.activeId = turns[nextIndex].id;
      order.started = true;
      const next = cleanOrder(order);
      await this.storage.put("order", next);
      await this.storage.setAlarm(now + IDLE_MS);
      return { ok: true, order: next };
    }
    const board = cleanBoard(await this.storage.get("board"));
    const by = who.name;
    switch (op) {
      case "notes": {
        if (typeof payload.text !== "string") throw new TableError("Notes have to be text.");
        board.notes = { text: payload.text.slice(0, 8000), by, at: now };
        break;
      }
      case "glossary-add": {
        if (board.glossary.length >= BOARD_LIST_CAP) throw new TableError("The glossary is full.");
        const name = boardText(payload.name, 60, "The name");
        const body = typeof payload.body === "string" ? payload.body.trim().slice(0, 600) : "";
        const found = board.glossary.find((item) => item.name.toLowerCase() === name.toLowerCase());
        if (found) Object.assign(found, { body, by, at: now });
        else board.glossary.push({ id: hexId(), name, body, by, at: now });
        board.glossary.sort((a, b) => a.name.localeCompare(b.name));
        break;
      }
      case "glossary-remove":
        board.glossary = board.glossary.filter((item) => item.id !== boardId(payload.id));
        break;
      case "quest-add": {
        if (board.quests.length >= BOARD_LIST_CAP) throw new TableError("The quest log is full.");
        board.quests.push({ id: hexId(), title: boardText(payload.title, 120, "The quest"), done: false, by, at: now });
        break;
      }
      case "quest-toggle": {
        const quest = board.quests.find((item) => item.id === boardId(payload.id));
        if (!quest) throw new TableError("That quest is gone.");
        quest.done = !quest.done;
        break;
      }
      case "quest-remove":
        board.quests = board.quests.filter((item) => item.id !== boardId(payload.id));
        break;
      case "stash-put": {
        const name = boardText(payload.name, 60, "The item");
        const qty = intField(payload.qty, 1, 1, 99);
        const gearId = typeof payload.gearId === "string" && /^[a-z0-9-]{1,40}$/.test(payload.gearId) ? payload.gearId : "";
        const found = board.stash.items.find((item) => item.name === name && item.gearId === gearId);
        if (found) found.qty = Math.min(999, found.qty + qty);
        else if (board.stash.items.length >= BOARD_LIST_CAP) throw new TableError("The stash is full.");
        else board.stash.items.push({ id: hexId(), name, gearId, qty, by, at: now });
        break;
      }
      case "stash-take": {
        if (who.role !== "player") throw new TableError("Sit down before you take from the stash.");
        const item = board.stash.items.find((entry) => entry.id === boardId(payload.id));
        if (!item) throw new TableError("Someone already took that.");
        item.qty -= 1;
        if (item.qty <= 0) board.stash.items = board.stash.items.filter((entry) => entry !== item);
        await this.storage.put("board", board);
        return { ok: true, board, taken: { name: item.name, gearId: item.gearId } };
      }
      case "coin-put": {
        board.stash.cp = Math.min(PRICE_CAP, board.stash.cp + intField(payload.cp, 0, 0, PRICE_CAP));
        break;
      }
      case "coin-take": {
        if (who.role !== "player") throw new TableError("Sit down before you take coin.");
        const cp = intField(payload.cp, 0, 0, PRICE_CAP);
        if (cp > board.stash.cp) throw new TableError("The pot does not hold that much.");
        board.stash.cp -= cp;
        await this.storage.put("board", board);
        return { ok: true, board, cp };
      }
      case "poll-open": {
        const question = boardText(payload.question, 120, "The question");
        const labels = (Array.isArray(payload.options) ? payload.options : [])
          .filter((label) => typeof label === "string" && collapse(label))
          .map((label) => collapse(label).slice(0, 60))
          .slice(0, 8);
        if (labels.length < 2) throw new TableError("A poll needs two choices.");
        board.poll = { id: hexId(), question, by, at: now, closed: false, options: labels.map((label, index) => ({ id: String(index), label, votes: [] })) };
        break;
      }
      case "poll-vote": {
        if (!board.poll || board.poll.closed) throw new TableError("There is no open poll.");
        const option = board.poll.options.find((item) => item.id === payload.option);
        if (!option) throw new TableError("That is not a choice.");
        const had = option.votes.includes(by);
        if (had) option.votes = option.votes.filter((name) => name !== by);
        else option.votes.push(by);
        break;
      }
      case "poll-close":
        if (board.poll) board.poll.closed = true;
        break;
      case "poll-clear":
        board.poll = null;
        break;
      case "ready-call":
        board.ready = { id: hexId(), by, at: now, answers: { [by]: "ready" } };
        break;
      case "ready-answer": {
        if (!board.ready) throw new TableError("Nobody called a ready check.");
        board.ready.answers[by] = payload.answer === "wait" ? "wait" : "ready";
        break;
      }
      case "ready-clear":
        board.ready = null;
        break;
      case "xcard":
        // Nobody's name is stored. The card is anonymous on purpose.
        board.xcard = { at: now };
        break;
      case "xcard-clear":
        board.xcard = null;
        break;
      case "help": {
        if (who.role !== "player") throw new TableError("Only a player helps.");
        const to = cleanTarget(payload.to);
        if (!to || to === by) throw new TableError("Help someone else.");
        board.helps = board.helps.filter((help) => help.to !== to);
        board.helps.push({ id: hexId(), from: by, to, at: now });
        break;
      }
      case "help-used":
        board.helps = board.helps.filter((help) => help.to !== by);
        break;
      default:
        throw new TableError("The board does not know that.");
    }
    await this.storage.put("board", board);
    await this.storage.setAlarm(now + IDLE_MS);
    return { ok: true, board };
  }
}

function intField(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
