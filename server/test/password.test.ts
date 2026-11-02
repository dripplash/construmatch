import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/security/passwords.ts";

test("scrypt accepts the original password and rejects another", async () => {
  const encoded = await hashPassword("correct horse battery staple!7");
  assert.equal(await verifyPassword("correct horse battery staple!7", encoded), true);
  assert.equal(await verifyPassword("incorrect password", encoded), false);
  assert.match(encoded, /^scrypt\$131072\$8\$1\$/);
});

test("password policy requires length, number and symbol", async () => {
  await assert.rejects(() => hashPassword("only letters here"), /letra, un número y un símbolo/);
});
