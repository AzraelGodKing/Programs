/** Shared table rules. The local server and the Worker both use this module. */

import { advanceTurn, blankDeath, blankOrder, cleanOrder, playerOrder } from "../src/order.js";
import { MARKS } from "../src/marks.js";
import { TOKEN_CAP, cleanMap, cleanToken, fogged, freeCell, mapFor, paintFog, resizeMap } from "../src/mapgrid.js";
import { discordRecap, validWebhook } from "../src/recap.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EVENT_CAP = 500;
const SUMMARY_CAP = 20;
const SUMMARY_LENGTH = 300;
const NAME_LENGTH = 40;
const INTENT_LENGTH = 60;
const SNAPSHOT_BYTES = 200_000;
export const BODY_BYTES = 300_000;
const MESSAGE_CAP = 200;
const MESSAGE_LENGTH = 400;
export const DM_NAME = "Dungeon Master";
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const GOODS_CAP = 60;
const BUYBACK_CAP = 60;
const PRICE_CAP = 10_000_000;

export class TableError extends Error {}

function collapse(value) {
  return value.split(/\s+/).filter(Boolean).join(" ");
}

function cleanName(value) {
  if (typeof value !== "string") throw new TableError("A name is required.");
  const name = collapse(value).slice(0, NAME_LENGTH);
  if (!name) throw new TableError("A name is required.");
  return name;
}

function cleanIntent(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new TableError("The roll note has to be text.");
  return collapse(value).slice(0, INTENT_LENGTH);
}

function cleanSummaries(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") value = [value];
  if (!Array.isArray(value)) throw new TableError("The activity log has to be a list.");
  const summaries = [];
  for (const item of value.slice(0, SUMMARY_CAP)) {
    const raw = typeof item === "string" ? item : item && typeof item === "object" && typeof item.text === "string" ? item.text : null;
    if (raw === null) continue;
    const text = collapse(raw).slice(0, SUMMARY_LENGTH);
    if (!text) continue;
    if (typeof item !== "object") {
      summaries.push(text);
      continue;
    }
    const entry = { text };
    if (item.secret === true) entry.secret = true;
    if (typeof item.ask === "string" && /^[a-f0-9]{16}$/.test(item.ask)) entry.ask = item.ask;
    if (Number.isInteger(item.total) && Math.abs(item.total) <= 999) entry.total = item.total;
    summaries.push(Object.keys(entry).length > 1 ? entry : text);
  }
  return summaries;
}

function cleanUpdate(payload) {
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

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validToken(token) {
  return typeof token === "string" && /^[a-f0-9]{32}$/.test(token);
}

export function validCode(code) {
  return typeof code === "string" && /^[A-Z0-9]{4}$/.test(code);
}

function cleanMessage(value) {
  if (typeof value !== "string") throw new TableError("A message has to be text.");
  const text = collapse(value).slice(0, MESSAGE_LENGTH);
  if (!text) throw new TableError("Write a message first.");
  return text;
}

function cleanTarget(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new TableError("Whisper a name, or leave it open to the table.");
  return collapse(value).slice(0, NAME_LENGTH);
}

function messageVisible(message, viewer) {
  const target = message.to || "";
  if (!target) return true;
  if (!viewer) return false;
  return message.from === viewer || target === viewer;
}

function cleanTalk(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TableError("Expected an object.");
  }
  const name = cleanName(payload.name);
  const text = cleanMessage(payload.text);
  const to = cleanTarget(payload.to);
  if (to === name) throw new TableError("Whisper someone else.");
  const ask = cleanAsk(payload.ask, name);
  const kind = TALK_KINDS.includes(payload.kind) ? payload.kind : "";
  if (kind === "read" && name !== DM_NAME) throw new TableError("Only the DM reads aloud.");
  const as = typeof payload.as === "string" ? collapse(payload.as).slice(0, 80) : "";
  const message = { name, text, to };
  if (ask) message.ask = ask;
  if (ask && Number.isInteger(payload.dc) && payload.dc >= 1 && payload.dc <= 40) message.dc = payload.dc;
  if (kind) message.kind = kind;
  if (as && kind !== "ooc") message.as = as;
  return message;
}

export const TALK_KINDS = ["ic", "ooc", "emote", "read"];
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
    gifts: [],
    handouts: [],
    world: null,
    pause: null,
    mood: null,
    chat: { mode: "open", slow: 0 },
    rules: "",
    safety: { lines: [], veils: [] },
    xlog: [],
    next: null,
  };
}

export const CHAT_MODES = ["open", "slow", "muted"];

function cleanList(value, cap, max) {
  return (Array.isArray(value) ? value : String(value || "").split(/\n|,/))
    .map((item) => collapse(String(item)).slice(0, max))
    .filter(Boolean)
    .slice(0, cap);
}

export const GIFT_KINDS = ["item", "coin", "inspiration", "xp", "identify"];
const GIFT_CAP = 40;
const HANDOUT_CAP = 12;
export const HANDOUT_IMAGE_CHARS = 120_000;
const MAP_IMAGE_CHARS = 280_000;

/** What one viewer may see of the board. Hidden quests and glossary entries, and other people's gifts and handouts, stay with the DM. */
export function boardFor(board, who) {
  if (who.role === "dm") return board;
  if (who.role === "watch") {
    // A spectator reads the public board: no party notes, stash, handouts, or anything addressed to one seat.
    return {
      ...board,
      notes: { text: "", by: "", at: 0 },
      glossary: board.glossary.filter((item) => !item.hidden),
      quests: board.quests.filter((item) => !item.hidden),
      stash: { items: [], cp: 0 },
      helps: [],
      gifts: [],
      handouts: [],
      rules: "",
      safety: { lines: [], veils: [] },
      xlog: [],
    };
  }
  return {
    ...board,
    glossary: board.glossary.filter((item) => !item.hidden),
    quests: board.quests.filter((item) => !item.hidden),
    helps: board.helps.filter((help) => help.to === who.name || help.from === who.name),
    gifts: board.gifts.filter((gift) => gift.to === who.name),
    handouts: board.handouts.filter((item) => !item.to || item.to === who.name),
    xlog: [],
  };
}

function cleanWorld(payload) {
  const day = intField(payload.day, 1, 1, 9999);
  const hour = intField(payload.hour, 8, 0, 23);
  const weather = typeof payload.weather === "string" ? collapse(payload.weather).slice(0, 40) : "";
  return { day, hour, weather };
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
function cleanAsk(value, name) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new TableError("Ask for a roll by name.");
  if (name !== DM_NAME) throw new TableError("Only the DM asks for rolls.");
  return collapse(value).slice(0, INTENT_LENGTH);
}

/** A player sees only their own deal at the counter. */
export function shopFor(shop, who) {
  if (!shop || typeof shop !== "object" || !shop.deals || who.role === "dm") return shop;
  const deal = shop.deals[who.name];
  const { deals, ...rest } = shop;
  return Number.isInteger(deal) && deal ? { ...rest, deals: { [who.name]: deal } } : rest;
}

function shopIsOpen(shop) {
  if (shop && typeof shop === "object" && !Array.isArray(shop)) return shop.open !== false;
  return shop !== false;
}

function cleanPrice(value) {
  return Number.isInteger(value) && value >= 0 && value <= PRICE_CAP;
}

function cleanShop(payload) {
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
  const deals = {};
  if (payload.deals && typeof payload.deals === "object" && !Array.isArray(payload.deals)) {
    for (const [who, percent] of Object.entries(payload.deals).slice(0, 12)) {
      const seat = collapse(String(who)).slice(0, NAME_LENGTH);
      if (seat && Number.isInteger(percent) && percent !== 0 && percent >= -50 && percent <= 100) deals[seat] = percent;
    }
  }
  const shop = { open, name: name || "Shop", stall, goods };
  if (Object.keys(deals).length) shop.deals = deals;
  return shop;
}

function cleanBuyback(payload) {
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

function rollTags(summary) {
  const tags = {};
  if (summary.secret) tags.secret = true;
  if (summary.ask) tags.ask = summary.ask;
  if (summary.total !== undefined) tags.total = summary.total;
  return tags;
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

  /** The spectator link's token opens a read-only view and nothing else. */
  async watching(token) {
    const meta = await this.storage.get("meta");
    return Boolean(meta && validToken(token) && meta.watchToken && token === meta.watchToken);
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
    let who = await this.role(token);
    if (!who && await this.watching(token)) who = { role: "watch", name: "" };
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
        map: null,
      };
    }
    const map = mapFor(await this.storage.get("map"), who);
    if (who.role === "watch") {
      const seats = await this.storage.list({ prefix: "seat:" });
      const open = shopFor(shop, who);
      return {
        watching: true,
        locked: false,
        events: ((await this.storage.get("events")) || []).filter((event) => !event.secret).reverse(),
        // Only what the table already says out loud: the name, the hero, and how hurt they look.
        players: [...seats.values()].map((seat) => ({ name: seat.name, seen: seat.seen, typing: 0, intent: "", snapshot: watchSnapshot(seat.snapshot) })).sort((a, b) => b.seen - a.seen),
        shop: typeof open === "object" && open ? { open: open.open !== false } : open,
        buybacks: [],
        messages: ((await this.storage.get("messages")) || []).filter((message) => !message.to),
        board: boardFor(cleanBoard(await this.storage.get("board")), who),
        order: playerOrder(order),
        map,
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
    const board = boardFor(cleanBoard(await this.storage.get("board")), who);
    return {
      events: [...events].reverse(),
      board,
      players,
      shop: shopFor(shop, who),
      buybacks: buybacks.map((line) => ({ ...line })),
      messages,
      order: who.role === "dm" ? order : playerOrder(order),
      map,
      watch: who.role === "dm" ? Boolean((await this.storage.get("meta")).watchToken) : undefined,
      locked: false,
    };
  }

  /** The battle map. The DM draws it; a player moves only their own token. */
  async map(token, payload) {
    const meta = await this.storage.get("meta");
    if (!meta) return null;
    let who = await this.role(token);
    if (!who && await this.watching(token)) who = { role: "watch", name: "" };
    if (!who) throw new TableError("Sit down before you use the map.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TableError("Expected an object.");
    const now = Date.now();
    let map = cleanMap(await this.storage.get("map"));
    const op = payload.op;
    if (op === "image-get") {
      if (who.role !== "dm" && !map.on) throw new TableError("The map is not out yet.");
      return { ok: true, image: map.image ? (await this.storage.get("mapimage")) || "" : "", rev: map.image };
    }
    if (who.role === "watch") throw new TableError("A spectator only watches.");
    const find = () => {
      const found = map.tokens.find((item) => item.id === payload.id);
      if (!found) throw new TableError("That token is gone.");
      return found;
    };
    if (op === "token-move") {
      const piece = find();
      const { x, y } = payload;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.cols || y >= map.rows) throw new TableError("That is off the map.");
      if (who.role !== "dm") {
        if (!map.on || piece.hidden || (piece.seat || "").toLowerCase() !== who.name.toLowerCase()) throw new TableError("Move your own token.");
        if (fogged(map, x, y)) throw new TableError("You cannot see that far yet.");
      }
      piece.x = x;
      piece.y = y;
    } else {
      if (who.role !== "dm") throw new TableError("Only the DM draws the map.");
      switch (op) {
        case "show":
          map.on = payload.on !== false;
          break;
        case "size":
          map = resizeMap(map, payload.cols, payload.rows);
          break;
        case "image": {
          const image = payload.image === "" || payload.image === null ? "" : payload.image;
          if (image !== "" && !(typeof image === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))) {
            throw new TableError("The map picture has to be a PNG, JPEG, or WebP.");
          }
          if (image.length > MAP_IMAGE_CHARS) throw new TableError("That picture is too large. Try a smaller one.");
          if (image) await this.storage.put("mapimage", image);
          else await this.storage.delete("mapimage");
          map.image = image ? now : 0;
          break;
        }
        case "token-add": {
          if (map.tokens.length >= TOKEN_CAP) throw new TableError("The map is full of tokens.");
          const spot = freeCell(map);
          const piece = cleanToken({ ...payload, id: hexId(), x: payload.x ?? spot.x, y: payload.y ?? spot.y }, map.cols, map.rows);
          if (!piece) throw new TableError("Name the token.");
          map.tokens.push(piece);
          break;
        }
        case "party": {
          // One token for every seat that has none yet.
          const seats = [...(await this.storage.list({ prefix: "seat:" })).values()];
          for (const seat of seats) {
            if (map.tokens.length >= TOKEN_CAP) break;
            if (map.tokens.some((item) => (item.seat || "").toLowerCase() === seat.name.toLowerCase())) continue;
            const hero = typeof seat.snapshot?.character?.name === "string" ? collapse(seat.snapshot.character.name).slice(0, NAME_LENGTH) : "";
            map.tokens.push(cleanToken({ id: hexId(), name: hero || seat.name, kind: "pc", seat: seat.name, ...freeCell(map) }, map.cols, map.rows));
          }
          break;
        }
        case "token-edit": {
          const piece = find();
          const next = cleanToken({ ...piece, ...(typeof payload.name === "string" ? { name: payload.name } : {}), ...(typeof payload.hidden === "boolean" ? { hidden: payload.hidden } : {}), ...(payload.size ? { size: payload.size } : {}) }, map.cols, map.rows);
          if (!next) throw new TableError("Name the token.");
          map.tokens = map.tokens.map((item) => (item.id === piece.id ? next : item));
          break;
        }
        case "token-remove":
          find();
          map.tokens = map.tokens.filter((item) => item.id !== payload.id);
          break;
        case "fog":
          map.fog = paintFog(map, payload.all === true ? "all" : payload.cells, payload.hidden !== false);
          break;
        case "clear":
          await this.storage.delete("mapimage");
          map = cleanMap({ cols: map.cols, rows: map.rows });
          break;
        default:
          throw new TableError("The map does not know that.");
      }
    }
    await this.storage.put("map", map);
    await this.storage.setAlarm(now + IDLE_MS);
    return { ok: true, map: mapFor(map, who) };
  }

  /** Posts the recap and the next session to a Discord channel. The webhook address is used once and not kept. */
  async recap(token, payload, fetchImpl = globalThis.fetch) {
    if (!await this.storage.get("meta")) return null;
    const who = await this.role(token);
    if (!who || who.role !== "dm") throw new TableError("Only the DM posts the recap.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TableError("Expected an object.");
    if (!validWebhook(payload.webhook)) throw new TableError("That is not a Discord webhook address. Copy it from the channel's Integrations settings.");
    const board = cleanBoard(await this.storage.get("board"));
    const body = discordRecap({
      recap: typeof payload.recap === "string" ? payload.recap : "",
      next: payload.next === false ? null : board.next,
      title: typeof payload.title === "string" ? collapse(payload.title) : "",
      link: typeof payload.link === "string" ? payload.link : "",
    });
    if (!body) throw new TableError("Write a recap or set the next session first.");
    let response;
    try {
      response = await fetchImpl(payload.webhook.trim(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      throw new TableError("Discord did not answer. Try again in a moment.");
    }
    if (!response.ok) throw new TableError(response.status === 404 || response.status === 401 ? "Discord does not know that webhook. It may have been deleted." : `Discord refused the post (${response.status}).`);
    return { ok: true, next: Boolean(body.embeds[0].fields?.some((field) => field.name === "Next session")) };
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
        lastTalk: (await this.storage.get(`seat:${token}`))?.lastTalk || 0,
        intent: update.intent,
        snapshot: update.snapshot,
      },
    };
    if (update.summaries.length) {
      let events = (await this.storage.get("events")) || [];
      for (const summary of update.summaries) {
        if (typeof summary === "string") events.push({ id: hexId(), at: now, name: who.name, summary });
        else events.push({ id: hexId(), at: now, name: who.name, summary: summary.text, ...rollTags(summary) });
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
    if (who.role === "player") {
      const chat = cleanBoard(await this.storage.get("board")).chat || { mode: "open" };
      if (chat.mode === "muted" && message.to !== DM_NAME) throw new TableError("The DM has paused table talk. You can still whisper the DM.");
      if (chat.mode === "slow") {
        const seat = await this.storage.get(`seat:${token}`);
        const wait = (seat?.lastTalk || 0) + chat.slow * 1000 - now;
        if (wait > 0) throw new TableError(`Slow chat: wait ${Math.ceil(wait / 1000)} more seconds.`);
        if (seat) await this.storage.put(`seat:${token}`, { ...seat, lastTalk: now });
      }
    }
    let messages = (await this.storage.get("messages")) || [];
    const stored = { id: hexId(), at: now, from: message.name, to: message.to, text: message.text };
    if (message.ask) stored.ask = message.ask;
    if (message.dc) stored.dc = message.dc;
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
    return playerOrder(next);
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
    return playerOrder(next);
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
      const active = order.combatants.find((person) => person.id === order.activeId);
      if (!order.started || !active || (who.role !== "dm" && active.seat.toLowerCase() !== who.name.toLowerCase())) {
        throw new TableError("It is not your turn.");
      }
      const next = advanceTurn(order, 1, now).order;
      await this.storage.put("order", next);
      await this.storage.setAlarm(now + IDLE_MS);
      return { ok: true, order: who.role === "dm" ? next : playerOrder(next) };
    }
    if (op === "dm-roll") {
      if (who.role !== "dm") throw new TableError("Only the DM rolls for someone else.");
      const name = cleanName(payload.name);
      const [summary] = cleanSummaries([{ text: payload.text, secret: payload.secret === true, ask: payload.ask, total: payload.total }]);
      if (!summary) throw new TableError("Say what was rolled.");
      const entry = typeof summary === "string" ? { text: summary } : summary;
      let events = (await this.storage.get("events")) || [];
      events.push({ id: hexId(), at: now, name, summary: entry.text, by: DM_NAME, ...rollTags(entry) });
      if (events.length > EVENT_CAP) events = events.slice(-EVENT_CAP);
      await this.storage.put("events", events);
      await this.storage.setAlarm(now + IDLE_MS);
      return { ok: true };
    }
    if (op === "watch-link" || op === "watch-off") {
      if (who.role !== "dm") throw new TableError("Only the DM shares a spectator link.");
      const meta = await this.storage.get("meta");
      // Turning the link off forgets the token, so an old link stops working.
      const watchToken = op === "watch-off" ? "" : meta.watchToken || randomToken();
      await this.storage.put("meta", { ...meta, watchToken });
      return { ok: true, token: watchToken };
    }
    const board = cleanBoard(await this.storage.get("board"));
    const by = who.name;
    const dmOnly = (what) => {
      if (who.role !== "dm") throw new TableError(`Only the DM ${what}.`);
    };
    switch (op) {
      case "gift": {
        dmOnly("hands out rewards");
        const kind = GIFT_KINDS.includes(payload.kind) ? payload.kind : "";
        if (!kind) throw new TableError("That is not a reward Lantern knows.");
        const seats = [...(await this.storage.list({ prefix: "seat:" })).values()].map((seat) => seat.name);
        const to = cleanTarget(payload.to);
        const names = to ? [to] : seats;
        if (to && !seats.includes(to)) throw new TableError("Nobody by that name is seated.");
        if (!names.length) throw new TableError("Nobody is seated yet.");
        const reason = typeof payload.reason === "string" ? collapse(payload.reason).slice(0, 120) : "";
        const gift = { kind, reason, at: now };
        if (kind === "item" || kind === "identify") {
          gift.name = boardText(payload.name, 60, "The item");
          gift.text = typeof payload.text === "string" ? payload.text.trim().slice(0, 600) : "";
          gift.key = typeof payload.key === "string" && /^[a-f0-9]{16}$/.test(payload.key) ? payload.key : hexId();
          gift.qty = intField(payload.qty, 1, 1, 99);
          if (kind === "item" && typeof payload.shown === "string" && collapse(payload.shown)) gift.shown = collapse(payload.shown).slice(0, 60);
          if (payload.attune === true) gift.attune = true;
        }
        if (kind === "coin") gift.cp = intField(payload.cp, 0, 1, PRICE_CAP);
        if (kind === "xp") {
          gift.xp = intField(payload.xp, 0, 0, 400_000);
          if (payload.milestone === true) gift.milestone = true;
          if (!gift.xp && !gift.milestone) throw new TableError("Give some experience, or a milestone.");
        }
        if (board.gifts.length + names.length > GIFT_CAP) throw new TableError("Too many rewards are waiting to be picked up.");
        let events = (await this.storage.get("events")) || [];
        for (const name of names) {
          board.gifts.push({ id: hexId(), to: name, ...gift });
          const what = kind === "item" ? `${gift.shown || gift.name}${gift.qty > 1 ? ` × ${gift.qty}` : ""}`
            : kind === "coin" ? `${Math.floor(gift.cp / 100)} gp${gift.cp % 100 ? ` ${gift.cp % 100} cp` : ""}`
              : kind === "xp" ? (gift.milestone ? "a milestone level" : `${gift.xp} XP`)
                : kind === "identify" ? `the truth about ${gift.name}` : "inspiration";
          if (kind !== "identify") events.push({ id: hexId(), at: now, name, by: DM_NAME, summary: `The DM gave ${name} ${what}${reason ? `: ${reason}` : "."}` });
        }
        if (events.length > EVENT_CAP) events = events.slice(-EVENT_CAP);
        await this.storage.put({ board, events });
        await this.storage.setAlarm(now + IDLE_MS);
        return { ok: true, board: boardFor(board, who) };
      }
      case "gift-take": {
        if (who.role !== "player") throw new TableError("Only a player picks up a reward.");
        const id = boardId(payload.id);
        const gift = board.gifts.find((item) => item.id === id && item.to === who.name);
        if (!gift) throw new TableError("That reward was already picked up.");
        board.gifts = board.gifts.filter((item) => item !== gift);
        await this.storage.put("board", board);
        return { ok: true, board: boardFor(board, who), gift };
      }
      case "handout": {
        dmOnly("hands out handouts");
        const title = boardText(payload.title, 80, "The title");
        const body = typeof payload.text === "string" ? payload.text.trim().slice(0, 4000) : "";
        const image = typeof payload.image === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(payload.image)
          ? payload.image : "";
        if (image.length > HANDOUT_IMAGE_CHARS) throw new TableError("That picture is too large. Try a smaller one.");
        if (!body && !image) throw new TableError("A handout needs words or a picture.");
        const to = cleanTarget(payload.to);
        const id = hexId();
        board.handouts.push({ id, to, title, at: now, image: Boolean(image) });
        if (board.handouts.length > HANDOUT_CAP) {
          const gone = board.handouts.shift();
          await this.storage.delete(`handout:${gone.id}`);
        }
        await this.storage.put({ board, [`handout:${id}`]: { text: body, image } });
        await this.storage.setAlarm(now + IDLE_MS);
        return { ok: true, board: boardFor(board, who) };
      }
      case "handout-get": {
        const id = boardId(payload.id);
        const meta = boardFor(board, who).handouts.find((item) => item.id === id);
        if (!meta) throw new TableError("That handout is not yours to read.");
        const body = (await this.storage.get(`handout:${id}`)) || { text: "", image: "" };
        return { ok: true, handout: { ...meta, text: body.text || "", image: body.image || "" } };
      }
      case "handout-remove": {
        dmOnly("takes back handouts");
        const id = boardId(payload.id);
        board.handouts = board.handouts.filter((item) => item.id !== id);
        await this.storage.put("board", board);
        await this.storage.delete(`handout:${id}`);
        return { ok: true, board };
      }
      case "glossary-reveal": {
        dmOnly("reveals the glossary");
        const entry = board.glossary.find((item) => item.id === boardId(payload.id));
        if (!entry) throw new TableError("That entry is gone.");
        if (entry.hidden) delete entry.hidden;
        else entry.hidden = true;
        break;
      }
      case "quest-hide": {
        dmOnly("hides quests");
        const quest = board.quests.find((item) => item.id === boardId(payload.id));
        if (!quest) throw new TableError("That quest is gone.");
        if (quest.hidden) delete quest.hidden;
        else quest.hidden = true;
        break;
      }
      case "world": {
        dmOnly("sets the weather and the hour");
        board.world = payload.clear === true ? null : { ...cleanWorld(payload), at: now };
        break;
      }
      case "pause":
        dmOnly("pauses the table");
        board.pause = payload.on === false ? null : { at: now, text: typeof payload.text === "string" ? collapse(payload.text).slice(0, 120) : "" };
        break;
      case "mood":
        dmOnly("sets the mood");
        board.mood = typeof payload.label === "string" && collapse(payload.label) ? { label: collapse(payload.label).slice(0, 40), at: now } : null;
        break;
      case "chat-mode": {
        dmOnly("sets the chat");
        const mode = CHAT_MODES.includes(payload.mode) ? payload.mode : "open";
        board.chat = { mode, slow: mode === "slow" ? intField(payload.slow, 30, 5, 600) : 0 };
        break;
      }
      case "rules":
        dmOnly("writes the table rules");
        board.rules = typeof payload.text === "string" ? payload.text.trim().slice(0, 4000) : "";
        break;
      case "safety":
        dmOnly("sets lines and veils");
        board.safety = { lines: cleanList(payload.lines, 30, 80), veils: cleanList(payload.veils, 30, 80) };
        break;
      case "xlog-clear":
        dmOnly("clears the X-card history");
        board.xlog = [];
        break;
      case "next": {
        dmOnly("sets the next session");
        const at = Number(payload.at);
        const label = typeof payload.label === "string" ? collapse(payload.label).slice(0, 80) : "";
        board.next = (Number.isFinite(at) && at > 0) || label ? { at: Number.isFinite(at) && at > 0 ? at : 0, label } : null;
        break;
      }
      case "seat-kick":
      case "seat-rename":
      case "seat-link": {
        dmOnly("manages seats");
        const name = cleanName(payload.name);
        const stored = await this.storage.list({ prefix: "seat:" });
        const entry = [...stored.entries()].find(([, seat]) => seat.name === name);
        if (!entry) throw new TableError("Nobody by that name is seated.");
        const [key, seat] = entry;
        if (op === "seat-link") return { ok: true, token: key.slice("seat:".length), name };
        if (op === "seat-kick") {
          await this.storage.delete(key);
          await this.storage.setAlarm(now + IDLE_MS);
          return { ok: true, board };
        }
        const to = cleanName(payload.to);
        if (to.toLowerCase() === DM_NAME.toLowerCase()) throw new TableError("That name is the DM's.");
        if ([...stored.values()].some((other) => other !== seat && other.name.toLowerCase() === to.toLowerCase())) throw new TableError("That name is already at the table.");
        const order = cleanOrder((await this.storage.get("order")) || blankOrder());
        for (const person of order.combatants) if (person.seat === name) person.seat = to;
        await this.storage.put({ [key]: { ...seat, name: to }, order: cleanOrder(order) });
        return { ok: true, board };
      }
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
        else board.glossary.push({ id: hexId(), name, body, by, at: now, ...(who.role === "dm" && payload.hidden === true ? { hidden: true } : {}) });
        board.glossary.sort((a, b) => a.name.localeCompare(b.name));
        break;
      }
      case "glossary-remove":
        board.glossary = board.glossary.filter((item) => item.id !== boardId(payload.id));
        break;
      case "quest-add": {
        if (board.quests.length >= BOARD_LIST_CAP) throw new TableError("The quest log is full.");
        board.quests.push({ id: hexId(), title: boardText(payload.title, 120, "The quest"), done: false, by, at: now, ...(who.role === "dm" && payload.hidden === true ? { hidden: true } : {}) });
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
        board.xlog = [...(board.xlog || []), now].slice(-40);
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
    return { ok: true, board: boardFor(board, who) };
  }
}

/** What a spectator may know about a seat's hero. */
function watchSnapshot(snapshot) {
  const character = snapshot?.character;
  if (!character || typeof character !== "object") return {};
  const pick = {};
  for (const key of ["name", "raceId", "classId", "level"]) {
    if (typeof character[key] === "string" || Number.isInteger(character[key])) pick[key] = character[key];
  }
  return { character: pick };
}

function intField(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
