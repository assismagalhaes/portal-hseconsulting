import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260730200214_improve_proposal_revision_flow.sql"),
  "utf8",
);
const editor = readFileSync(resolve("src/pages/ProposalEditor.tsx"), "utf8");
const revisionsCard = readFileSync(
  resolve("src/components/proposal/RevisionsCard.tsx"),
  "utf8",
);

describe("fluxo de revisões comerciais da proposta", () => {
  it("preserva versões emitidas e abre somente uma revisão em edição", () => {
    expect(migration).toContain("proposal_revision_snapshot");
    expect(migration).toContain("COALESCE(v_atual.snapshot->>'estado', 'em_edicao') <> 'emitida'");
    expect(migration).toContain("v_atual.revisao + 1");
    expect(migration).toContain("ORDER BY revisao DESC");
    expect(migration).not.toContain("MAX(valor_novo)");
  });

  it("registra serviços e precificação no snapshot comercial", () => {
    expect(migration).toContain("'itens'");
    expect(migration).toContain("'precificacao'");
    expect(migration).toContain("proposal_item_pricing");
    expect(migration).toContain("'valor_unitario'");
  });

  it("sincroniza após alterações e fecha a versão antes do PDF", () => {
    expect(editor).toContain("await syncProposalRevision(proposal.id)");
    expect(editor).toContain("await closeProposalRevision(proposal.id)");
    expect(editor.indexOf("await closeProposalRevision(proposal.id)")).toBeLessThan(
      editor.indexOf('const clienteNome = client?.nome_fantasia'),
    );
  });

  it("explica que a revisão em edição é consolidada, não duplicada", () => {
    expect(revisionsCard).toContain("Alterações em serviços, preços e custos");
    expect(revisionsCard).toContain("Consolidar revisão");
    expect(revisionsCard).toContain("Alterações detectadas");
  });
});
