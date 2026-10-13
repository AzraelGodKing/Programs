/** Local Lantern server. Table rules are worker/room.js, the same module the Worker runs. */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./worker/router.js";
import { TableRoom } from "./worker/room.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const rooms = new Map();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

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

function facade(code) {
  if (!rooms.has(code)) rooms.set(code, new TableRoom(memoryStorage()));
  const room = rooms.get(code);
  return {
    create: () => room.create(),
    join: (token, payload) => room.join(token, payload),
    view: (token) => room.view(token),
    update: (token, body) => room.update(token, body),
    setShop: (token, body) => room.setShop(token, body),
    tradeBuyback: (token, body) => room.tradeBuyback(token, body),
    talk: (token, body) => room.talk(token, body),
    setOrder: (token, body) => room.setOrder(token, body),
    rollInitiative: (token, body) => room.rollInitiative(token, body),
    setVitals: (token, body) => room.setVitals(token, body),
  };
}

const env = {
  TABLE: {
    idFromName(code) {
      return code;
    },
    get(code) {
      return facade(code);
    },
  },
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const relative = pathname.replace(/^\/+/, "");
      const root = ROOT.endsWith(sep) ? ROOT : `${ROOT}${sep}`;
      const file = normalize(join(root, relative));
      if (!file.startsWith(root)) return new Response("Not found", { status: 404 });
      try {
        const body = await readFile(file);
        const type = TYPES[extname(file)] || "application/octet-stream";
        return new Response(body, { headers: { "content-type": type } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
};

const server = createServer(async (req, res) => {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: body.length && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });
  const response = await handleRequest(request, env);
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lantern at http://127.0.0.1:${PORT}/`);
  console.log(`Player seat at http://127.0.0.1:${PORT}/player.html`);
  console.log(`DM screen at http://127.0.0.1:${PORT}/dm.html`);
});
