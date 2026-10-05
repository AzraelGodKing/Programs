export const KINDS = ["person", "place", "twist", "rumor", "trinket"];

export const KIND_LABEL = {
  person: "Person",
  place: "Place",
  twist: "Twist",
  rumor: "Rumor",
  trinket: "Trinket",
  scene: "Scene",
};

const FIRST = [
  "Mara", "Pell", "Osric", "Vessa", "Bram", "Ilen", "Tova", "Quill",
  "Senn", "Hadri", "Nima", "Corv", "Elspeth", "Jory", "Tam", "Briony",
  "Calder", "Sable", "Wren", "Ysolde", "Fen", "Pim", "Odric", "Lira",
  "Hess", "Keel", "Doss", "Miren", "Tobin", "Sera", "Ivo", "Nel",
];

const LAST = [
  "Ashfen", "Bramble", "Coldwell", "Dun", "Fenwick", "Grell", "Holt", "Ives",
  "Kett", "Larke", "Moss", "Nyx", "Oak", "Pellam", "Quinn", "Reed",
  "Sallow", "Thorn", "Voss", "Wick", "Yarrow", "Blacksalt", "Hart", "Moor",
];

const ROLES = [
  "a hedge mage",
  "a caravan guard",
  "a relic thief",
  "a temple cook",
  "a map forger",
  "a retired soldier",
  "a river pilot",
  "a grave tender",
  "a jewel cutter",
  "a road warden",
  "an innkeeper's heir",
  "a lantern bearer",
  "a debt collector",
  "a locksmith",
  "a surveyor",
  "a banner knight",
];

const DEMEANORS = [
  "They speak softly and stand too close.",
  "They laugh a half-second late.",
  "They will not sit with their back to a door.",
  "They answer every question with another question.",
  "They smell of rain and iron.",
  "They keep one glove on.",
  "They quote a price before a name.",
  "They smile only with the eyes.",
  "They watch mouths, not eyes.",
  "They hum while they think.",
  "They bow to the wrong person.",
  "They offer food and eat none of it.",
  "They never blink quite often enough.",
  "They pay with coins from three reigns.",
  "They flinch when they hear their own name.",
  "They wipe the rim of the cup before every sip.",
];

const WANTS = [
  "a name struck from a ledger",
  "safe passage before moonset",
  "someone else to lie to the baron",
  "the other half of a broken key",
  "a witness who will forget their face",
  "coin enough to leave the city tonight",
  "proof a sibling is still alive",
  "the recipe hidden inside a hymn",
  "three quiet hours and a locked door",
  "a horse that is not theirs",
  "a grave left undisturbed",
  "the return of a stolen voice",
  "an audience that asks no questions",
  "the other boot from a pair they buried",
  "one night with the storm held back",
  "a forgiveness they cannot explain",
];

const SECRETS = [
  "They already sold the party out.",
  "The scar is painted on.",
  "They owe a favor to something in the well.",
  "They are paid to keep everyone here until dawn.",
  "The map in their boot is blank.",
  "They cannot read the letter they carry.",
  "The monster is a child they are hiding.",
  "They set the last fire.",
  "Their title belongs to a corpse.",
  "They poisoned the stew and regret only the salt.",
  "They are two people sharing one face this week.",
  "They can hear thoughts, but only in a crowd.",
  "They are searching for the party, not meeting them.",
  "The tears are real and the reason is not.",
  "They buried the wrong body last spring.",
  "Their shadow sometimes arrives a step late.",
];

const TELLS = [
  "a thumb rubbed raw",
  "ink under every nail",
  "boots too fine for this road",
  "a fresh burn on the wrist",
  "a locket that clicks when it swings",
  "flour still in the hair",
  "a peace-tied sword and a knife that is not",
  "eyes that follow the candle, not the speaker",
  "a prayer said under the breath, backwards",
  "counting the exits",
  "a ring tapped on the cup before each lie",
  "mud on the left boot only",
  "a cuff damp with river water",
  "three different inks on one page",
  "a smile that starts on the left",
  "ash in the seams of a clean coat",
];

const PLACES = [
  "A ferry that only crosses when a passenger names the river.",
  "A market built inside the ribs of a stone beast.",
  "A chapel where the bells are rung for weather, not for hours.",
  "A toll bridge staffed by children wearing adult masks.",
  "An orchard where each tree grows a different fruit, and one grows teeth.",
  "A bathhouse that keeps a ledger of secrets overheard in the steam.",
  "A watchtower whose fire is cold and whose shadows are warm.",
  "A library that collects fines in memories.",
  "A quarry town that sells stone already carved with someone else's crest.",
  "An inn with one more door than the hallway can explain.",
  "A crossroads shrine whose offerings match tomorrow's weather.",
  "Docks where the tide comes in carrying sealed letters.",
  "A bakery that locks its ovens at dusk and still smells of bread at dawn.",
  "A ruined amphitheater where whispers arrive before the speaker.",
  "A rope bridge over a gorge that answers in your own voice.",
  "A customs house that taxes shadows if they are longer than the person.",
];

const TWISTS = [
  "An ally arrives early and stands with the other side.",
  "The prize is genuine, and it wants to be carried.",
  "A storm swings shut every door that was open.",
  "The enemy offers terms and is telling the truth.",
  "Something the party already killed is still drawing pay.",
  "A child in the crowd knows the password.",
  "The map is right. The land has moved.",
  "Gold spent here weighs nothing until it leaves the valley.",
  "Two factions hire the party for the same hour.",
  "A silence spreads. Spells still work. Names do not.",
  "The moon is up in daylight and the watch is panicking.",
  "The locked box is empty, and the lock was meant to keep something out.",
  "Reinforcements are late because they stopped to bury one of their own.",
  "The floor is a diagram. Stepping on the center completes it.",
  "Every light in the room bends toward one person.",
  "The exit is where the entrance was, and the entrance is gone.",
];

const RUMORS = [
  "The baron has started paying taxes to the woods.",
  "Three graves behind the abbey are warm to the touch.",
  "A black horse was seen eating apples from a second-story window.",
  "The well in Millstreet grants a wish and keeps the tongue that asked.",
  "Mercenaries are buying every sack of salt in town.",
  "Someone has been teaching the crows the names of the council.",
  "The north road is a day shorter, and a village is missing from it.",
  "A saint's finger bone was stolen. The hand grew another.",
  "Lights under the lake answer if you knock on the ice.",
  "The executioner has been asking after people who are already dead.",
  "Bread baked on Godsday does not mold. It waits.",
  "A door in the tailor's shop opens onto last winter.",
  "The night watch refuses to enter the east alley in pairs.",
  "A wedding ring was found in a fish, and the wedding is tomorrow.",
  "The new priest can read any book, including the ones not written yet.",
  "Cats have been leaving the city by the south gate, in a line.",
];

const TRINKETS = [
  "A copper coin that always lands heads and is slightly warm.",
  "A glove cut for six fingers, worn thin at the thumb.",
  "A vial of fog that pours downward when it is uncorked.",
  "Sheet music with no clef that hums when the page is tapped.",
  "A key whose teeth change when nobody is looking.",
  "A chess knight carved from salt.",
  "A hand mirror that reflects the room a moment late.",
  "A length of thread that cannot be cut, only persuaded.",
  "A ticket to a play that has not been written.",
  "A candle that burns one blue inch and relights itself the next night.",
  "A tooth with a tiny hinge.",
  "A map scrap that shows only the place where the holder is standing.",
  "A bell that rings in another room.",
  "A wooden bird that turns to face the nearest lie.",
  "A spoon that will not hold soup, only names.",
  "A glass eye, warm, that blinks when thunder is coming.",
];

export const TABLES = {
  place: PLACES,
  twist: TWISTS,
  rumor: RUMORS,
  trinket: TRINKETS,
};

export const PARTS = { FIRST, LAST, ROLES, DEMEANORS, WANTS, SECRETS, TELLS };

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function titleCaseRole(role) {
  const stripped = role.replace(/^an?\s+/, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function drawPerson(rng) {
  const title = `${pick(FIRST, rng)} ${pick(LAST, rng)}`;
  const role = pick(ROLES, rng);
  const manner = pick(DEMEANORS, rng);
  const wants = pick(WANTS, rng);
  const secret = pick(SECRETS, rng);
  const tell = pick(TELLS, rng);
  const lines = [
    ["Role", titleCaseRole(role)],
    ["Manner", manner],
    ["Wants", wants],
    ["Secret", secret],
    ["Tell", tell],
  ];
  const body = `${title}, ${role}. ${manner} Wants ${wants}. Secret: ${secret} Tell: ${tell}.`;
  return { kind: "person", title, body, lines };
}

export function draw(kind, rng = Math.random) {
  if (kind === "person") return drawPerson(rng);
  const list = TABLES[kind];
  if (!list) throw new Error("Unknown prompt.");
  return { kind, title: KIND_LABEL[kind], body: pick(list, rng) };
}

export function drawScene(rng = Math.random) {
  return {
    kind: "scene",
    title: "Scene",
    cards: KINDS.map((kind) => draw(kind, rng)),
  };
}

export function sparkText(card) {
  if (card.kind === "scene") {
    return card.cards.map((part) => `${part.title}\n${part.body}`).join("\n\n");
  }
  return card.body;
}
