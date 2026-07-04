import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeSeedUsers,
  normalizeUserId,
  uniqueQueueUsers,
} from "./queue-core.mjs";

test("normalizeUserId accepts PTT-like ids and lowercases them", () => {
  assert.equal(normalizeUserId(" AreLies "), "arelies");
  assert.equal(normalizeUserId("a22663564"), "a22663564");
});

test("normalizeUserId rejects unsafe ids", () => {
  assert.equal(normalizeUserId("../secret"), null);
  assert.equal(normalizeUserId(""), null);
  assert.equal(normalizeUserId("a".repeat(40)), null);
});

test("uniqueQueueUsers normalizes and de-duplicates queue rows", () => {
  const users = uniqueQueueUsers([
    { user_id: "AreLies" },
    { userId: "arelies" },
    "A22663564",
    "../bad",
  ]);

  assert.deepEqual(users, ["arelies", "a22663564"]);
});

test("mergeSeedUsers appends queue users without losing existing order", () => {
  assert.deepEqual(
    mergeSeedUsers(["a22663564", "arelies"], ["godblessgogp", "arelies"]),
    ["a22663564", "arelies", "godblessgogp"],
  );
});
