// Reading a seat the way the DM screen shows it.
// Passive scores are 10 plus the skill bonus. Proficiency is included when the skill is chosen.

import {
  addBackgroundSkills,
  cleanCharacter,
  findSkill,
  formatMod,
  passiveScore,
  skillBonus,
} from "./character.js";

export const LOW_LIGHT_MS = 5 * 60 * 1000;

export function feedKind(summary) {
  return /^Rolled \d+ for /.test(String(summary || "")) ? "roll" : "table";
}

export function naturalTag(summary) {
  const text = String(summary || "");
  if (text.includes("Natural 20")) return "natural-20";
  if (text.includes("Natural 1")) return "natural-1";
  return "";
}

export function lightTone(remainingMs) {
  if (remainingMs <= 0) return "out";
  if (remainingMs <= LOW_LIGHT_MS) return "low";
  return "steady";
}

export function heroInOrder(combatants, names) {
  const wanted = new Set(
    (names || []).map((name) => String(name || "").trim().toLowerCase()).filter(Boolean),
  );
  if (!wanted.size) return null;
  return (combatants || []).find((person) => wanted.has(String(person.name || "").trim().toLowerCase())) || null;
}

export function partyLevels(characters) {
  return (characters || [])
    .map((character) => cleanCharacter(character))
    .filter((character) => character.touched)
    .map((character) => character.level);
}

export function passiveSummary(character) {
  const clean = cleanCharacter(character);
  if (!clean.touched) return "";
  return `Passive Perception ${passiveScore(clean, "perception")} · Passive Insight ${passiveScore(clean, "insight")}`;
}

export function skilledSummary(character) {
  const clean = cleanCharacter(character);
  if (!clean.touched) return "";
  return addBackgroundSkills(clean)
    .map((id) => {
      const skill = findSkill(id);
      if (!skill) return "";
      return `${skill.label} ${formatMod(skillBonus(clean, id))}`;
    })
    .filter(Boolean)
    .join(", ");
}
