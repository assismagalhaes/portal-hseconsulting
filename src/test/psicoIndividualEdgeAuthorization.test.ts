import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const edgeFunctions = [
  "supabase/functions/psico-individual-processar/index.ts",
  "supabase/functions/psico-individual-sugerir-plano/index.ts",
];

describe("autorização das Edge Functions individuais", () => {
  for (const file of edgeFunctions) {
    it(`${file} respeita o contrato da RPC e trata falha de autorização`, () => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");

      expect(source).toContain("_user_id: userData.user.id");
      expect(source).toContain("error: canSeeError");
      expect(source).toContain('error: "autorizacao_interna_falhou"');
      expect(source).not.toContain("{ _user:");
    });
  }
});
