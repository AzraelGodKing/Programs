/** Per-browser display switches: high contrast and reduced motion. */

const CONTRAST_KEY = "lantern.contrast";
const MOTION_KEY = "lantern.motion";

function read(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode: still apply for this page */ }
}

export function applyDisplay(contrast, motion, buttons = {}) {
  document.documentElement.dataset.contrast = contrast;
  document.documentElement.dataset.motion = motion;
  if (buttons.contrast) {
    buttons.contrast.textContent = contrast === "high" ? "Contrast: high" : "Contrast: normal";
    buttons.contrast.setAttribute("aria-pressed", contrast === "high" ? "true" : "false");
  }
  if (buttons.motion) {
    buttons.motion.textContent = motion === "reduced" ? "Motion: reduced" : "Motion: on";
    buttons.motion.setAttribute("aria-pressed", motion === "reduced" ? "true" : "false");
  }
}

export function bootDisplay(buttons) {
  let contrast = read(CONTRAST_KEY, ["normal", "high"], "normal");
  let motion = read(MOTION_KEY, ["on", "reduced"], "on");
  applyDisplay(contrast, motion, buttons);
  buttons.contrast?.addEventListener("click", () => {
    contrast = contrast === "high" ? "normal" : "high";
    write(CONTRAST_KEY, contrast);
    applyDisplay(contrast, motion, buttons);
  });
  buttons.motion?.addEventListener("click", () => {
    motion = motion === "reduced" ? "on" : "reduced";
    write(MOTION_KEY, motion);
    applyDisplay(contrast, motion, buttons);
  });
}
