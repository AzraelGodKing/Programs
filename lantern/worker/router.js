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
  return env.TABLE.get(env.TABLE.idFromName(code));
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
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/join\/?$/i.test(path)) {
    const code = roomCode(path, /\/join\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    try {
      const seat = await stubFor(env, code).join(token, await readJson(request));
      if (!seat) return json(404, { error: "No table with that code." });
      return json(200, seat);
    } catch (error) {
      return rejected(error);
    }
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/order\/?$/i.test(path)) {
    const code = roomCode(path, /\/order\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    try {
      const order = await stubFor(env, code).setOrder(token, await readJson(request));
      if (!order) return json(404, { error: "No table with that code." });
      return json(200, { ok: true, order });
    } catch (error) {
      return rejected(error);
    }
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/vitals\/?$/i.test(path)) {
    const code = roomCode(path, /\/vitals\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    try {
      const order = await stubFor(env, code).setVitals(token, await readJson(request));
      if (!order) return json(404, { error: "No table with that code." });
      return json(200, { ok: true, order });
    } catch (error) {
      return rejected(error);
    }
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/shop\/?$/i.test(path)) {
    const code = roomCode(path, /\/shop\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    try {
      const shop = await stubFor(env, code).setShop(token, await readJson(request));
      if (shop === null) return json(404, { error: "No table with that code." });
      return json(200, { ok: true, shop });
    } catch (error) {
      return rejected(error);
    }
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/buyback\/?$/i.test(path)) {
    const code = roomCode(path, /\/buyback\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    try {
      const buybacks = await stubFor(env, code).tradeBuyback(token, await readJson(request));
      if (buybacks === null) return json(404, { error: "No table with that code." });
      return json(200, { ok: true, buybacks });
    } catch (error) {
      return rejected(error);
    }
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/talk\/?$/i.test(path)) {
    const code = roomCode(path, /\/talk\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    try {
      const stored = await stubFor(env, code).talk(token, await readJson(request));
      if (!stored) return json(404, { error: "No table with that code." });
      return json(200, { ok: true, message: stored });
    } catch (error) {
      return rejected(error);
    }
  }
  if (path.startsWith("/api/rooms/")) {
    const code = roomCode(path, /$/);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    const stub = stubFor(env, code);
    if (request.method === "GET") {
      const view = await stub.view(token);
      if (!view) return json(404, { error: "No table with that code." });
      return json(200, { code, ...view });
    }
    if (request.method === "POST") {
      try {
        const result = await stub.update(token, await readJson(request));
        if (!result) return json(404, { error: "No table with that code." });
        return json(200, { ok: true, shop: result.shop, order: result.order });
      } catch (error) {
        return rejected(error);
      }
    }
    return json(405, { error: "Method not allowed." });
  }
  return json(404, { error: "Not found." });
}
