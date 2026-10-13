const SEAT_KEY = "lantern.seat";

export const DM_NAME = "Dungeon Master";
export const SOLO_ROOM = "SOLO";

export function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function blankSeat() {
  return { name: "", room: "", token: "", solo: false };
}

export function loadSeat() {
  if (typeof localStorage === "undefined") return blankSeat();
  try {
    const raw = JSON.parse(localStorage.getItem(SEAT_KEY) || "{}");
    const solo = raw.solo === true;
    return {
      name: typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "",
      room: solo ? SOLO_ROOM : normalizeCode(raw.room || ""),
      token: typeof raw.token === "string" && /^[a-f0-9]{32}$/.test(raw.token) ? raw.token : "",
      solo,
    };
  } catch {
    return blankSeat();
  }
}

export function saveSeat(seat) {
  if (typeof localStorage === "undefined") return;
  const solo = seat.solo === true;
  localStorage.setItem(SEAT_KEY, JSON.stringify({
    name: String(seat.name || "").trim().slice(0, 40),
    room: solo ? SOLO_ROOM : normalizeCode(seat.room || ""),
    token: solo ? "" : String(seat.token || ""),
    solo,
  }));
}

export function rollSummary({ purpose, formula, total, detail, tag }) {
  const what = String(purpose || "").trim() || "an unnamed roll";
  const mark = tag === "natural-20" ? " Natural 20." : tag === "natural-1" ? " Natural 1." : "";
  const faces = detail ? ` ${detail}.` : "";
  return `Rolled ${total} for ${what}. ${formula}.${faces}${mark}`.replace(/\s+/g, " ").trim();
}

export function describeSetup(dice = {}, intent = "") {
  const count = Number.isInteger(dice.count) ? dice.count : 1;
  const sides = Number.isInteger(dice.sides) ? dice.sides : 20;
  const modifier = Number.isInteger(dice.modifier) ? dice.modifier : 0;
  const suffix = modifier === 0 ? "" : modifier > 0 ? ` + ${modifier}` : ` − ${Math.abs(modifier)}`;
  let text = `${count}d${sides}${suffix}`;
  if (sides === 20 && dice.mode === "advantage") text = `${count}d20 advantage${suffix}`;
  if (sides === 20 && dice.mode === "disadvantage") text = `${count}d20 disadvantage${suffix}`;
  const what = String(intent || "").trim();
  return what ? `${text} for ${what}` : text;
}

function tokenHeaders(token) {
  return token ? { "content-type": "application/json", "x-lantern-token": token } : { "content-type": "application/json" };
}

async function readError(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  return payload.error || fallback;
}

export async function createRoom() {
  const response = await fetch("/api/rooms", { method: "POST" });
  if (!response.ok) throw new Error("Could not open a table.");
  return response.json();
}

export async function joinRoom(code, name) {
  try {
    const response = await fetch(`/api/rooms/${normalizeCode(code)}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (response.status === 404) return { ok: false, error: "No table with that code." };
    if (!response.ok) return { ok: false, error: await readError(response, "Could not sit down.") };
    const payload = await response.json();
    return { ok: true, token: payload.token, name: payload.name };
  } catch {
    return { ok: false, error: "The table server is not running." };
  }
}

export async function fetchRoom(code, token = "") {
  const response = await fetch(`/api/rooms/${normalizeCode(code)}`, {
    cache: "no-store",
    headers: token ? { "x-lantern-token": token } : {},
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("The table did not answer.");
  return response.json();
}

export async function pushTable(code, body) {
  const seat = loadSeat();
  try {
    const response = await fetch(`/api/rooms/${normalizeCode(code)}`, {
      method: "POST",
      headers: tokenHeaders(seat.token),
      body: JSON.stringify(body),
    });
    if (response.status === 404) return { ok: false, error: "No table with that code." };
    if (!response.ok) return { ok: false, error: await readError(response, "The DM missed that.") };
    const payload = await response.json().catch(() => ({}));
    return { ok: true, shop: payload.shop, order: payload.order };
  } catch {
    return { ok: false, error: "The table server is not running." };
  }
}

export async function setShop(code, shop, token = "") {
  const body = typeof shop === "boolean" ? { open: shop === true } : shop;
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/shop`, {
    method: "POST",
    headers: tokenHeaders(token),
    body: JSON.stringify(body),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) throw new Error(await readError(response, "The shop switch did not take."));
  return response.json();
}

export async function postBuyback(code, body) {
  const seat = loadSeat();
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/buyback`, {
    method: "POST",
    headers: tokenHeaders(seat.token),
    body: JSON.stringify(body),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) throw new Error(await readError(response, "The counter did not take that."));
  return response.json();
}

export async function postTalk(code, { text, to = "", ask = "" }, token = "") {
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/talk`, {
    method: "POST",
    headers: tokenHeaders(token),
    body: JSON.stringify(ask ? { text, to, ask } : { text, to }),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) throw new Error(await readError(response, "The table did not hear that."));
  return response.json();
}

export async function postOrder(code, order, token) {
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/order`, {
    method: "POST",
    headers: tokenHeaders(token),
    body: JSON.stringify(order),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) throw new Error(await readError(response, "The order did not move."));
  return response.json();
}

export async function postVitals(code, body) {
  const seat = loadSeat();
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/vitals`, {
    method: "POST",
    headers: tokenHeaders(seat.token),
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return response.json();
}
