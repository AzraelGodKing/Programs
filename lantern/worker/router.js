/** HTTP routes for the shared table. Static files stay on the assets binding. */

import {
  BODY_BYTES,
  TableError,
  randomCode,
  validCode,
  validToken,
} from "./room.js";

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function stubFor(env, code) {
  return env.TABLE.getByName(code);
}

function tokenFrom(request) {
  const header = request.headers.get("x-lantern-token") || "";
  return validToken(header) ? header : "";
}

async function readJson(request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > BODY_BYTES) throw new TableError("That update is too large.");
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new TableError("Expected an object.");
  return data;
}

function roomCode(path, suffix) {
  return path.slice("/api/rooms/".length).replace(suffix, "").replace(/\/+$/, "").toUpperCase();
}

function rejected(error) {
  if (error instanceof TableError) return json(400, { error: error.message });
  if (error instanceof SyntaxError) return json(400, { error: "That was not JSON." });
  throw error;
}

function missing() {
  return json(404, { error: "No table with that code." });
}

async function roomPost(env, request, token, path, suffix, call, wrap) {
  const code = roomCode(path, suffix);
  if (!validCode(code)) return missing();
  try {
    const value = await call(stubFor(env, code), token, await readJson(request));
    if (value == null) return missing();
    return json(200, wrap(value));
  } catch (error) {
    return rejected(error);
  }
}

const same = (value) => value;

const ROOM_POSTS = [
  [/\/join\/?$/i, (stub, token, body) => stub.join(token, body), same],
  [/\/order\/?$/i, (stub, token, body) => stub.setOrder(token, body), (order) => ({ ok: true, order })],
  [/\/initiative\/?$/i, (stub, token, body) => stub.rollInitiative(token, body), (order) => ({ ok: true, order })],
  [/\/vitals\/?$/i, (stub, token, body) => stub.setVitals(token, body), (order) => ({ ok: true, order })],
  [/\/shop\/?$/i, (stub, token, body) => stub.setShop(token, body), (shop) => ({ ok: true, shop })],
  [/\/buyback\/?$/i, (stub, token, body) => stub.tradeBuyback(token, body), (buybacks) => ({ ok: true, buybacks })],
  [/\/board\/?$/i, (stub, token, body) => stub.board(token, body), same],
  [/\/map\/?$/i, (stub, token, body) => stub.map(token, body), same],
  [/\/recap\/?$/i, (stub, token, body) => stub.recap(token, body), same],
  [/\/talk\/?$/i, (stub, token, body) => stub.talk(token, body), (stored) => ({ ok: true, message: stored })],
];

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
  const token = tokenFrom(request);
  if (path === "/api/rooms" || path === "/api/rooms/") {
    if (request.method === "POST") {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const code = randomCode();
        const dmToken = await stubFor(env, code).create();
        if (dmToken) return json(201, { code, dmToken });
      }
      return json(400, { error: "Could not open a table." });
    }
    return json(405, { error: "Open a table with POST." });
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/")) {
    const route = ROOM_POSTS.find(([suffix]) => suffix.test(path));
    if (route) return roomPost(env, request, token, path, ...route);
  }
  if (path.startsWith("/api/rooms/")) {
    const code = roomCode(path, /$/);
    if (!validCode(code)) return missing();
    const stub = stubFor(env, code);
    if (request.method === "GET") {
      const view = await stub.view(token);
      if (!view) return missing();
      return json(200, { code, ...view });
    }
    if (request.method === "POST") {
      try {
        const result = await stub.update(token, await readJson(request));
        if (!result) return missing();
        return json(200, { ok: true, shop: result.shop, order: result.order });
      } catch (error) {
        return rejected(error);
      }
    }
    return json(405, { error: "Method not allowed." });
  }
  return json(404, { error: "Not found." });
}
