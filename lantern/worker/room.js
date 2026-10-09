/** Shared table rules used by the Durable Object. Matches lantern/room.py. */

import { applyOrder, blankOrder, cleanOrder } from "../src/order.js";

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
    if (typeof item !== "string") continue;
    const text = collapse(item).slice(0, SUMMARY_LENGTH);
    if (text) summaries.push(text);
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
  return ask ? { name, text, to, ask } : { name, text, to };
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

  async create() {
    if (await this.storage.get("meta")) return false;
    const now = Date.now();
    await this.storage.put({
      meta: { created: now },
      events: [],
      shop: true,
      messages: [],
      buybacks: [],
      order: blankOrder(),
    });
    await this.storage.setAlarm(now + IDLE_MS);
    return true;
  }

  async view(viewer = "") {
    if (!await this.storage.get("meta")) return null;
    const events = (await this.storage.get("events")) || [];
    const stored = await this.storage.list({ prefix: "p:" });
    const players = [...stored.values()].sort((a, b) => b.seen - a.seen);
    const storedShop = await this.storage.get("shop");
    const shop = storedShop === undefined || storedShop === null ? true : storedShop;
    const who = cleanViewer(viewer);
    const messages = ((await this.storage.get("messages")) || []).filter((message) => messageVisible(message, who));
    const buybacks = shopIsOpen(shop) ? ((await this.storage.get("buybacks")) || []) : [];
    return {
      events: [...events].reverse(),
      players,
      shop,
      buybacks: buybacks.map((line) => ({ ...line })),
      messages,
      order: cleanOrder(await this.storage.get("order")),
    };
  }

  async update(update) {
    if (!await this.storage.get("meta")) return false;
    const now = Date.now();
    const writes = {
      [`p:${update.name}`]: {
        name: update.name,
        seen: now,
        intent: update.intent,
        snapshot: update.snapshot,
      },
    };
    if (update.summaries.length) {
      let events = (await this.storage.get("events")) || [];
      for (const summary of update.summaries) {
        events.push({ id: hexId(), at: now, name: update.name, summary });
      }
      if (events.length > EVENT_CAP) events = events.slice(-EVENT_CAP);
      writes.events = events;
    }
    await this.storage.put(writes);
    await this.storage.setAlarm(now + IDLE_MS);
    return true;
  }

  async setShop(payload) {
    const shop = cleanShop(payload);
    if (!await this.storage.get("meta")) return null;
    const writes = { shop };
    if (!shopIsOpen(shop)) writes.buybacks = [];
    await this.storage.put(writes);
    await this.storage.setAlarm(Date.now() + IDLE_MS);
    return shop;
  }

  async tradeBuyback(payload) {
    const trade = cleanBuyback(payload);
    if (!await this.storage.get("meta")) return null;
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

  async setOrder(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new TableError("Expected an object.");
    }
    const name = cleanName(payload.name);
    if (!await this.storage.get("meta")) return null;
    const result = applyOrder(cleanOrder(await this.storage.get("order")), payload, {
      name,
      dm: name === DM_NAME,
    });
    if (!result.ok) throw new TableError(result.reason);
    await this.storage.put("order", result.order);
    await this.storage.setAlarm(Date.now() + IDLE_MS);
    return result.order;
  }

  async talk(message) {
    if (!await this.storage.get("meta")) return null;
    const now = Date.now();
    let messages = (await this.storage.get("messages")) || [];
    const stored = { id: hexId(), at: now, from: message.name, to: message.to, text: message.text };
    if (message.ask) stored.ask = message.ask;
    messages.push(stored);
    if (messages.length > MESSAGE_CAP) messages = messages.slice(-MESSAGE_CAP);
    await this.storage.put("messages", messages);
    await this.storage.setAlarm(now + IDLE_MS);
    return { ...stored };
  }
}
