const SEAT_KEY = "lantern.seat";

export const DM_NAME = "Dungeon Master";

export function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function loadSeat() {
  if (typeof localStorage === "undefined") return { name: "", room: "" };
  try {
    const raw = JSON.parse(localStorage.getItem(SEAT_KEY) || "{}");
    return {
      name: typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "",
      room: normalizeCode(raw.room || ""),
    };
  } catch {
    return { name: "", room: "" };
  }
}

export function saveSeat(seat) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SEAT_KEY, JSON.stringify({
    name: String(seat.name || "").trim().slice(0, 40),
    room: normalizeCode(seat.room || ""),
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

export async function createRoom() {
  const response = await fetch("/api/rooms", { method: "POST" });
  if (!response.ok) throw new Error("Could not open a table.");
  return response.json();
}

export async function fetchRoom(code, viewer = "") {
  const query = viewer ? `?as=${encodeURIComponent(viewer)}` : "";
  const response = await fetch(`/api/rooms/${normalizeCode(code)}${query}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("The table did not answer.");
  return response.json();
}

export async function pushTable(code, body) {
  try {
    const response = await fetch(`/api/rooms/${normalizeCode(code)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 404) return { ok: false, error: "No table with that code." };
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return { ok: false, error: payload.error || "The DM missed that." };
    }
    const payload = await response.json().catch(() => ({}));
    return { ok: true, shop: payload.shop };
  } catch {
    return { ok: false, error: "The table server is not running." };
  }
}

export async function setShop(code, shop) {
  const body = typeof shop === "boolean" ? { open: shop === true } : shop;
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/shop`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) throw new Error("The shop switch did not take.");
  return response.json();
}

export async function postBuyback(code, body) {
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/buyback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "The counter did not take that.");
  }
  return response.json();
}

export async function postOrder(code, body) {
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/order`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "The order did not take that.");
  }
  return response.json();
}

export async function postTalk(code, { name, text, to = "", ask = "" }) {
  const response = await fetch(`/api/rooms/${normalizeCode(code)}/talk`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(ask ? { name, text, to, ask } : { name, text, to }),
  });
  if (response.status === 404) throw new Error("No table with that code.");
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "The table did not hear that.");
  }
  return response.json();
}
