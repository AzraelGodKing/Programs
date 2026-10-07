import { DM_NAME } from "./table.js";

function line(message) {
  const article = document.createElement("article");
  article.className = message.to ? "talk-line is-whisper" : "talk-line";
  const who = document.createElement("p");
  who.className = "talk-who";
  who.textContent = message.to ? `${message.from} whispers to ${message.to}` : message.from;
  const body = document.createElement("p");
  body.textContent = message.text;
  const time = document.createElement("time");
  const at = new Date(message.at);
  if (!Number.isNaN(at.getTime())) {
    time.dateTime = at.toISOString();
    time.textContent = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  article.append(who, body, time);
  return article;
}

export function paintTalk(node, messages) {
  if (!node) return;
  const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) {
    const quiet = document.createElement("p");
    quiet.className = "hint";
    quiet.textContent = "The table is quiet.";
    node.replaceChildren(quiet);
    return;
  }
  node.replaceChildren(...list.map(line));
  if (nearBottom) node.scrollTop = node.scrollHeight;
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

export function paintHere(node, players, selfName, now = Date.now()) {
  if (!node) return;
  const list = (Array.isArray(players) ? players : []).filter((player) => player && player.name);
  if (!list.length) {
    node.replaceChildren();
    return;
  }
  const chips = list.map((player) => {
    const away = !(now - player.seen <= AWAY_MS);
    const chip = document.createElement("span");
    chip.className = away ? "here-chip is-away" : "here-chip";
    chip.textContent = `${player.name}${player.name === selfName ? " (you)" : ""} · ${away ? "away" : "here"}`;
    return chip;
  });
  const label = document.createElement("span");
  label.className = "here-label";
  label.textContent = "At the table";
  node.replaceChildren(label, ...chips);
}
