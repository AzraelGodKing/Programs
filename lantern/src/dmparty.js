// DM screen: seeing the party. Health at a glance, resources, packs and
// attunement with a search across everyone, encumbrance, and player notes.

import { abilityTotals, cleanCharacter, effectiveHp, maxHitPoints } from "./character.js";
import { attunedCount, carriedWeight, cleanExtras, encumbrance } from "./extras.js";
import { normalize } from "./store.js";

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of (Array.isArray(children) ? children : [children]).flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** What the DM needs to know about one seat, read from its snapshot and the order. */
export function seatGlance(player, hero = null) {
  const character = cleanCharacter(normalize(player.snapshot).character);
  const ex = cleanExtras(character.extras);
  const hp = hero ? hero.hp : effectiveHp(character);
  const maxHp = hero ? hero.maxHp : maxHitPoints(character);
  const slots = ex.slots
    .map((slot, index) => ({ level: index + 1, left: slot.max - slot.used, max: slot.max }))
    .filter((slot) => slot.max > 0);
  const weight = carriedWeight(character.items, ex.trinkets);
  const load = encumbrance(weight, abilityTotals(character).str || 10);
  return {
    name: character.name || player.name,
    seat: player.name,
    touched: character.touched,
    hp: Number.isInteger(hp) ? hp : null,
    maxHp: Number.isInteger(maxHp) && maxHp > 0 ? maxHp : null,
    temp: ex.tempHp,
    bloodied: Number.isInteger(hp) && Number.isInteger(maxHp) && maxHp > 0 && hp > 0 && hp <= maxHp / 2,
    down: Number.isInteger(hp) && hp <= 0,
    inspiration: character.inspiration === true,
    slots,
    resources: ex.resources.map((item) => ({ label: item.label, left: item.max - item.used, max: item.max })),
    load,
    items: [
      ...(character.items || []).map((item) => ({ name: item.name, qty: item.qty || 1, attuned: false })),
      ...ex.trinkets.map((item) => ({ name: item.name, qty: item.qty || 1, attuned: item.attuned, note: item.note })),
    ],
    attuned: attunedCount(ex),
    xp: ex.xp,
    level: character.level,
  };
}

/** Who carries something whose name has the words in it. */
export function searchPacks(glances, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const glance of glances) {
    for (const item of glance.items) {
      const name = item.name.toLowerCase();
      if (words.every((word) => name.includes(word) || name.includes(word.replace(/s$/, "")))) hits.push({ who: glance.name, ...item });
    }
  }
  return hits;
}

/** The health bar, resources, and load lines for a seat card on the party strip. */
export function glanceNodes(player, hero) {
  const glance = seatGlance(player, hero);
  if (!glance.touched) return [];
  const nodes = [];
  if (glance.hp !== null && glance.maxHp) {
    const share = Math.max(0, Math.min(100, Math.round((glance.hp / glance.maxHp) * 100)));
    nodes.push(h("span", { class: `hp-bar${glance.bloodied ? " is-bloodied" : ""}${glance.down ? " is-down" : ""}`, role: "img", "aria-label": `${glance.hp} of ${glance.maxHp} hit points` }, [
      h("span", { class: "hp-fill", style: `width: ${share}%` }),
    ]));
    if (glance.bloodied) nodes.push(h("span", { class: "tag bloodied-tag" }, "Bloodied"));
  }
  const bits = [];
  if (glance.temp) bits.push(`${glance.temp} temp`);
  if (glance.inspiration) bits.push("Inspired");
  if (glance.slots.length) bits.push(`Slots ${glance.slots.map((slot) => `${slot.level}:${slot.left}/${slot.max}`).join(" ")}`);
  for (const item of glance.resources) bits.push(`${item.label} ${item.left}/${item.max}`);
  if (bits.length) nodes.push(h("span", { class: "hint glance-line" }, bits.join(" · ")));
  if (glance.load.level !== "light") {
    nodes.push(h("span", { class: "tag load-tag" }, glance.load.level === "over" ? `Over capacity, ${glance.load.weight} lb` : `${glance.load.level === "heavy" ? "Heavily encumbered" : "Encumbered"}, ${glance.load.weight} lb`));
  }
  return nodes;
}

/** The Packs module: everyone's gear, a search across it, and the notes side by side. */
export function paintPacks(room) {
  const mount = document.getElementById("dm-packs");
  if (!mount || !document.getElementById("module-packs")?.open) return;
  const players = room?.players || [];
  const glances = players.map((player) => seatGlance(player));
  const query = document.getElementById("dm-pack-search")?.value || "";
  const hits = searchPacks(glances, query);
  const results = document.getElementById("dm-pack-hits");
  if (results) {
    results.replaceChildren(...(query.trim()
      ? (hits.length ? hits.map((hit) => h("p", {}, [h("strong", {}, hit.who), ` carries ${hit.name}${hit.qty > 1 ? ` × ${hit.qty}` : ""}${hit.attuned ? ", attuned" : ""}.`]))
        : [h("p", { class: "empty" }, "Nobody carries that.")])
      : []));
  }
  if (mount.contains(document.activeElement)) return;
  mount.replaceChildren(...(glances.length ? glances.map((glance, index) => h("article", { class: "pack-card" }, [
    h("p", { class: "sheet-title" }, `${glance.name}${glance.name !== glance.seat ? ` (${glance.seat})` : ""}`),
    h("p", { class: "hint" }, `Level ${glance.level} · ${glance.xp} XP · ${glance.load.weight} of ${glance.load.capacity} lb · attuned ${glance.attuned}/3`),
    glance.items.length
      ? h("ul", { class: "pack-list" }, glance.items.map((item) => h("li", { class: item.attuned ? "is-attuned" : "" }, `${item.name}${item.qty > 1 ? ` × ${item.qty}` : ""}${item.attuned ? " · attuned" : ""}`)))
      : h("p", { class: "empty" }, "An empty pack."),
    h("details", {}, [
      h("summary", {}, "Their scratch notes"),
      h("pre", { class: "dm-note" }, normalize(players[index].snapshot).notes || "No notes."),
    ]),
  ])) : [h("p", { class: "empty" }, "No one has joined.")]));
  const party = document.getElementById("dm-party-notes");
  if (party) party.textContent = room?.board?.notes?.text || "The party has not written anything.";
}
