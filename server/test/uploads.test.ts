import test from "node:test";
import assert from "node:assert/strict";
import { matchesUploadContent } from "../src/security/uploads.ts";

test("validates image, PDF and binary glTF signatures", () => {
  assert.equal(matchesUploadContent(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), true);
  assert.equal(matchesUploadContent(Buffer.from("%PDF-1.7\n"), "application/pdf"), true);
  const glb = Buffer.alloc(12);
  glb.write("glTF", 0, "ascii");
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  assert.equal(matchesUploadContent(glb, "model/gltf-binary"), true);
  assert.equal(matchesUploadContent(Buffer.from("<script>alert(1)</script>"), "application/pdf"), false);
  glb.writeUInt32LE(99, 8);
  assert.equal(matchesUploadContent(glb, "model/gltf-binary"), false);
});
