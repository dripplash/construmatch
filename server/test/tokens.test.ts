import test from "node:test";
import assert from "node:assert/strict";
import { createToken, hashToken } from "../src/security/tokens.ts";

test("auth tokens are random and only their deterministic SHA-256 hash is stored", () => {
  const first = createToken();
  const second = createToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.match(hashToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashToken(first), hashToken(first));
  assert.notEqual(hashToken(first), hashToken(second));
});
