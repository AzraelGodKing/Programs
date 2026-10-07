/** HTTP routes for the shared table. Static files stay on the assets binding. */

import {
  BODY_BYTES,
  TableError,
  cleanTalk,
  cleanUpdate,
  randomCode,
  validCode,
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
  if (path === "/api/rooms" || path === "/api/rooms/") {
    if (request.method === "POST") {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const code = randomCode();
        if (await stubFor(env, code).create()) return json(201, { code });
      }
      return json(400, { error: "Could not open a table." });
    }
    return json(405, { error: "Open a table with POST." });
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/shop\/?$/i.test(path)) {
    const code = roomCode(path, /\/shop\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    try {
      const shop = await stubFor(env, code).setShop(await readJson(request));
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
      const buybacks = await stubFor(env, code).tradeBuyback(await readJson(request));
      if (buybacks === null) return json(404, { error: "No table with that code." });
      return json(200, { ok: true, buybacks });
    } catch (error) {
      return rejected(error);
    }
  }
  if (request.method === "POST" && path.startsWith("/api/rooms/") && /\/talk\/?$/i.test(path)) {
    const code = roomCode(path, /\/talk\/?$/i);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    let message;
    try {
      message = cleanTalk(await readJson(request));
    } catch (error) {
      return rejected(error);
    }
    const stored = await stubFor(env, code).talk(message);
    if (!stored) return json(404, { error: "No table with that code." });
    return json(200, { ok: true, message: stored });
  }
  if (path.startsWith("/api/rooms/")) {
    const code = roomCode(path, /$/);
    if (!validCode(code)) return json(404, { error: "No table with that code." });
    const stub = stubFor(env, code);
    if (request.method === "GET") {
      const view = await stub.view(url.searchParams.get("as") || "");
      if (!view) return json(404, { error: "No table with that code." });
      return json(200, { code, ...view });
    }
    if (request.method === "POST") {
      let update;
      try {
        update = cleanUpdate(await readJson(request));
      } catch (error) {
        return rejected(error);
      }
      if (!await stub.update(update)) return json(404, { error: "No table with that code." });
      const view = await stub.view();
      return json(200, { ok: true, shop: view ? view.shop : false });
    }
    return json(405, { error: "Method not allowed." });
  }
  return json(404, { error: "Not found." });
}
