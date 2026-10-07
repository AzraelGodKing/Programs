/** A per-browser text size: normal, large, or larger. */

const KEY = "lantern.textsize";
export const SIZES = ["normal", "large", "larger"];
const LABEL = { normal: "Text: normal", large: "Text: large", larger: "Text: larger" };

export function loadSize() {
  try {
    const value = localStorage.getItem(KEY);
    return SIZES.includes(value) ? value : "normal";
  } catch {
    return "normal";
  }
}

export function nextSize(size) {
  return SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
}

export function applySize(size, button) {
  document.documentElement.dataset.textsize = size;
  if (button) {
    button.textContent = LABEL[size];
    button.setAttribute("aria-label", `${LABEL[size]}. Change text size`);
  }
}

export function bootTextSize(button) {
  applySize(loadSize(), button);
  button?.addEventListener("click", () => {
    const size = nextSize(loadSize());
    try { localStorage.setItem(KEY, size); } catch { /* private mode: still apply for this page */ }
    applySize(size, button);
  });
}
