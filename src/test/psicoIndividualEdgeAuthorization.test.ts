import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const edgeFunctions = [
  "supabase/functions/psico-individual-processar/index.ts",
  "supabase/functions/psico-individual-sugerir-plano/index.ts",
];

describe("autorização das Edge Functions individuais", () => {
  for (const file of edgeFunctions) {
    it(`${file} autoriza administradores e técnicos e trata falha de autorização`, () => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");

      expect(source).toContain('_role: "admin"');
      expect(source).toContain('_role: "tecnico"');
      expect(source).toContain("adminRole.error || tecnicoRole.error");
      expect(source).toContain("!adminRole.data && !tecnicoRole.data");
      expect(source).toContain('error: "autorizacao_interna_falhou"');
      expect(source).not.toContain('rpc("can_see_internal"');
    });
  }
});
