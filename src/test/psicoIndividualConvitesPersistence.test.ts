import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const component = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/psico/PsicoIndividualConvitesTab.tsx"),
  "utf8",
);
const edgeFunction = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/functions/psico-individual-invite-token/index.ts"),
  "utf8",
);

describe("persistência visual dos convites AQI", () => {
  it("consulta os convites existentes ao entrar ou retornar à aba", () => {
    expect(component).toContain("useEffect(() =>");
    expect(component).toContain("void carregar(true)");
    expect(component).toContain("somente_consulta: somenteConsulta");
    expect(component).toContain("Consultando convites existentes");
  });

  it("mantém a criação de convites como ação explícita", () => {
    expect(component).toContain('onClick={() => carregar(false)}');
    expect(edgeFunction).toContain("const somenteConsulta = body?.somente_consulta === true");
    expect(edgeFunction).toContain("if (somenteConsulta) continue");
  });

  it("distingue carregamento, ausência e convites persistidos", () => {
    expect(component).toContain("convites === null");
    expect(component).toContain("convites.length === 0");
    expect(component).toContain('convites?.length ? "Atualizar" : "Gerar links"');
  });
});
