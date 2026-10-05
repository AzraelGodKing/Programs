// Durations and light radii from the common 2014 gear list.
// Dim is the additional radius beyond the bright light, matching that list.
export const LIGHTS = [
  { id: "candle", label: "Candle", minutes: 60, bright: 5, dim: 5 },
  { id: "torch", label: "Torch", minutes: 60, bright: 20, dim: 20 },
  { id: "lamp", label: "Oil lamp", minutes: 360, bright: 15, dim: 30 },
  { id: "hooded", label: "Hooded lantern", minutes: 360, bright: 30, dim: 30, hoodDim: 5 },
  { id: "bullseye", label: "Bullseye lantern", minutes: 360, bright: 60, dim: 60, cone: true },
];

const BY_ID = new Map(LIGHTS.map((light) => [light.id, light]));

export function findLight(id) {
  return BY_ID.get(id) || null;
}

export function lightOptionLabel(spec) {
  const hours = spec.minutes / 60;
  const time = spec.minutes % 60 === 0
    ? `${hours} hour${hours === 1 ? "" : "s"}`
    : `${spec.minutes} min`;
  const shape = spec.cone ? " cone" : "";
  return `${spec.label} · ${time} · ${spec.bright}/+${spec.dim}${shape}`;
}

export function lightCaption(spec, covered) {
  if (spec.hoodDim != null && covered) {
    return `Hood down · ${spec.hoodDim} ft dim`;
  }
  const shape = spec.cone ? " cone" : "";
  return `${spec.bright} ft bright, +${spec.dim} ft dim${shape}`;
}

export function formatRemaining(ms) {
  if (ms <= 0) return "Out";
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
