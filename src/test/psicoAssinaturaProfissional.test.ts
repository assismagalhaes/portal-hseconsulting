import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const component = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/psico/PsicoRevisaoTab.tsx"),
  "utf8",
);
const uploadFunction = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/functions/psico-assinatura-upload/index.ts"),
  "utf8",
);
const migration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/20260728140800_support_professional_signature_images.sql",
  ),
  "utf8",
);
const signatureStatusMigration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/20260806114945_expose_psico_responsible_signature_status.sql",
  ),
  "utf8",
);

describe("assinatura gráfica de profissionais cadastrados", () => {
  it("oferece o mesmo seletor de imagem e envia a origem do responsável", () => {
    expect(component).toContain('formData.append("responsavel_origem", selected.origem)');
    expect(component).toContain("Enviar PNG/JPG");
    expect(component).toContain('selected.origem === "perfil" && selected.id === user?.id');
    expect(component).not.toContain("reservará o espaço para assinatura");
  });

  it("armazena a assinatura na tabela correta com autorização e auditoria", () => {
    expect(uploadFunction).toContain('"execucao_profissionais" : "profiles"');
    expect(uploadFunction).toContain('targetOrigin === "profissional" || targetUserId !== authData.user.id');
    expect(uploadFunction).toContain("RESPONSAVEL_NAO_LOCALIZADO");
    expect(uploadFunction).toContain("origem: targetOrigin");
  });

  it("congela imagem, mime e hash do profissional na aprovação", () => {
    expect(migration).toContain("ALTER TABLE public.execucao_profissionais");
    expect(migration).toContain("psico_guard_assinatura_profissional");
    expect(migration).toContain("'assinatura_storage_path'");
    expect(migration).toContain("'assinatura_hash_sha256'");
    expect(migration).toContain("'origem', 'profissional'");
  });

  it("informa ao técnico quando a assinatura cadastrada será aplicada automaticamente", () => {
    expect(component).toContain('rpc("psico_listar_responsaveis_assinatura")');
    expect(component).toContain("assinaturaDisponivel");
    expect(component).toContain("será aplicada automaticamente");
    expect(component).toContain("podeGerenciarAssinatura");
  });

  it("expõe apenas a disponibilidade da assinatura para usuários do módulo psicossocial", () => {
    expect(signatureStatusMigration).toContain("RETURNS TABLE(");
    expect(signatureStatusMigration).toContain("assinatura_disponivel boolean");
    expect(signatureStatusMigration).toContain("public.can_see_psico((SELECT auth.uid()))");
    expect(signatureStatusMigration).not.toContain("assinatura_nome_arquivo");
    expect(signatureStatusMigration).toContain("FROM PUBLIC, anon");
  });
});
