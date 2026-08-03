import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mensagemFalhaValidacaoEmissao } from "@/lib/psicoRelatorio";

const migration = readFileSync(
  resolve("supabase/migrations/20260728171828_fix_psico_reopen_admin_signature.sql"),
  "utf8",
);

describe("reabertura da revisão técnica", () => {
  it("usa a assinatura de is_admin existente no projeto", () => {
    expect(migration).toContain("NOT public.is_admin()");
    expect(migration).not.toContain("public.is_admin(auth.uid())");
  });

  it("preserva autenticação, auditoria e privilégios mínimos", () => {
    expect(migration).toContain("auth.uid() IS NULL");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = public");
    expect(migration).toContain("'revisao_reaberta'");
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain("TO authenticated");
  });
});

describe("falha da validação da emissão", () => {
  it("expõe a causa devolvida pela RPC para diagnóstico", () => {
    expect(mensagemFalhaValidacaoEmissao({
      message: "function public.is_admin(uuid) does not exist",
    })).toContain("Detalhe técnico: function public.is_admin(uuid) does not exist");
  });

  it("mantém mensagem segura quando não há detalhe", () => {
    expect(mensagemFalhaValidacaoEmissao(null)).not.toContain("Detalhe técnico:");
  });
});
