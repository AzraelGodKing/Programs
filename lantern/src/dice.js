export const STANDARD_SIDES = [4, 6, 8, 10, 12, 20, 100];

const SIDES = new Set(STANDARD_SIDES);

function modSuffix(modifier) {
  if (!modifier) return "";
  return modifier > 0 ? ` + ${modifier}` : ` − ${Math.abs(modifier)}`;
}

export function rollDie(sides, rng) {
  return 1 + Math.floor(rng() * sides);
}

export function roll({
  count = 1,
  sides = 20,
  modifier = 0,
  mode = "normal",
  rng = Math.random,
} = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 40) {
    throw new Error("Count must be an integer from 1 to 40.");
  }
  if (!SIDES.has(sides)) {
    throw new Error("Unsupported die.");
  }
  if (!Number.isInteger(modifier) || modifier < -100 || modifier > 100) {
    throw new Error("Modifier must be an integer from -100 to 100.");
  }
  if (!["normal", "advantage", "disadvantage"].includes(mode)) {
    throw new Error("Unknown roll mode.");
  }

  const keepPair = sides === 20 && mode !== "normal";
  const groups = [];
  for (let i = 0; i < count; i += 1) {
    groups.push(keepPair ? [rollDie(sides, rng), rollDie(sides, rng)] : [rollDie(sides, rng)]);
  }

  const kept = groups.map((faces) => {
    if (faces.length === 1) return faces[0];
    return mode === "advantage" ? Math.max(faces[0], faces[1]) : Math.min(faces[0], faces[1]);
  });

  const total = kept.reduce((sum, face) => sum + face, 0) + modifier;
  let tag = null;
  if (sides === 20 && count === 1) {
    if (kept[0] === 20) tag = "natural-20";
    else if (kept[0] === 1) tag = "natural-1";
  }

  return { count, sides, modifier, mode, groups, kept, total, tag };
}

export function formula(result) {
  const suffix = modSuffix(result.modifier);
  const paired = result.groups[0] && result.groups[0].length === 2;
  if (paired && result.mode === "advantage") return `${result.count}d20 advantage${suffix}`;
  if (paired && result.mode === "disadvantage") return `${result.count}d20 disadvantage${suffix}`;
  return `${result.count}d${result.sides}${suffix}`;
}

export function facesLabel(result) {
  return result.groups
    .map((faces, index) => {
      if (faces.length === 1) return String(faces[0]);
      const [first, second] = faces;
      if (first === second) return `${first} / ${second}`;
      const kept = result.kept[index];
      const dropped = first === kept ? second : first;
      return `${kept} (dropped ${dropped})`;
    })
    .join(" · ");
}
