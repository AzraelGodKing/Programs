import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { qrMatrix } from "../src/qr.js";

test("the player link QR matches a known byte-mode code", () => {
  const matrix = qrMatrix("https://lantern.azraelsmods.com/player.html?room=WOLF");
  assert.equal(matrix.length, 33);
  const flat = matrix.map((row) => row.map((bit) => (bit ? "1" : "0")).join("")).join("");
  assert.equal(
    createHash("sha256").update(flat).digest("hex"),
    "7351f82fc8e7991a741006bc081fe7914410334ea1d1d5ceefe841da639b2984",
  );
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[8][8], false);
});
