import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("cadastro de clientes para o perfil técnico", () => {
  it("libera o ciclo completo da logomarca no bucket privado", () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20260805143000_allow_tecnico_client_branding.sql"),
      "utf8",
    );
    expect(migration.match(/public\.can_see_psico\(auth\.uid\(\)\)/g)).toHaveLength(5);
    expect(migration).not.toContain("can_see_internal");
    for (const operation of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      expect(migration).toContain(`FOR ${operation} TO authenticated`);
    }
  });

  it("oferece exclusão confirmada e preserva clientes com vínculos", () => {
    const page = fs.readFileSync(path.resolve(process.cwd(), "src/pages/Clients.tsx"), "utf8");
    expect(page).toContain("Excluir cliente");
    expect(page).toContain("Excluir definitivamente");
    expect(page).toContain('error.code === "23503"');
    expect(page).toContain('.from("clients")');
    expect(page).toContain('.delete()');
    expect(page).toContain('.select("id")');
    expect(page).toContain("if (!deletedClient?.id)");
  });
});
