import { test } from "node:test";
import assert from "node:assert/strict";
import { SIZES, nextSize } from "../src/textsize.js";

test("text size cycles through every size and wraps", () => {
  assert.deepEqual(SIZES, ["normal", "large", "larger"]);
  assert.equal(nextSize("normal"), "large");
  assert.equal(nextSize("large"), "larger");
  assert.equal(nextSize("larger"), "normal");
});
