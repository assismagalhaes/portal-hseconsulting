import { describe, expect, it } from "vitest";
import {
  CLIENT_LOGO_BUCKET,
  CLIENT_LOGO_MAX_BYTES,
  clientLogoPath,
  detectClientLogoMime,
} from "@/lib/clientBranding";

describe("identidade visual privada do cliente", () => {
  it("reconhece PNG pela assinatura binária", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectClientLogoMime(png)).toBe("image/png");
  });

  it("reconhece JPEG somente com início e fim válidos", () => {
    expect(detectClientLogoMime(new Uint8Array([0xff, 0xd8, 0x00, 0xff, 0xd9]))).toBe("image/jpeg");
    expect(detectClientLogoMime(new Uint8Array([0xff, 0xd8, 0x00, 0x00]))).toBeNull();
  });

  it("rejeita conteúdo que apenas declara ser imagem", () => {
    expect(detectClientLogoMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("mantém caminho, bucket e limite determinísticos", () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    expect(CLIENT_LOGO_BUCKET).toBe("client-branding");
    expect(CLIENT_LOGO_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(clientLogoPath(clientId, "png")).toBe(`${clientId}/logo.png`);
    expect(clientLogoPath(clientId, "jpg")).toBe(`${clientId}/logo.jpg`);
  });
});
