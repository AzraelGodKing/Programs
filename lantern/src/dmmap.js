// DM screen: the battle map. The DM sets the grid and a picture, places
// tokens, and paints the fog. Players see only what the fog leaves open.

import { createMapView, shrinkImage } from "./battlemap.js";
import { cellIndex, fogged, paintFog, TOKEN_KINDS } from "./mapgrid.js";
import { mapImage, postMap } from "./table.js";

const IMAGE_CHARS = 270_000;
const KIND_NAME = { pc: "Hero", foe: "Foe", ally: "Ally", thing: "Object" };
let hooks = null;
let view = null;
let tool = "move";
let selected = "";
let local = null;
let stroke = null;
let busy = 0;

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

const say = (text) => {
  const node = document.getElementById("dm-map-status");
  if (node) node.textContent = text;
};

async function send(body, done = "") {
  busy += 1;
  try {
    const result = await postMap(hooks.code(), body, hooks.token());
    if (result?.map) local = result.map;
    if (done) say(done);
    return result;
  } catch (error) {
    say(error.message);
    return null;
  } finally {
    busy -= 1;
    paint();
  }
}

function paintTokens(map) {
  const mount = document.getElementById("dm-map-tokens");
  if (!mount || mount.contains(document.activeElement)) return;
  mount.replaceChildren(...(map.tokens.length ? map.tokens.map((token) => h("div", { class: `gear-row map-token-row${token.id === selected ? " is-picked" : ""}` }, [
    h("button", { type: "button", class: "text-btn", "data-map-pick": token.id, "aria-pressed": token.id === selected ? "true" : "false" }, token.name),
    h("span", { class: "hint" }, `${KIND_NAME[token.kind]}${token.seat ? `, ${token.seat} moves it` : ""}${token.hidden ? ", hidden" : fogged(map, token.x, token.y) && token.kind !== "pc" ? ", in the fog" : ""}`),
    h("button", { type: "button", class: "text-btn", "data-map-hide": token.id, "data-on": token.hidden ? "false" : "true" }, token.hidden ? "Show" : "Hide"),
    h("button", { type: "button", class: "text-btn", "data-map-size": token.id, "data-size": String(token.size >= 3 ? 1 : token.size + 1), title: "Medium, Large, Huge" }, `Size ${token.size}`),
    h("button", { type: "button", class: "text-btn danger", "data-map-remove": token.id }, "Remove"),
  ])) : [h("p", { class: "empty" }, "No tokens yet. Add the party, the creatures in the order, or one by name.")]));
}

function paint() {
  const module = document.getElementById("module-map");
  if (!module?.open || !local) return;
  view?.paint(local, { dm: true, tool, selected });
  paintTokens(local);
  const show = document.getElementById("dm-map-show");
  if (show) {
    show.textContent = local.on ? "Take the map away" : "Show the map to players";
    show.setAttribute("aria-pressed", local.on ? "true" : "false");
  }
  const now = document.getElementById("dm-map-now");
  if (now) now.textContent = local.on ? "Players and spectators see this map, without what the fog and Hide keep back." : "Only you see the map. Set it up, then show it.";
  for (const node of document.querySelectorAll("[data-map-tool]")) node.setAttribute("aria-pressed", node.dataset.mapTool === tool ? "true" : "false");
  const form = document.getElementById("dm-map-size");
  if (form && !form.contains(document.activeElement)) {
    form.elements.cols.value = local.cols;
    form.elements.rows.value = local.rows;
  }
  const hint = document.getElementById("dm-map-hint");
  if (hint) {
    const picked = local.tokens.find((token) => token.id === selected);
    hint.textContent = tool === "move"
      ? picked ? `${picked.name} is picked. Tap a square to move it there, or use the arrow keys.` : "Tap a token, then tap the square it moves to."
      : tool === "hide" ? "Drag across squares to cover them in fog." : "Drag across squares to clear the fog.";
  }
}

/** Called after each poll. A stroke or a save in flight keeps the DM's own copy. */
export function paintMapModule(room) {
  if (room?.map && !busy && !stroke) local = room.map;
  paint();
}

function move(token, x, y) {
  if (!local || x < 0 || y < 0 || x >= local.cols || y >= local.rows) return;
  local = { ...local, tokens: local.tokens.map((item) => (item.id === token.id ? { ...item, x, y } : item)) };
  paint();
  void send({ op: "token-move", id: token.id, x, y });
}

async function setImage(file) {
  say("Shrinking the picture…");
  try {
    const { url } = await shrinkImage(file, IMAGE_CHARS);
    await send({ op: "image", image: url }, "The picture is on the map.");
  } catch (error) {
    say(error.message || "That picture did not read.");
  }
}

async function addFromOrder() {
  const order = hooks.order();
  const have = new Set((local?.tokens || []).map((token) => token.name.toLowerCase()));
  const fresh = (order?.combatants || []).filter((person) => !have.has(person.name.toLowerCase()));
  if (!fresh.length) return say("Everyone in the order is already on the map.");
  for (const person of fresh) {
    const added = await send({ op: "token-add", name: person.name, kind: person.seat ? "pc" : "foe", seat: person.seat || "", hidden: person.hidden === true });
    if (!added) return;
  }
  say(`Added ${fresh.length} from the order.`);
}

function onClick(event) {
  const t = event.target.closest("button");
  if (!t) return;
  if (t.dataset.mapTool) {
    tool = t.dataset.mapTool;
    return paint();
  }
  if (t.dataset.mapPick) {
    selected = selected === t.dataset.mapPick ? "" : t.dataset.mapPick;
    tool = "move";
    return paint();
  }
  if (t.dataset.mapHide) return void send({ op: "token-edit", id: t.dataset.mapHide, hidden: t.dataset.on === "true" });
  if (t.dataset.mapSize) return void send({ op: "token-edit", id: t.dataset.mapSize, size: Number(t.dataset.size) });
  if (t.dataset.mapRemove) return void send({ op: "token-remove", id: t.dataset.mapRemove });
  if (t.id === "dm-map-show") return void send({ op: "show", on: !local?.on }, local?.on ? "The map is put away." : "Players can open the map now.");
  if (t.id === "dm-map-party") return void send({ op: "party" }, "Every seat has a token.");
  if (t.id === "dm-map-order") return void addFromOrder();
  if (t.id === "dm-map-fog-all") return void send({ op: "fog", all: true, hidden: true }, "The whole map is in fog.");
  if (t.id === "dm-map-fog-none") return void send({ op: "fog", all: true, hidden: false }, "The fog is gone.");
  if (t.id === "dm-map-image-clear") return void send({ op: "image", image: "" }, "The picture is off the map.");
  if (t.id === "dm-map-clear" && confirm("Clear the map? The picture, the fog, and every token go.")) {
    selected = "";
    return void send({ op: "clear" }, "The map is blank.");
  }
}

/** hooks: code, token, room, order, status. */
export function bootMap(next) {
  hooks = next;
  const module = document.getElementById("module-map");
  const mount = document.getElementById("dm-map");
  if (!module || !mount) return;
  view = createMapView(mount, {
    image: (rev) => mapImage(hooks.code(), rev, hooks.token()),
    onToken(token) {
      selected = selected === token.id ? "" : token.id;
      paint();
    },
    onCell(cell) {
      const token = local?.tokens.find((item) => item.id === selected);
      if (token) move(token, cell.x, cell.y);
    },
    onPaint(cell) {
      if (!local) return;
      stroke ||= new Set();
      if (stroke.has(cell)) return;
      stroke.add(cell);
      local = { ...local, fog: paintFog(local, [cell], tool === "hide") };
      paint();
    },
    onPaintEnd() {
      const cells = [...(stroke || [])];
      stroke = null;
      if (cells.length) void send({ op: "fog", cells, hidden: tool === "hide" });
    },
  });
  module.addEventListener("toggle", () => paintMapModule(hooks.room()));
  module.addEventListener("click", onClick);
  mount.addEventListener("keydown", (event) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const token = local?.tokens.find((item) => item.id === (event.target.dataset?.token || selected));
    if (!step || !token || tool !== "move") return;
    event.preventDefault();
    selected = token.id;
    move(token, token.x + step[0], token.y + step[1]);
  });
  document.getElementById("dm-map-size")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    void send({ op: "size", cols: Number(form.elements.cols.value), rows: Number(form.elements.rows.value) }, "The grid is resized.");
  });
  document.getElementById("dm-map-add")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const kind = TOKEN_KINDS.includes(form.elements.kind.value) ? form.elements.kind.value : "foe";
    void send({ op: "token-add", name: form.elements.name.value, kind, hidden: form.elements.hidden.checked }).then((result) => {
      if (!result) return;
      selected = result.map.tokens[result.map.tokens.length - 1]?.id || "";
      form.elements.name.value = "";
      say("Token added. Tap a square to place it.");
      paint();
    });
  });
  document.getElementById("dm-map-image")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) void setImage(file);
    event.target.value = "";
  });
}
