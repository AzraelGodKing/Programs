// Session helpers shared by the DM screen and the player seat: the spotlight
// count, the session log in Markdown, and a calendar file for the next game.

const pad = (n) => String(n).padStart(2, "0");

/** A calendar stamp in UTC, like 20261107T190000Z. */
export function icsStamp(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function icsText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
}

/** One calendar event for the next session, three hours long. */
export function icsFor({ at, label }, url = "", now = Date.now()) {
  if (!at) return "";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lantern//Next session//EN",
    "BEGIN:VEVENT",
    `UID:lantern-${at}@lantern`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(at)}`,
    `DTEND:${icsStamp(at + 3 * 60 * 60 * 1000)}`,
    `SUMMARY:${icsText(label || "Lantern session")}`,
    url ? `URL:${icsText(url)}` : "",
    url ? `DESCRIPTION:${icsText(`Join the table: ${url}`)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n";
}

const SETUP = /^(Joined the table|Set the character|Named the character|Sits down as|Chose a starting kit|Packed the starting gear|Set dice to|Set |Received .* from the DM)/;

/** Who has spoken or acted least since a time: quietest first. */
export function spotlight(room, since = 0) {
  const counts = new Map((room?.players || []).map((player) => [player.name, { name: player.name, talk: 0, acts: 0 }]));
  for (const message of room?.messages || []) {
    if (message.at >= since && counts.has(message.from)) counts.get(message.from).talk += 1;
  }
  for (const event of room?.events || []) {
    if (event.at >= since && !event.by && !SETUP.test(event.summary) && counts.has(event.name)) counts.get(event.name).acts += 1;
  }
  return [...counts.values()]
    .map((row) => ({ ...row, total: row.talk + row.acts }))
    .sort((a, b) => a.total - b.total || a.name.localeCompare(b.name));
}


/** A Markdown session log: who was there, rewards, the talk, and the rolls. */
export function sessionLog(room, since = 0, { title = "Lantern session", now = Date.now() } = {}) {
  const events = [...(room?.events || [])].filter((event) => event.at >= since && !event.secret).sort((a, b) => a.at - b.at);
  const messages = [...(room?.messages || [])].filter((message) => message.at >= since && !message.to).sort((a, b) => a.at - b.at);
  const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const lines = [`# ${title}`, "", `${new Date(since || now).toLocaleDateString()} · table ${room?.code || ""}`.trim(), ""];
  const seats = (room?.players || []).map((player) => {
    const character = player.snapshot?.character;
    return character?.name && character.name !== player.name ? `${character.name} (${player.name})` : player.name;
  });
  lines.push("## Who was there", "", ...(seats.length ? seats.map((name) => `- ${name}`) : ["- Nobody yet"]), "");
  const rewards = events.filter((event) => event.by && /^The DM gave /.test(event.summary));
  lines.push("## Loot, experience, and inspiration", "", ...(rewards.length ? rewards.map((event) => `- ${event.summary}`) : ["- None this session"]), "");
  if (room?.board?.quests?.length) {
    lines.push("## Quests", "", ...room.board.quests.filter((quest) => !quest.hidden).map((quest) => `- [${quest.done ? "x" : " "}] ${quest.title}`), "");
  }
  const story = [
    ...messages.map((message) => ({ at: message.at, line: message.kind === "read" ? `> ${message.text}` : message.kind === "emote" ? `*${message.as || message.from} ${message.text}*` : `**${message.as || message.from}:** ${message.text}` })),
    ...events.filter((event) => !SETUP.test(event.summary)).map((event) => ({ at: event.at, line: `${time(event.at)} · ${event.name}: ${event.summary}` })),
  ].sort((a, b) => a.at - b.at);
  lines.push("## What happened", "", ...(story.length ? story.map((item) => item.line) : ["Nothing was said or rolled."]), "");
  return lines.join("\n");
}

/** Saves text as a file in the browser. */
export function downloadText(text, filename, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
