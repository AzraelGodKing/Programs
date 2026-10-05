// 2014 fifth-edition encounter budget.
// Each row is easy, medium, hard, deadly experience for one character.
// Creature count picks a multiplier. A party smaller than 3 steps it up,
// and a party of 6 or more steps it down. The top and bottom steps stay put.

export const THRESHOLDS = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
};

// Challenge rating to experience. Fractions stay strings so "1/8" is not a float.
export const CR_XP = [
  ["0", 10],
  ["1/8", 25],
  ["1/4", 50],
  ["1/2", 100],
  ["1", 200],
  ["2", 450],
  ["3", 700],
  ["4", 1100],
  ["5", 1800],
  ["6", 2300],
  ["7", 2900],
  ["8", 3900],
  ["9", 5000],
  ["10", 5900],
  ["11", 7200],
  ["12", 8400],
  ["13", 10000],
  ["14", 11500],
  ["15", 13000],
  ["16", 15000],
  ["17", 18000],
  ["18", 20000],
  ["19", 22000],
  ["20", 25000],
  ["21", 33000],
  ["22", 41000],
  ["23", 50000],
  ["24", 62000],
  ["25", 75000],
  ["26", 90000],
  ["27", 105000],
  ["28", 120000],
  ["29", 135000],
  ["30", 155000],
];

const STEPS = [1, 1.5, 2, 2.5, 3, 4];

export function partyThresholds(levels) {
  const totals = [0, 0, 0, 0];
  let size = 0;
  for (const level of levels) {
    const row = THRESHOLDS[level];
    if (!row) continue;
    size += 1;
    row.forEach((value, index) => {
      totals[index] += value;
    });
  }
  return {
    size,
    easy: totals[0],
    medium: totals[1],
    hard: totals[2],
    deadly: totals[3],
  };
}

function multiplierIndex(monsterCount) {
  if (monsterCount <= 1) return 0;
  if (monsterCount === 2) return 1;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 3;
  if (monsterCount <= 14) return 4;
  return 5;
}

export function encounterMultiplier(monsterCount, partySize) {
  if (monsterCount <= 0) return { multiplier: 1, shift: null };
  let index = multiplierIndex(monsterCount);
  let shift = null;
  if (partySize > 0 && partySize < 3) {
    const next = Math.min(STEPS.length - 1, index + 1);
    if (next !== index) shift = "stricter";
    index = next;
  } else if (partySize >= 6) {
    const next = Math.max(0, index - 1);
    if (next !== index) shift = "gentler";
    index = next;
  }
  return { multiplier: STEPS[index], shift };
}

export function rateBudget(adjusted, thresholds) {
  if (!thresholds.size) return null;
  if (adjusted < thresholds.easy) return "trivial";
  if (adjusted < thresholds.medium) return "easy";
  if (adjusted < thresholds.hard) return "medium";
  if (adjusted < thresholds.deadly) return "hard";
  return "deadly";
}

export function rateEncounter({ levels = [], groups = [] } = {}) {
  const thresholds = partyThresholds(levels);
  const clean = [];
  for (const group of groups) {
    if (!Number.isInteger(group.count) || group.count < 1) continue;
    if (!Number.isFinite(group.xp) || group.xp < 0) continue;
    clean.push({ count: group.count, xp: group.xp });
  }
  const monsterCount = clean.reduce((sum, group) => sum + group.count, 0);
  const raw = clean.reduce((sum, group) => sum + group.count * group.xp, 0);
  const { multiplier, shift } = encounterMultiplier(monsterCount, thresholds.size);
  const adjusted = raw * multiplier;
  return {
    thresholds,
    monsterCount,
    raw,
    multiplier,
    shift,
    adjusted,
    rating: thresholds.size ? rateBudget(adjusted, thresholds) : null,
  };
}

export function formatXp(value) {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-US");
}
