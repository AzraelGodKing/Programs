// Ability score modes the DM unlocks for a table. The server rolls and keeps
// the record, so refreshing the page or switching methods cannot reroll.
//
// d20: six d20s, assigned in order STR, DEX, CON, INT, WIS, CHA. Race and
//      class come first.
// d100: one d100 is a pool of points. Every score starts at 1 and the points
//      go on top, no score above 20, every point spent.
// coin: every score starts at 10. Pick a score, call heads or tails. Right is
//      +2, wrong is -2. It ends when you tap out, a score reaches 2 or 20, or
//      you call it wrong three times in a row.

export const ROLL_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

export const ROLL_MODES = [
  { id: "d20", label: "d20 in order", blurb: "Roll a d20 six times. The results go to STR, DEX, CON, INT, WIS, CHA in that order. No swapping." },
  { id: "d100", label: "d100 pool", blurb: "Roll a d100 once. That many points go on top of a 1 in each score. No score above 20." },
  { id: "coin", label: "Coin flip", blurb: "Every score starts at 10. Pick one and call the coin: +2 if you are right, -2 if not. Stop when you like, when a score hits 2 or 20, or after three wrong calls in a row." },
];

export const ROLL_MODE_IDS = ROLL_MODES.map((mode) => mode.id);
export const D100_BASE = 1;
export const D100_MAX = 20;
const COIN_START = 10;
const COIN_LOW = 2;
const COIN_HIGH = 20;
const COIN_STEP = 2;
const COIN_MISSES = 3;
const FLIP_CAP = 60;

export function findRollMode(id) {
  return ROLL_MODES.find((mode) => mode.id === id) || null;
}

function die(sides, rng) {
  return 1 + Math.floor(rng() * sides);
}

/** The DM's settings, safe to store: which modes are open and whether the usual methods stay. */
export function cleanRollSettings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const modes = Array.isArray(value.modes) ? ROLL_MODE_IDS.filter((id) => value.modes.includes(id)) : [];
  return { modes, only: Boolean(value.only) && modes.length > 0 };
}

export function startD20(rng = Math.random, now = Date.now()) {
  const dice = ROLL_ORDER.map(() => die(20, rng));
  const scores = Object.fromEntries(ROLL_ORDER.map((id, index) => [id, dice[index]]));
  return { mode: "d20", at: now, dice, scores, done: true, end: "rolled" };
}

export function startD100(rng = Math.random, now = Date.now()) {
  return { mode: "d100", at: now, pool: die(100, rng), scores: null, done: false, end: "" };
}

export function startCoin(now = Date.now()) {
  return {
    mode: "coin",
    at: now,
    scores: Object.fromEntries(ROLL_ORDER.map((id) => [id, COIN_START])),
    flips: [],
    count: 0,
    misses: 0,
    done: false,
    end: "",
  };
}

export function startRoll(mode, rng = Math.random, now = Date.now()) {
  if (mode === "d20") return startD20(rng, now);
  if (mode === "d100") return startD100(rng, now);
  if (mode === "coin") return startCoin(now);
  return null;
}

/** Points a d100 spread uses, or an error line. Scores are whole numbers from 1 to 20. */
export function checkD100(pool, scores) {
  if (!scores || typeof scores !== "object") return { ok: false, reason: "Set all six scores." };
  let spent = 0;
  const clean = {};
  for (const id of ROLL_ORDER) {
    const value = Number(scores[id]);
    if (!Number.isInteger(value) || value < D100_BASE || value > D100_MAX) {
      return { ok: false, reason: `Each score sits between ${D100_BASE} and ${D100_MAX}.` };
    }
    clean[id] = value;
    spent += value - D100_BASE;
  }
  if (spent > pool) return { ok: false, reason: `That spends ${spent} points. You have ${pool}.`, spent };
  // Six scores of 20 hold 114 points, more than a d100 gives, so every point has a home.
  if (spent < pool) return { ok: false, reason: `${pool - spent} points left to place.`, spent };
  return { ok: true, scores: clean, spent };
}

/** Lock in a d100 spread. Returns the finished record, or an error line. */
export function finishD100(record, scores, now = Date.now()) {
  if (!record || record.mode !== "d100") return { ok: false, reason: "Roll the d100 first." };
  if (record.done) return { ok: false, reason: "Those scores are already locked in." };
  const check = checkD100(record.pool, scores);
  if (!check.ok) return check;
  return { ok: true, record: { ...record, scores: check.scores, done: true, end: "placed", doneAt: now } };
}

/** One coin flip on one score. Returns the next record, or an error line. */
export function flipCoin(record, ability, call, rng = Math.random, now = Date.now()) {
  if (!record || record.mode !== "coin") return { ok: false, reason: "Start the coin flip first." };
  if (record.done) return { ok: false, reason: "The coin flip is over." };
  if (!ROLL_ORDER.includes(ability)) return { ok: false, reason: "Pick a score to flip for." };
  if (call !== "heads" && call !== "tails") return { ok: false, reason: "Call heads or tails." };
  const side = rng() < 0.5 ? "heads" : "tails";
  const right = side === call;
  const before = record.scores[ability];
  const after = Math.max(COIN_LOW, Math.min(COIN_HIGH, before + (right ? COIN_STEP : -COIN_STEP)));
  const scores = { ...record.scores, [ability]: after };
  const misses = right ? 0 : record.misses + 1;
  let end = "";
  if (after <= COIN_LOW || after >= COIN_HIGH) end = "edge";
  else if (misses >= COIN_MISSES) end = "misses";
  const flip = { ability, call, side, right, score: after };
  const flips = [...record.flips, flip].slice(-FLIP_CAP);
  return {
    ok: true,
    flip,
    record: { ...record, scores, flips, count: record.count + 1, misses, done: Boolean(end), end, ...(end ? { doneAt: now } : {}) },
  };
}

export function stopCoin(record, now = Date.now()) {
  if (!record || record.mode !== "coin") return { ok: false, reason: "Start the coin flip first." };
  if (record.done) return { ok: false, reason: "The coin flip is over." };
  return { ok: true, record: { ...record, done: true, end: "stopped", doneAt: now } };
}

function scoreLine(scores) {
  if (!scores) return "";
  return ROLL_ORDER.map((id) => `${id.toUpperCase()} ${scores[id]}`).join(", ");
}

const ENDS = {
  edge: "a score reached the edge",
  misses: "three wrong calls in a row",
  stopped: "tapped out",
};

/** One plain line about a record, for the table log and the DM's seat list. */
export function rollLine(record) {
  if (!record) return "";
  if (record.mode === "d20") return `d20 in order: ${scoreLine(record.scores)}.`;
  if (record.mode === "d100") {
    return record.done
      ? `d100 pool of ${record.pool}: ${scoreLine(record.scores)}.`
      : `d100 pool of ${record.pool}, still placing points.`;
  }
  if (record.mode === "coin") {
    const flips = `${record.count} flip${record.count === 1 ? "" : "s"}`;
    return record.done
      ? `Coin flip, ${flips}, ${ENDS[record.end] || "done"}: ${scoreLine(record.scores)}.`
      : `Coin flip in progress, ${flips}: ${scoreLine(record.scores)}.`;
  }
  return "";
}
