/** One run of the shared room module: join, whisper, and shop. Python asserts this report. */

import { TableRoom } from "../worker/room.js";

function memoryStorage() {
  const data = new Map();
  return {
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : undefined;
    },
    async put(key, value) {
      if (typeof key === "object") {
        for (const [name, stored] of Object.entries(key)) data.set(name, structuredClone(stored));
        return;
      }
      data.set(key, structuredClone(value));
    },
    async list({ prefix }) {
      const out = new Map();
      for (const [name, stored] of data) {
        if (name.startsWith(prefix)) out.set(name, structuredClone(stored));
      }
      return out;
    },
    async setAlarm() {},
    async deleteAll() {
      data.clear();
    },
  };
}

const table = new TableRoom(memoryStorage());
const dmToken = await table.create();
const mara = await table.join("", { name: "Mara" });
const ivo = await table.join("", { name: "Ivo" });
await table.talk(mara.token, { text: "On the table.", to: "" });
await table.talk(mara.token, { text: "Just for Ivo.", to: "Ivo" });
await table.talk(dmToken, { text: "The door is trapped.", to: "Mara" });
const shop = await table.setShop(dmToken, {
  open: true,
  stall: "apothecary",
  name: "  Vials  ",
  goods: [
    { id: "potion-healing", name: "Potion of healing", cp: 4000, service: false },
    { id: "upgrade-plus-1", name: "Bring a weapon or armor from +0 to +1", cp: 50000, service: true },
  ],
});
let playerShopBlocked = false;
try {
  await table.setShop(mara.token, { open: false });
} catch {
  playerShopBlocked = true;
}
let impostorBlocked = false;
try {
  await table.join("", { name: "Mara" });
} catch {
  impostorBlocked = true;
}
const texts = (view) => view.messages.map((item) => item.text);
const report = {
  joined: mara.name,
  publicWhisper: texts(await table.view("")),
  ivoWhisper: texts(await table.view(ivo.token)),
  maraWhisper: texts(await table.view(mara.token)),
  dmWhisper: texts(await table.view(dmToken)),
  shopName: shop.name,
  playerShopBlocked,
  impostorBlocked,
};
process.stdout.write(`${JSON.stringify(report)}\n`);
