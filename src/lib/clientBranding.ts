export const CLIENT_LOGO_BUCKET = "client-branding";
export const CLIENT_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type ValidatedClientLogo = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
  hashSha256: string;
};

export function detectClientLogoMime(bytes: Uint8Array): ValidatedClientLogo["mimeType"] | null {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return "image/png";

  const isJpeg =
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9;
  return isJpeg ? "image/jpeg" : null;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateClientLogo(file: File): Promise<ValidatedClientLogo> {
  if (file.size <= 0 || file.size > CLIENT_LOGO_MAX_BYTES) {
    throw new Error("A logomarca deve ter no máximo 2 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectClientLogoMime(bytes);
  if (!mimeType) {
    throw new Error("Use uma imagem PNG ou JPEG válida.");
  }

  return {
    bytes,
    mimeType,
    extension: mimeType === "image/png" ? "png" : "jpg",
    hashSha256: await sha256Hex(bytes),
  };
}

export function clientLogoPath(clientId: string, extension: "png" | "jpg") {
  return `${clientId}/logo.${extension}`;
}
