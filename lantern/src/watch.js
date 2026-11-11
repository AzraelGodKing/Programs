// The spectator page: a read-only look at one table. The link carries the
// table code and a watch token in the fragment, like watch.html#ABCD.<token>.

import { createMapView } from "./battlemap.js";
import { hourText } from "./combat.js";
import { fetchRoom, mapImage, normalizeCode } from "./table.js";
import { paintTalk, presence } from "./talk.js";

/** Reads "ABCD.<32 hex>" from the link's fragment. */
export function parseWatchLink(hash) {
  const match = String(hash || "").replace(/^#/, "").match(/^([A-Za-z0-9]{4})\.([a-f0-9]{32})$/);
  return match ? { code: normalizeCode(match[1]), token: match[2] } : null;
}

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

const byId = (id) => document.getElementById(id);
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function paintOrder(order) {
  const rows = order?.combatants || [];
  byId("watch-round").textContent = !rows.length ? "No fight right now." : order.started ? `Round ${order.round || 1}${order.hiddenTurn ? ". Something unseen is acting." : ""}` : "The order is set. The fight has not started.";
  byId("watch-order").replaceChildren(...rows.map((person) => h("li", { class: person.id === order.activeId ? "is-turn" : "", "aria-current": person.id === order.activeId ? "true" : null }, [
    h("span", { class: "watch-init" }, String(person.init ?? "")),
    h("span", {}, person.name),
    person.id === order.activeId ? h("span", { class: "hint" }, "acting now") : null,
    person.marks?.length ? h("span", { class: "hint" }, person.marks.join(", ")) : null,
  ])));
}

function paintParty(players) {
  byId("watch-party").replaceChildren(...(players.length ? players.map((player) => {
    const hero = player.snapshot?.character || {};
    const here = presence(player.seen);
    return h("li", {}, [
      h("span", {}, hero.name && hero.name !== player.name ? `${hero.name} (${player.name})` : player.name),
      h("span", { class: "hint" }, [hero.level ? `level ${hero.level}` : "", typeof here === "string" ? here : here?.label || ""].filter(Boolean).join(", ")),
    ]);
  }) : [h("li", { class: "hint" }, "Nobody is seated yet.")]));
}

function paintRolls(events) {
  const mount = byId("watch-rolls");
  mount.replaceChildren(...(events.length ? events.slice(0, 80).map((event) => h("p", { class: `feed-row${/Natural 20/.test(event.summary) ? " natural-20" : /Natural 1\b/.test(event.summary) ? " natural-1" : ""}` }, [
    h("span", { class: "hint" }, `${clock(event.at)} `),
    h("strong", { class: "feed-name" }, event.name),
    h("span", { class: "feed-summary" }, ` ${event.summary}`),
  ])) : [h("p", { class: "hint" }, "Nothing has been rolled yet.")]));
}

function paintBoard(board) {
  const quests = board?.quests || [];
  byId("watch-quests").replaceChildren(...(quests.length ? quests.map((quest) => h("li", { class: quest.done ? "is-done" : "" }, [h("span", {}, quest.done ? "Done: " : "Open: "), quest.title])) : [h("li", { class: "hint" }, "No quests are on the board.")]));
  const next = board?.next;
  byId("watch-next").replaceChildren(...(next ? [h("p", {}, [h("strong", {}, "Next session: "), [next.label, next.at ? new Date(next.at).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""].filter(Boolean).join(", ")])] : []));
  const world = board?.world;
  byId("watch-world").textContent = [
    world ? `Day ${world.day}, ${hourText(world.hour)}${world.weather ? `, ${world.weather}` : ""}` : "",
    board?.mood?.label ? `Mood: ${board.mood.label}` : "",
    board?.pause ? "The table is paused." : "",
  ].filter(Boolean).join(" · ");
}

function boot() {
  const link = parseWatchLink(location.hash);
  const status = byId("watch-status");
  if (!link) {
    status.textContent = "This spectator link is not complete. Ask the DM for a new one.";
    return;
  }
  const mapView = createMapView(byId("watch-map"), { image: (rev) => mapImage(link.code, rev, link.token) });
  let drawn = "";
  async function look() {
    let room;
    try {
      room = await fetchRoom(link.code, link.token);
    } catch {
      status.hidden = false;
      status.textContent = "The table did not answer. Trying again.";
      return;
    }
    if (!room || room.locked || !room.watching) {
      byId("watch-body").hidden = true;
      status.hidden = false;
      status.textContent = room ? "This spectator link has been turned off. Ask the DM for a new one." : "That table has closed.";
      return;
    }
    status.hidden = true;
    byId("watch-body").hidden = false;
    byId("watch-map-card").hidden = !room.map;
    mapView.paint(room.map, {});
    paintParty(room.players || []);
    const signature = JSON.stringify([room.order, room.messages, room.events, room.board]);
    if (signature === drawn) return;
    drawn = signature;
    paintOrder(room.order);
    paintTalk(byId("watch-talk"), room.messages || [], {});
    paintRolls(room.events || []);
    paintBoard(room.board);
  }
  void look();
  setInterval(() => { if (!document.hidden) void look(); }, 3000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void look(); });
}

if (typeof document !== "undefined") boot();
