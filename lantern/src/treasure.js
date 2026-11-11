// Treasure hoards by challenge rating, from Lantern's own tables.
// These are original lists, not the tables from a published book.

const BANDS = [
  {
    upTo: 4,
    gp: [2, 6, 10],
    sp: [3, 6, 10],
    pp: null,
    picks: [0, 3],
    items: [
      "A tin flask of healing draught (2d4+2)",
      "A silver locket holding a pressed violet",
      "A pouch of three river pearls (10 gp each)",
      "A whetstone that never wears down",
      "A lantern hood stitched with a ward against moths",
      "A map scrap showing a well marked with an X",
      "A copper ring etched with a fox",
      "Two vials of alchemist's fire",
      "A carved bone die that always feels warm",
      "A hunter's horn with a cracked mouthpiece",
    ],
  },
  {
    upTo: 10,
    gp: [4, 6, 25],
    sp: null,
    pp: [1, 6, 5],
    picks: [1, 4],
    items: [
      "A greater healing draught (4d4+4)",
      "A cloak that sheds rain like oiled leather",
      "A small jade idol of a sleeping cat (75 gp)",
      "A +1 weapon of the finder's choice, wrapped in waxed cloth",
      "A bag that holds twice what it should",
      "A scroll with one 2nd-level spell, chosen by the DM",
      "A gold circlet set with a moonstone (250 gp)",
      "Boots that leave no prints in mud or snow",
      "A sealed letter from a noble house, still unread",
      "Three garnets in a velvet bag (100 gp each)",
    ],
  },
  {
    upTo: 16,
    gp: [6, 6, 100],
    sp: null,
    pp: [3, 6, 10],
    picks: [2, 5],
    items: [
      "A superior healing draught (8d4+8)",
      "A +2 shield faced with a lion in beaten bronze",
      "A ring that turns aside one killing blow, then cracks",
      "A painting of a drowned city (750 gp to the right buyer)",
      "A scroll with one 5th-level spell, chosen by the DM",
      "A cut sapphire the size of a thumbnail (1,000 gp)",
      "A rope of silver thread that ties and unties at a word",
      "A crown missing one of its seven stones (1,500 gp)",
      "A wand with seven charges of the DM's choosing",
    ],
  },
  {
    upTo: 99,
    gp: [12, 6, 100],
    sp: null,
    pp: [8, 6, 25],
    picks: [3, 6],
    items: [
      "A supreme healing draught (10d4+20)",
      "A +3 weapon that hums near its maker's enemies",
      "A star sapphire that shows the night sky of another world (5,000 gp)",
      "A deed to a ruined keep and the lands around it",
      "A scroll with one 8th-level spell, chosen by the DM",
      "A mirror that answers one question each new moon",
      "A dragon's tooth carved into a horn (2,500 gp)",
      "A suit of armor that weighs nothing to its wearer",
    ],
  },
];

function dice([count, sides, times], rng) {
  let total = 0;
  for (let index = 0; index < count; index += 1) total += 1 + Math.floor(rng() * sides);
  return total * times;
}

/** Challenge rating text ("1/4", "5") to a number. */
export function crNumber(cr) {
  const raw = String(cr || "0").trim();
  if (raw.includes("/")) {
    const [top, bottom] = raw.split("/").map(Number);
    return bottom ? top / bottom : 0;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** One hoard: coin in copper and a few named finds. */
export function rollHoard(cr, rng = Math.random) {
  const band = BANDS.find((item) => crNumber(cr) <= item.upTo) || BANDS[BANDS.length - 1];
  const gp = dice(band.gp, rng);
  const sp = band.sp ? dice(band.sp, rng) : 0;
  const pp = band.pp ? dice(band.pp, rng) : 0;
  const [low, high] = band.picks;
  const count = low + Math.floor(rng() * (high - low + 1));
  const pool = [...band.items];
  const items = [];
  for (let index = 0; index < count && pool.length; index += 1) {
    items.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return { cp: gp * 100 + sp * 10 + pp * 1000, gp, sp, pp, items };
}
