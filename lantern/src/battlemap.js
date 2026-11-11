// The battle map on screen. One painter for the DM screen, the player seat,
// and the spectator page, so all three draw the same grid, fog, and tokens.

import { cellAt, cellIndex, fogged, tokenLabel } from "./mapgrid.js";

const CELL = 28;

/**
 * hooks: image(rev) -> Promise<data URL>, onCell({x, y}), onToken(token),
 * onPaint(cell index) while the DM drags a fog tool.
 */
export function createMapView(mount, hooks = {}) {
  mount.classList.add("bmap");
  mount.replaceChildren();
  const canvas = document.createElement("canvas");
  canvas.className = "bmap-grid";
  canvas.setAttribute("aria-hidden", "true");
  const pieces = document.createElement("div");
  pieces.className = "bmap-pieces";
  mount.append(canvas, pieces);
  let map = null;
  let state = {};
  let drawn = "";
  let imageRev = -1;
  let painting = false;

  const cellFrom = (event) => (map ? cellAt(map, canvas.getBoundingClientRect(), event.clientX, event.clientY) : null);

  mount.addEventListener("pointerdown", (event) => {
    if (!map || !state.dm || state.tool === "move" || event.button) return;
    const cell = cellFrom(event);
    if (!cell) return;
    painting = true;
    mount.setPointerCapture?.(event.pointerId);
    hooks.onPaint?.(cellIndex(map, cell.x, cell.y));
    event.preventDefault();
  });
  mount.addEventListener("pointermove", (event) => {
    if (!painting) return;
    const cell = cellFrom(event);
    if (cell) hooks.onPaint?.(cellIndex(map, cell.x, cell.y));
  });
  const stop = () => {
    if (!painting) return;
    painting = false;
    hooks.onPaintEnd?.();
  };
  mount.addEventListener("pointerup", stop);
  mount.addEventListener("pointercancel", stop);
  mount.addEventListener("click", (event) => {
    if (!map || (state.dm && state.tool !== "move")) return;
    const piece = event.target.closest("[data-token]");
    if (piece) {
      const token = map.tokens.find((item) => item.id === piece.dataset.token);
      if (token) hooks.onToken?.(token);
      return;
    }
    const cell = cellFrom(event);
    if (cell) hooks.onCell?.(cell);
  });

  function drawGrid() {
    canvas.width = map.cols * CELL;
    canvas.height = map.rows * CELL;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // The DM sees through the fog; everyone else sees a wall of it.
    ctx.fillStyle = state.dm ? "rgba(8, 6, 4, 0.6)" : "#0b0907";
    for (let y = 0; y < map.rows; y += 1) {
      for (let x = 0; x < map.cols; x += 1) {
        if (fogged(map, x, y)) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.strokeStyle = "rgba(244, 231, 210, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= map.cols; x += 1) {
      ctx.moveTo(Math.min(x * CELL + 0.5, canvas.width - 0.5), 0);
      ctx.lineTo(Math.min(x * CELL + 0.5, canvas.width - 0.5), canvas.height);
    }
    for (let y = 0; y <= map.rows; y += 1) {
      ctx.moveTo(0, Math.min(y * CELL + 0.5, canvas.height - 0.5));
      ctx.lineTo(canvas.width, Math.min(y * CELL + 0.5, canvas.height - 0.5));
    }
    ctx.stroke();
  }

  function drawPieces() {
    const focused = document.activeElement?.dataset?.token || "";
    const mine = (state.mine || "").toLowerCase();
    pieces.replaceChildren(...map.tokens.map((token) => {
      const own = mine && (token.seat || "").toLowerCase() === mine;
      const node = document.createElement("button");
      node.type = "button";
      node.className = ["bmap-token", `is-${token.kind}`, token.hidden ? "is-hidden" : "", token.id === state.selected ? "is-picked" : "", own ? "is-mine" : ""].filter(Boolean).join(" ");
      node.dataset.token = token.id;
      node.style.left = `${(token.x / map.cols) * 100}%`;
      node.style.top = `${(token.y / map.rows) * 100}%`;
      node.style.width = `${(token.size / map.cols) * 100}%`;
      node.style.height = `${(token.size / map.rows) * 100}%`;
      node.style.setProperty("--token", token.color);
      node.textContent = tokenLabel(token.name);
      node.title = token.name;
      node.setAttribute("aria-label", `${token.name}${token.hidden ? ", hidden from players" : ""}${own ? ", your token" : ""}, column ${token.x + 1}, row ${token.y + 1}`);
      node.setAttribute("aria-pressed", token.id === state.selected ? "true" : "false");
      if (!state.dm && !own) node.tabIndex = -1;
      return node;
    }));
    if (focused) pieces.querySelector(`[data-token="${focused}"]`)?.focus({ preventScroll: true });
  }

  return {
    /** Draws the map again when anything on it changed. */
    paint(nextMap, nextState = {}) {
      const signature = JSON.stringify([nextMap, nextState]);
      if (signature === drawn) return;
      drawn = signature;
      map = nextMap;
      state = nextState;
      mount.hidden = !map;
      if (!map) return;
      mount.style.aspectRatio = `${map.cols} / ${map.rows}`;
      // Never taller than most of the screen, and the squares stay square.
      mount.style.maxWidth = `calc(70vh * ${(map.cols / map.rows).toFixed(4)})`;
      mount.dataset.tool = state.dm ? state.tool || "move" : "move";
      drawGrid();
      drawPieces();
      if (map.image !== imageRev) {
        imageRev = map.image;
        mount.style.backgroundImage = "";
        if (map.image && hooks.image) {
          const rev = map.image;
          hooks.image(rev).then((url) => {
            if (rev === imageRev && url) mount.style.backgroundImage = `url("${url}")`;
          }).catch(() => { imageRev = -1; });
        }
      }
    },
  };
}

/** Shrinks a picture until it fits the table's size limit, as a JPEG data URL. */
export async function shrinkImage(file, maxChars, maxSide = 1600) {
  const bitmap = await createImageBitmap(file);
  let side = maxSide;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.45]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= maxChars) return { url, width: canvas.width, height: canvas.height };
    }
    side = Math.round(side * 0.75);
  }
  throw new Error("That picture would not shrink enough. Try a smaller one.");
}
