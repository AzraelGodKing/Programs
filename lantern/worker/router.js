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
  if (validToken(header)) return header;
  const query = new URL(request.url).searchParams.get("token") || "";
  return validToken(query) ? query : "";
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

const ROOM_POSTS = [
  [/\/join\/?$/i, (stub, token, body) => stub.join(token, body), (seat) => seat],
  [/\/order\/?$/i, (stub, token, body) => stub.setOrder(token, body), (order) => ({ ok: true, order })],
  [/\/initiative\/?$/i, (stub, token, body) => stub.rollInitiative(token, body), (order) => ({ ok: true, order })],
  [/\/vitals\/?$/i, (stub, token, body) => stub.setVitals(token, body), (order) => ({ ok: true, order })],
  [/\/shop\/?$/i, (stub, token, body) => stub.setShop(token, body), (shop) => ({ ok: true, shop })],
  [/\/buyback\/?$/i, (stub, token, body) => stub.tradeBuyback(token, body), (buybacks) => ({ ok: true, buybacks })],
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
  if (path.startsWith("/api/rooms/")) {
    if (request.method === "POST") {
      for (const [suffix, call, wrap] of ROOM_POSTS) {
        if (suffix.test(path)) return roomPost(env, request, token, path, suffix, call, wrap);
      }
      return roomPost(
        env,
        request,
        token,
        path,
        /$/,
        (stub, seatToken, body) => stub.update(seatToken, body),
        (result) => ({ ok: true, shop: result.shop, order: result.order }),
      );
    }
    const code = roomCode(path, /$/);
    if (!validCode(code)) return missing();
    if (request.method === "GET") {
      const view = await stubFor(env, code).view(token);
      if (!view) return missing();
      return json(200, { code, ...view });
    }
    return json(405, { error: "Method not allowed." });
  }
  return json(404, { error: "Not found." });
}
