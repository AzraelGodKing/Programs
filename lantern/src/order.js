// One turn order for the table. The DM adds creatures and steps the round.
// A player writes their own initiative, hit points, and conditions into the row for their seat.

import { MARKS } from "./marks.js";

const ROW_CAP = 24;
const ID_RE = /^[a-z0-9-]{8,40}$/i;

export function blankOrder() {
  return { round: 1, started: false, activeId: null, rows: [], rev: 0 };
}

function int(value, fallback, min, max) {
  if (typeof value === "boolean") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanMarks(value) {
  const source = Array.isArray(value) ? value : [];
  return MARKS.filter((mark) => source.includes(mark));
}

function cleanRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && ID_RE.test(raw.id) ? raw.id : "";
  const name = text(raw.name, 80);
  if (!id || !name) return null;
  const maxHp = int(raw.maxHp, 1, 1, 999);
  const hp = int(raw.hp, 0, 0, maxHp);
  return {
    id,
    name,
    seat: text(raw.seat, 40),
    init: int(raw.init, 0, -100, 200),
    bonus: int(raw.bonus, 0, -30, 30),
    hp,
    maxHp,
    ac: raw.ac == null || raw.ac === "" ? null : int(raw.ac, null, 0, 40),
    marks: cleanMarks(raw.marks),
    added: int(raw.added, 0, 0, 1_000_000_000),
  };
}

export function turnRows(order) {
  const rows = order && Array.isArray(order.rows) ? order.rows : [];
  return [...rows].sort((a, b) => b.init - a.init || a.added - b.added);
}

export function activeRow(order) {
  if (!order || !order.started) return null;
  return (order.rows || []).find((row) => row.id === order.activeId) || null;
}

export function cleanOrder(raw) {
  const blank = blankOrder();
  if (!raw || typeof raw !== "object") return blank;
  const rows = [];
  const seen = new Set();
  for (const item of Array.isArray(raw.rows) ? raw.rows : []) {
    const row = cleanRow(item);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
    if (rows.length === ROW_CAP) break;
  }
  const started = raw.started === true && rows.length > 0;
  let activeId = rows.some((row) => row.id === raw.activeId) ? raw.activeId : null;
  if (started && !activeId) activeId = turnRows({ rows })[0].id;
  if (!started) activeId = null;
  return {
    round: int(raw.round, 1, 1, 999),
    started,
    activeId,
    rows,
    rev: int(raw.rev, 0, 0, 1_000_000_000),
  };
}

function clone(order) {
  return {
    round: order.round,
    started: order.started,
    activeId: order.activeId,
    rev: order.rev,
    rows: order.rows.map((row) => ({ ...row, marks: [...row.marks] })),
  };
}

function bump(order) {
  order.rev += 1;
  return { ok: true, order };
}

function fail(reason) {
  return { ok: false, reason };
}

function rowId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nextAdded(rows) {
  return rows.reduce((max, row) => Math.max(max, row.added), 0) + 1;
}

function placeholder(action, seat, rows) {
  const hp = int(action.hp, 0, 0, 999);
  const maxHp = int(action.maxHp, Math.max(hp, 1), 1, 999);
  return {
    id: rowId(),
    name: text(action.label, 80) || seat,
    seat,
    init: 0,
    bonus: 0,
    hp: Math.min(hp, maxHp),
    maxHp,
    ac: Number.isInteger(action.ac) ? int(action.ac, null, 0, 40) : null,
    marks: cleanMarks(action.marks),
    added: nextAdded(rows),
  };
}

function writeVitals(row, action) {
  if ("maxHp" in action && action.maxHp != null && action.maxHp !== "") {
    row.maxHp = int(action.maxHp, row.maxHp, 1, 999);
  }
  if ("hp" in action && action.hp != null && action.hp !== "") {
    row.hp = int(action.hp, row.hp, 0, row.maxHp);
  } else {
    row.hp = Math.min(row.hp, row.maxHp);
  }
  if (Number.isInteger(action.ac)) row.ac = int(action.ac, row.ac, 0, 40);
  if ("marks" in action) row.marks = cleanMarks(action.marks);
  const label = text(action.label, 80);
  if (label) row.name = label;
}

export function applyOrder(order, action, actor = {}) {
  const current = cleanOrder(order);
  const name = text(actor.name, 40);
  const dm = actor.dm === true;
  const op = action && typeof action === "object" ? action.op : "";
  if (!name) return fail("A name is required.");

  if (op === "add") {
    if (!dm) return fail("The DM adds creatures.");
    const label = text(action.label, 80);
    if (!label) return fail("Give them a name.");
    if (current.rows.length >= ROW_CAP) return fail("The order holds 24.");
    const next = clone(current);
    const hp = int(action.hp, 10, 0, 999);
    const maxHp = int(action.maxHp, Math.max(hp, 1), 1, 999);
    next.rows.push({
      id: rowId(),
      name: label,
      seat: "",
      init: int(action.init, 0, -100, 200),
      bonus: int(action.bonus, 0, -30, 30),
      hp: Math.min(hp, maxHp),
      maxHp,
      ac: Number.isInteger(action.ac) ? int(action.ac, null, 0, 40) : null,
      marks: [],
      added: nextAdded(next.rows),
    });
    return bump(next);
  }

  if (op === "remove") {
    if (!dm) return fail("The DM removes a name.");
    const next = clone(current);
    const index = next.rows.findIndex((row) => row.id === action.id);
    if (index < 0) return fail("That name is not in the order.");
    const removed = next.rows[index];
    next.rows.splice(index, 1);
    if (!next.rows.length) {
      next.started = false;
      next.round = 1;
      next.activeId = null;
    } else if (next.activeId === removed.id) {
      next.activeId = next.started ? turnRows(next)[0].id : null;
    }
    return bump(next);
  }

  if (op === "next") {
    if (!dm) return fail("The DM advances the round.");
    if (!current.rows.length) return fail("The order is empty.");
    const next = clone(current);
    const list = turnRows(next);
    if (!next.started) {
      next.started = true;
      next.activeId = list[0].id;
      next.round = Math.max(1, next.round);
      return bump(next);
    }
    const index = list.findIndex((row) => row.id === next.activeId);
    if (index < 0 || index >= list.length - 1) {
      next.activeId = list[0].id;
      if (index >= list.length - 1) next.round = Math.min(999, next.round + 1);
    } else {
      next.activeId = list[index + 1].id;
    }
    return bump(next);
  }

  if (op === "back") {
    if (!dm) return fail("The DM steps the round back.");
    const next = clone(current);
    if (!next.started || !next.rows.length) return bump(next);
    const list = turnRows(next);
    const index = list.findIndex((row) => row.id === next.activeId);
    if (index <= 0) {
      if (next.round <= 1) {
        next.round = 1;
        next.activeId = list[0].id;
      } else {
        next.round -= 1;
        next.activeId = list[list.length - 1].id;
      }
    } else {
      next.activeId = list[index - 1].id;
    }
    return bump(next);
  }

  if (op === "initiative") {
    if (dm) return fail("Players roll their own initiative.");
    const next = clone(current);
    let row = next.rows.find((item) => item.seat === name);
    if (!row) {
      if (next.rows.length >= ROW_CAP) return fail("The order holds 24.");
      row = {
        id: rowId(),
        name: text(action.label, 80) || name,
        seat: name,
        init: 0,
        bonus: 0,
        hp: 1,
        maxHp: 1,
        ac: null,
        marks: cleanMarks(action.marks),
        added: nextAdded(next.rows),
      };
      next.rows.push(row);
    }
    row.name = text(action.label, 80) || row.name;
    row.init = int(action.init, row.init, -100, 200);
    row.bonus = int(action.bonus, row.bonus, -30, 30);
    if ("maxHp" in action && action.maxHp != null && action.maxHp !== "") {
      row.maxHp = int(action.maxHp, row.maxHp, 1, 999);
    }
    if ("hp" in action && action.hp != null && action.hp !== "") {
      row.hp = int(action.hp, row.hp, 0, row.maxHp);
    }
    if (Number.isInteger(action.ac)) row.ac = int(action.ac, row.ac, 0, 40);
    if ("marks" in action) row.marks = cleanMarks(action.marks);
    if (!next.started) next.activeId = null;
    return bump(next);
  }

  if (op === "vitals") {
    const next = clone(current);
    let row = null;
    if (dm) {
      if (typeof action.id === "string") row = next.rows.find((item) => item.id === action.id) || null;
      const seat = text(action.seat, 40);
      if (!row && seat) row = next.rows.find((item) => item.seat === seat) || null;
      if (!row && seat) {
        if (next.rows.length >= ROW_CAP) return fail("The order holds 24.");
        row = placeholder(action, seat, next.rows);
        next.rows.push(row);
        return bump(next);
      }
      if (!row) return fail("That name is not in the order.");
    } else {
      row = next.rows.find((item) => item.seat === name) || null;
      if (!row) {
        if (next.rows.length >= ROW_CAP) return fail("The order holds 24.");
        row = placeholder(action, name, next.rows);
        next.rows.push(row);
        return bump(next);
      }
    }
    writeVitals(row, action);
    return bump(next);
  }

  if (op === "step") {
    const delta = int(action.delta, null, -999, 999);
    if (delta == null) return fail("Hit points need a step.");
    const next = clone(current);
    let row = null;
    if (dm) {
      row = next.rows.find((item) => item.id === action.id) || null;
      if (!row) return fail("That name is not in the order.");
    } else {
      row = next.rows.find((item) => item.seat === name) || null;
      if (!row) return fail("Roll initiative, or the DM has not added you.");
      if (action.id && action.id !== row.id) return fail("That name is not yours.");
    }
    row.hp = Math.min(row.maxHp, Math.max(0, row.hp + delta));
    return bump(next);
  }

  return fail("That is not an order action.");
}
