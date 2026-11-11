// DM screen: rewards. Loot into the stash or one pack, inspiration with a
// reason, experience and milestones, magic items that are identified later,
// and treasure hoards by challenge rating.

import { formatCoin, parseCoin } from "./gear.js";
import { postBoard } from "./table.js";
import { rollHoard } from "./treasure.js";

const GIVEN_KEY = "lantern.dm.given";
const GIVEN_CAP = 40;
let hooks = null;
let lastHoard = null;

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

function hexKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function givenKey() {
  return `${GIVEN_KEY}.${hooks?.code() || "none"}`;
}

function loadGiven() {
  try {
    const list = JSON.parse(localStorage.getItem(givenKey()) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveGiven(list) {
  try { localStorage.setItem(givenKey(), JSON.stringify(list.slice(-GIVEN_CAP))); } catch { /* still given */ }
}

function paintTargets(room) {
  const names = (room?.players || []).map((player) => player.name);
  for (const select of document.querySelectorAll("[data-reward-to]")) {
    if (document.activeElement === select) continue;
    const current = select.value;
    const first = select.dataset.rewardTo === "stash"
      ? [h("option", { value: "@stash" }, "The party stash"), h("option", { value: "" }, "Each player")]
      : [h("option", { value: "" }, "Everyone")];
    select.replaceChildren(...first, ...names.map((name) => h("option", { value: name }, name)));
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }
}

function paintGiven() {
  const mount = document.getElementById("dm-given");
  if (!mount) return;
  const unknown = loadGiven().filter((item) => item.shown && !item.identified);
  mount.replaceChildren(...(unknown.length ? unknown.map((item) => h("div", { class: "gear-row" }, [
    h("span", {}, `${item.to}: "${item.shown}" is really ${item.name}`),
    h("button", { type: "button", class: "btn", "data-reward-identify": item.key }, "Identify"),
  ])) : [h("p", { class: "empty" }, "No unidentified items are out.")]));
}

function paintHoard() {
  const mount = document.getElementById("dm-hoard");
  if (!mount) return;
  if (!lastHoard) {
    mount.replaceChildren();
    return;
  }
  mount.replaceChildren(
    h("p", { class: "sheet-title" }, `Coin: ${formatCoin(lastHoard.cp)}`),
    lastHoard.items.length ? h("ul", { class: "pack-list" }, lastHoard.items.map((item) => h("li", {}, item))) : h("p", { class: "hint" }, "No finds beyond the coin."),
    h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn primary", "data-reward-hoard": "stash" }, "Put it all in the party stash"),
      h("button", { type: "button", class: "text-btn", "data-reward-hoard": "again" }, "Roll again"),
    ]),
  );
}

async function send(body, done) {
  try {
    await postBoard(hooks.code(), body, hooks.token());
    hooks.status(done);
    await hooks.refresh();
    return true;
  } catch (error) {
    hooks.status(error.message);
    return false;
  }
}

async function giveLoot(form) {
  const to = form.elements.to.value;
  const name = form.elements.name.value.trim();
  const qty = Math.max(1, Math.min(99, Number(form.elements.qty.value) || 1));
  const coin = form.elements.coin.value.trim();
  const cp = coin ? parseCoin(coin) : 0;
  if (coin && cp == null) {
    hooks.status("Write coin like 25 gp or 40 sp.");
    return;
  }
  if (!name && !cp) {
    hooks.status("Name an item or write some coin.");
    return;
  }
  const reason = form.elements.reason.value.trim();
  if (to === "@stash") {
    if (name) await send({ op: "stash-put", name, qty }, `${name} is in the stash.`);
    if (cp) await send({ op: "coin-put", cp }, `${formatCoin(cp)} is in the coin pot.`);
  } else {
    if (name) {
      const key = hexKey();
      const shown = form.elements.shown.value.trim();
      const text = form.elements.text.value.trim();
      const ok = await send({
        op: "gift", kind: "item", to, name, qty, text, key, reason,
        shown, attune: form.elements.attune.checked,
      }, to ? `${name} is on its way to ${to}.` : `Everyone gets ${name}.`);
      if (ok && shown) {
        const names = to ? [to] : (hooks.room()?.players || []).map((player) => player.name);
        saveGiven([...loadGiven(), ...names.map((who) => ({ key, to: who, name, shown, text }))]);
      }
    }
    if (cp) await send({ op: "gift", kind: "coin", to, cp, reason }, to ? `${formatCoin(cp)} for ${to}.` : `${formatCoin(cp)} for each player.`);
  }
  form.reset();
  paintGiven();
}

async function identify(key) {
  const list = loadGiven();
  const matches = list.filter((item) => item.key === key && !item.identified);
  for (const item of matches) {
    const ok = await send({ op: "gift", kind: "identify", to: item.to, key, name: item.name, text: item.text }, `${item.to} learns what ${item.shown} is.`);
    if (ok) item.identified = true;
  }
  saveGiven(list);
  paintGiven();
}

async function hoardToStash() {
  if (!lastHoard) return;
  for (const item of lastHoard.items) await send({ op: "stash-put", name: item.slice(0, 60), qty: 1 }, "The hoard is in the stash.");
  if (lastHoard.cp) await send({ op: "coin-put", cp: lastHoard.cp }, "The hoard is in the stash.");
  lastHoard = null;
  paintHoard();
}

/** Called after each poll. */
export function paintRewards(room) {
  if (!document.getElementById("module-rewards")?.open) return;
  paintTargets(room);
}

export function rewardsTableChanged() {
  lastHoard = null;
  paintGiven();
  paintHoard();
}

/** hooks: code, token, room, status, refresh. */
export function bootRewards(next) {
  hooks = next;
  const module = document.getElementById("module-rewards");
  module?.addEventListener("toggle", () => {
    paintTargets(hooks.room());
    paintGiven();
  });
  document.getElementById("dm-loot-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void giveLoot(event.target);
  });
  document.getElementById("dm-inspire-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const to = form.elements.to.value;
    void send({ op: "gift", kind: "inspiration", to, reason: form.elements.reason.value.trim() }, to ? `${to} is inspired.` : "Everyone is inspired.").then((ok) => ok && form.reset());
  });
  document.getElementById("dm-xp-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const total = Math.max(0, Math.floor(Number(form.elements.xp.value) || 0));
    const players = hooks.room()?.players || [];
    const to = form.elements.to.value;
    const each = !to && form.elements.split.checked && players.length ? Math.floor(total / players.length) : total;
    if (!each) {
      hooks.status("Write the experience to give.");
      return;
    }
    void send({ op: "gift", kind: "xp", to, xp: each, reason: form.elements.reason.value.trim() }, `${each} XP ${to ? `for ${to}` : "for each player"}.`).then((ok) => ok && form.reset());
  });
  document.getElementById("dm-milestone")?.addEventListener("click", () => {
    void send({ op: "gift", kind: "xp", to: "", milestone: true, reason: document.getElementById("dm-milestone-reason")?.value.trim() || "" }, "Everyone reaches a new level.");
  });
  document.getElementById("dm-hoard-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    lastHoard = rollHoard(event.target.elements.cr.value);
    paintHoard();
  });
  module?.addEventListener("click", (event) => {
    const id = event.target.closest("[data-reward-identify]");
    if (id) {
      void identify(id.dataset.rewardIdentify);
      return;
    }
    const hoard = event.target.closest("[data-reward-hoard]");
    if (!hoard) return;
    if (hoard.dataset.rewardHoard === "again") {
      lastHoard = rollHoard(document.querySelector("#dm-hoard-form [name=cr]").value);
      paintHoard();
    } else void hoardToStash();
  });
}
