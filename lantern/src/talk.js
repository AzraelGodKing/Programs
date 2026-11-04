import { DM_NAME } from "./table.js";

export const REACTIONS = ["👍", "😂", "😮", "💀", "❤️", "🎲"];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** True when the text names one of these people with an @, like "@Mara". */
export function mentions(text, names) {
  const lower = String(text || "").toLowerCase();
  return names.some((name) => {
    const clean = String(name || "").trim().toLowerCase();
    if (!clean) return false;
    const at = lower.indexOf(`@${clean}`);
    if (at < 0) return false;
    const after = lower.charAt(at + clean.length + 1);
    return !after || !/[a-z0-9]/.test(after);
  });
}

/** Splits text on [[Name]] so glossary names can be links. */
export function glossaryParts(text) {
  const parts = [];
  const pattern = /\[\[([^\[\]]{1,60})\]\]/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ link: match[1].trim() });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

function bodyNode(message, opts) {
  const body = el("p", message.kind === "emote" ? "talk-emote" : "");
  if (message.kind === "emote") body.append(`${message.as || message.from} `);
  for (const part of glossaryParts(message.text)) {
    if (part.text) body.append(part.text);
    else if (opts.interactive) {
      const link = el("button", "text-btn glossary-link", part.link);
      link.type = "button";
      link.dataset.action = "glossary-open";
      link.dataset.name = part.link;
      body.append(link);
    } else body.append(part.link);
  }
  return body;
}

function line(message, opts = {}) {
  const article = document.createElement("article");
  const classes = ["talk-line"];
  if (message.to) classes.push("is-whisper");
  if (message.kind === "ooc") classes.push("is-ooc");
  if (message.kind === "emote") classes.push("is-emote");
  if (message.pinned) classes.push("is-pinned");
  if (opts.selfName && message.from !== opts.selfName && mentions(message.text, opts.mentionNames || [opts.selfName])) classes.push("is-mention");
  article.className = classes.join(" ");
  const color = opts.colors?.[message.from];
  if (color) article.style.setProperty("--who", color);
  const head = el("div", "talk-head");
  const portrait = opts.portraits?.[message.from];
  if (portrait && message.kind !== "ooc") {
    const img = el("img", "talk-portrait");
    img.src = portrait;
    img.alt = "";
    img.width = 28;
    img.height = 28;
    head.append(img);
  }
  const speaker = message.as && message.as !== message.from ? `${message.as} (${message.from})` : message.from;
  const who = el("p", "talk-who", message.to ? `${speaker} whispers to ${message.to}` : message.kind === "ooc" ? `${speaker} · out of character` : speaker);
  head.append(who);
  const time = document.createElement("time");
  const at = new Date(message.at);
  if (!Number.isNaN(at.getTime())) {
    time.dateTime = at.toISOString();
    time.textContent = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  article.append(head, bodyNode(message, opts), time);
  const reactions = message.reactions && typeof message.reactions === "object" ? message.reactions : {};
  if (opts.interactive) {
    const row = el("div", "talk-tools");
    for (const emoji of REACTIONS) {
      const names = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
      const button = el("button", names.length ? "react-btn has-count" : "react-btn", names.length ? `${emoji} ${names.length}` : emoji);
      button.type = "button";
      button.dataset.action = "react";
      button.dataset.id = message.id;
      button.dataset.emoji = emoji;
      button.setAttribute("aria-pressed", names.includes(opts.selfName) ? "true" : "false");
      button.setAttribute("aria-label", names.length ? `${emoji} from ${names.join(", ")}` : `React ${emoji}`);
      row.append(button);
    }
    const pin = el("button", "text-btn", message.pinned ? "Unpin" : "Pin");
    pin.type = "button";
    pin.dataset.action = "pin";
    pin.dataset.id = message.id;
    pin.dataset.on = message.pinned ? "false" : "true";
    row.append(pin);
    article.append(row);
  } else {
    const shown = REACTIONS.filter((emoji) => Array.isArray(reactions[emoji]) && reactions[emoji].length);
    if (shown.length) article.append(el("p", "talk-reacts", shown.map((emoji) => `${emoji} ${reactions[emoji].length}`).join("  ")));
  }
  return article;
}

export function paintTalk(node, messages, opts = {}) {
  if (!node) return;
  if (opts.interactive && node.contains(document.activeElement) && document.activeElement !== node) return;
  const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) {
    const quiet = document.createElement("p");
    quiet.className = "hint";
    quiet.textContent = "The table is quiet.";
    node.replaceChildren(quiet);
    return;
  }
  node.replaceChildren(...list.map((message) => line(message, opts)));
  if (nearBottom) node.scrollTop = node.scrollHeight;
}

export function paintPins(node, messages) {
  if (!node) return;
  const pinned = (Array.isArray(messages) ? messages : []).filter((message) => message.pinned);
  node.hidden = !pinned.length;
  node.replaceChildren(...(pinned.length ? [el("p", "here-label", "Pinned"), ...pinned.slice(-5).map((message) => {
    const row = el("div", "pin-row");
    row.append(el("p", "", `${message.as || message.from}: ${message.text}`));
    const unpin = el("button", "text-btn", "Unpin");
    unpin.type = "button";
    unpin.dataset.action = "pin";
    unpin.dataset.id = message.id;
    unpin.dataset.on = "false";
    row.append(unpin);
    return row;
  })] : []));
}

/** "Mara is typing" for seats that typed in the last few seconds. */
export function typingLine(players, selfName, now = Date.now()) {
  const names = (Array.isArray(players) ? players : [])
    .filter((player) => player && player.name !== selfName && now - (player.typing || 0) < 6000)
    .map((player) => player.name);
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are typing…`;
}

export function paintTargets(select, names, selfName) {
  if (!select || document.activeElement === select) return;
  const current = select.value;
  const seen = new Set();
  const options = [{ value: "", label: "Everyone" }];
  for (const name of names) {
    const clean = String(name || "").trim();
    if (!clean || clean === selfName || seen.has(clean)) continue;
    seen.add(clean);
    options.push({ value: clean, label: clean });
  }
  if (selfName !== DM_NAME && !seen.has(DM_NAME)) {
    options.push({ value: DM_NAME, label: DM_NAME });
  }
  select.replaceChildren(...options.map((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    return node;
  }));
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

const AWAY_MS = 20000;
const GONE_MS = 5 * 60 * 1000;

export function presence(seen, now = Date.now()) {
  const gap = now - seen;
  if (gap <= AWAY_MS) return "here";
  if (gap <= GONE_MS) return "away";
  return "gone";
}

export function paintHere(node, players, selfName, now = Date.now()) {
  if (!node) return;
  const list = (Array.isArray(players) ? players : []).filter((player) => player && player.name);
  if (!list.length) {
    node.replaceChildren();
    return;
  }
  const chips = list.map((player) => {
    const state = presence(player.seen, now);
    const chip = document.createElement("span");
    chip.className = state === "here" ? "here-chip" : state === "away" ? "here-chip is-away" : "here-chip is-gone";
    chip.textContent = `${player.name}${player.name === selfName ? " (you)" : ""} · ${state === "gone" ? "disconnected" : state}`;
    return chip;
  });
  const label = document.createElement("span");
  label.className = "here-label";
  label.textContent = "At the table";
  node.replaceChildren(label, ...chips);
}
