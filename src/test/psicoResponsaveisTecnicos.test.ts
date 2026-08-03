import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("responsáveis técnicos da revisão coletiva", () => {
  it("lista profissionais e perfis e congela a origem no snapshot", () => {
    const component = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/psico/PsicoRevisaoTab.tsx"),
      "utf8",
    );
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20260727181246_support_professional_responsible_collective.sql",
      ),
      "utf8",
    );

    expect(component).toContain('rpc("psico_ind_listar_responsaveis")');
    expect(component).toContain("Profissionais cadastrados");
    expect(component).toContain("Usuários do sistema");
    expect(migration).toContain("FROM public.execucao_profissionais");
    expect(migration).toContain("'assinatura_modo', 'em_branco'");
    expect(migration).toContain("RESPONSAVEL_TECNICO_NAO_LOCALIZADO");
  });
});
