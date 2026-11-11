// The end-of-session post for Discord: a recap and when the table meets next.
// The room rules build and send it, and the DM screen drafts the words.

export const RECAP_LENGTH = 3500;
const WEBHOOK = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[A-Za-z0-9_-]{20,200}$/;

/** Only a Discord webhook address, so the table never posts anywhere else. */
export function validWebhook(url) {
  return typeof url === "string" && WEBHOOK.test(url.trim());
}

/**
 * Discord shows <t:…> in each reader's own time zone, so nobody has to convert.
 * @param {{ at?: number, label?: string } | null} next
 */
export function nextSessionLine(next) {
  if (!next || (!next.at && !next.label)) return "";
  const seconds = next.at ? Math.floor(next.at / 1000) : 0;
  const when = seconds ? `<t:${seconds}:F> (<t:${seconds}:R>)` : "";
  return [next.label, when].filter(Boolean).join("\n");
}

/** The webhook body. Mentions are switched off, so a recap can never ping @everyone. */
export function discordRecap({ recap = "", next = null, title = "", link = "" } = {}) {
  const text = String(recap || "").trim().slice(0, RECAP_LENGTH);
  const nextLine = nextSessionLine(next);
  if (!text && !nextLine) return null;
  const embed = { title: String(title || "").trim().slice(0, 120) || "Session recap", color: 0xe07a3d };
  if (text) embed.description = text;
  const fields = [];
  if (nextLine) fields.push({ name: "Next session", value: nextLine.slice(0, 1000) });
  if (/^https:\/\/[^\s<>]{1,200}$/.test(link)) fields.push({ name: "Join the table", value: link });
  if (fields.length) embed.fields = fields;
  return { username: "Lantern", allowed_mentions: { parse: [] }, embeds: [embed] };
}

/** A first draft from the table: who played, what they got, and where the quests stand. */
export function recapDraft(room, since = 0) {
  const events = (room?.events || []).filter((event) => event.at >= since && !event.secret);
  const heroes = (room?.players || []).map((player) => player.snapshot?.character?.name || player.name).filter(Boolean);
  const rewards = events.filter((event) => event.by && /^The DM gave /.test(event.summary)).map((event) => event.summary).reverse();
  const quests = (room?.board?.quests || []).filter((quest) => !quest.hidden);
  const lines = [];
  if (heroes.length) lines.push(`**At the table:** ${heroes.join(", ")}`);
  const done = quests.filter((quest) => quest.done).map((quest) => quest.title);
  const open = quests.filter((quest) => !quest.done).map((quest) => quest.title);
  if (done.length) lines.push(`**Finished:** ${done.join("; ")}`);
  if (open.length) lines.push(`**Still open:** ${open.join("; ")}`);
  if (rewards.length) lines.push("**Rewards:**", ...rewards.slice(0, 12).map((line) => `- ${line}`));
  return lines.join("\n").slice(0, RECAP_LENGTH);
}
