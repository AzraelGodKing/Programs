// Player seat: the battle map the DM has put out. A player moves only the
// token that belongs to their seat, by tapping it and then a square.

import { createMapView } from "./battlemap.js";
import { fogged } from "./mapgrid.js";
import { loadSeat, mapImage, postMap } from "./table.js";

let view = null;
let map = null;
let picked = false;
let busy = 0;
let seatName = "";
let wasOut = false;

const dialog = () => document.getElementById("map-dialog");
const say = (text) => {
  const node = document.getElementById("map-status");
  if (node) node.textContent = text;
};
const mine = () => map?.tokens.find((token) => (token.seat || "").toLowerCase() === seatName.toLowerCase());

function paint() {
  if (!dialog()?.open) return;
  const own = mine();
  view?.paint(map, { mine: seatName, selected: picked && own ? own.id : "" });
  const hint = document.getElementById("map-hint");
  if (hint) {
    hint.textContent = !map ? "The DM has put the map away."
      : !own ? "You have no token on this map yet. The DM places them."
        : picked ? "Now tap the square you move to, or use the arrow keys." : "Tap your token, the one with the bright ring, then tap a square.";
  }
}

async function move(x, y) {
  const own = mine();
  if (!own || !map || x < 0 || y < 0 || x >= map.cols || y >= map.rows) return;
  if (fogged(map, x, y)) return say("You cannot see that far yet.");
  const seat = loadSeat();
  map = { ...map, tokens: map.tokens.map((token) => (token.id === own.id ? { ...token, x, y } : token)) };
  paint();
  busy += 1;
  try {
    const result = await postMap(seat.room, { op: "token-move", id: own.id, x, y });
    if (result.map) map = result.map;
    say("");
  } catch (error) {
    say(error.message);
  } finally {
    busy -= 1;
    paint();
  }
}

/** Called after each look at the table. */
export function paintPlayerMap(room, seat) {
  seatName = seat?.name || "";
  if (!busy) map = room?.map || null;
  const open = document.getElementById("open-map");
  if (open) {
    open.hidden = !map;
    // Say so once when the DM puts a map out, so nobody misses it.
    if (map && !wasOut) open.classList.add("is-new");
  }
  wasOut = Boolean(map);
  paint();
}

export function bootPlayerMap() {
  const mount = document.getElementById("player-map");
  if (!mount || !dialog()) return;
  view = createMapView(mount, {
    image: (rev) => mapImage(loadSeat().room, rev),
    onToken(token) {
      if ((token.seat || "").toLowerCase() !== seatName.toLowerCase()) return say(`${token.name} is not yours to move.`);
      picked = !picked;
      say("");
      paint();
    },
    onCell(cell) {
      if (picked) void move(cell.x, cell.y);
    },
  });
  mount.addEventListener("keydown", (event) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const own = mine();
    if (!step || !own) return;
    event.preventDefault();
    picked = true;
    void move(own.x + step[0], own.y + step[1]);
  });
  document.getElementById("open-map")?.addEventListener("click", (event) => {
    event.currentTarget.classList.remove("is-new");
    dialog().showModal();
    paint();
  });
  document.getElementById("close-map")?.addEventListener("click", () => dialog().close());
  dialog().addEventListener("click", (event) => {
    if (event.target === dialog()) dialog().close();
  });
}
