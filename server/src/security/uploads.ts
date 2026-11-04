export function matchesUploadContent(buffer: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mime === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mime === "model/gltf-binary") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "glTF"
      && buffer.readUInt32LE(4) === 2
      && buffer.readUInt32LE(8) === buffer.length;
  }
  return false;
}
