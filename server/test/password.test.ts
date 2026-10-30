import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/security/passwords.ts";

test("scrypt accepts the original password and rejects another", async () => {
  const encoded = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("incorrect password", encoded), false);
  assert.match(encoded, /^scrypt\$131072\$8\$1\$/);
});
