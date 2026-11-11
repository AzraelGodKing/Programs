// The battle map as plain data: a grid, a fog layer, and tokens. The room
// rules and every screen use this module, so the map means the same everywhere.

export const MAP_SIDE = 40;
export const TOKEN_CAP = 60;
export const TOKEN_KINDS = ["pc", "foe", "ally", "thing"];
export const TOKEN_COLORS = ["#e0a458", "#7fb069", "#6ca0dc", "#d1603d", "#b48ead", "#e5c07b", "#56b6c2", "#e06c9f"];
const KIND_COLOR = { pc: "#6ca0dc", foe: "#d1603d", ally: "#7fb069", thing: "#e5c07b" };

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function words(value, max) {
  return typeof value === "string" ? value.split(/\s+/).filter(Boolean).join(" ").slice(0, max) : "";
}

export function blankMap() {
  return { on: false, cols: 20, rows: 15, fog: "", tokens: [], image: 0 };
}

/** The fog as one character per cell, row by row: "1" is hidden. */
export function cleanFog(value, cols, rows) {
  const size = cols * rows;
  const raw = typeof value === "string" ? value.replace(/[^01]/g, "0") : "";
  return raw.slice(0, size).padEnd(size, "0");
}

export function cleanToken(raw, cols, rows) {
  if (!raw || typeof raw !== "object") return null;
  const name = words(raw.name, 40);
  if (!name || typeof raw.id !== "string" || !/^[a-f0-9]{16}$/.test(raw.id)) return null;
  const kind = TOKEN_KINDS.includes(raw.kind) ? raw.kind : "foe";
  const token = {
    id: raw.id,
    name,
    kind,
    color: typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color.toLowerCase() : KIND_COLOR[kind],
    x: int(raw.x, 0, 0, cols - 1),
    y: int(raw.y, 0, 0, rows - 1),
    size: int(raw.size, 1, 1, 4),
  };
  if (raw.hidden === true) token.hidden = true;
  const seat = words(raw.seat, 40);
  if (seat) token.seat = seat;
  return token;
}

export function cleanMap(raw) {
  const base = { ...blankMap(), ...(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) };
  const cols = int(base.cols, 20, 4, MAP_SIDE);
  const rows = int(base.rows, 15, 4, MAP_SIDE);
  return {
    on: base.on === true,
    cols,
    rows,
    fog: cleanFog(base.fog, cols, rows),
    tokens: (Array.isArray(base.tokens) ? base.tokens : []).map((token) => cleanToken(token, cols, rows)).filter(Boolean).slice(0, TOKEN_CAP),
    image: int(base.image, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

export const cellIndex = (map, x, y) => y * map.cols + x;

export function fogged(map, x, y) {
  return map.fog[cellIndex(map, x, y)] === "1";
}

/** Hides or reveals a list of cells, or every cell when `cells` is "all". */
export function paintFog(map, cells, hidden) {
  const mark = hidden ? "1" : "0";
  if (cells === "all") return mark.repeat(map.cols * map.rows);
  const fog = map.fog.split("");
  for (const cell of Array.isArray(cells) ? cells.slice(0, MAP_SIDE * MAP_SIDE) : []) {
    if (Number.isInteger(cell) && cell >= 0 && cell < fog.length) fog[cell] = mark;
  }
  return fog.join("");
}

/** A new size keeps what was drawn where the two grids overlap. */
export function resizeMap(map, cols, rows) {
  const next = { ...map, cols: int(cols, map.cols, 4, MAP_SIDE), rows: int(rows, map.rows, 4, MAP_SIDE) };
  let fog = "";
  for (let y = 0; y < next.rows; y += 1) {
    for (let x = 0; x < next.cols; x += 1) fog += x < map.cols && y < map.rows && fogged(map, x, y) ? "1" : "0";
  }
  next.fog = fog;
  next.tokens = map.tokens.map((token) => ({ ...token, x: Math.min(token.x, next.cols - 1), y: Math.min(token.y, next.rows - 1) }));
  return next;
}

/** The first cell with no token on it, reading left to right from the top. */
export function freeCell(map) {
  const taken = new Set(map.tokens.map((token) => cellIndex(map, token.x, token.y)));
  for (let cell = 0; cell < map.cols * map.rows; cell += 1) {
    if (!taken.has(cell)) return { x: cell % map.cols, y: Math.floor(cell / map.cols) };
  }
  return { x: 0, y: 0 };
}

/**
 * What a viewer sees. The DM sees everything. Everyone else gets nothing until
 * the map is shown, and never a hidden token or a creature standing in the fog.
 * A hero's own token always shows, so nobody loses themselves.
 */
export function mapFor(input, who) {
  const map = cleanMap(input);
  if (who?.role === "dm") return map;
  if (!map.on) return null;
  return {
    ...map,
    tokens: map.tokens.filter((token) => !token.hidden && (token.kind === "pc" || !fogged(map, token.x, token.y))),
  };
}

/** Two letters for a token: "Goblin 2" is G2, "Mira Thorn" is MT, "Orc" is OR. */
export function tokenLabel(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1];
  return (parts[0][0] + (/^\d+$/.test(last) ? last.slice(-1) : last[0])).toUpperCase();
}

/** The cell under a point, given the map's box on screen. */
export function cellAt(map, box, clientX, clientY) {
  const x = Math.floor(((clientX - box.left) / box.width) * map.cols);
  const y = Math.floor(((clientY - box.top) / box.height) * map.rows);
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return null;
  return { x, y };
}
