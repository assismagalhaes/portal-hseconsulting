import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260718180000_fix_psico_report_validation_status.sql"),
  "utf8",
);
const reportContentMigration = readFileSync(
  resolve("supabase/migrations/20260718183000_fix_psico_report_content_without_import.sql"),
  "utf8",
);
const reportImportRecordMigration = readFileSync(
  resolve("supabase/migrations/20260718190000_fix_psico_report_import_record_type.sql"),
  "utf8",
);
const reportSnapshotDigestMigration = readFileSync(
  resolve("supabase/migrations/20260718193000_fix_psico_report_snapshot_digest.sql"),
  "utf8",
);
const reportValidationCodeMigration = readFileSync(
  resolve("supabase/migrations/20260718200000_fix_psico_report_validation_code_pgcrypto.sql"),
  "utf8",
);
const reportDocumentTimelineRetryMigration = readFileSync(
  resolve("supabase/migrations/20260718203000_fix_psico_document_timeline_and_failed_retry.sql"),
  "utf8",
);
const reportSafeMetadataMigration = readFileSync(
  resolve("supabase/migrations/20260718210000_preserve_safe_psico_report_metadata.sql"),
  "utf8",
);
const reportMethodologySnapshotMigration = readFileSync(
  resolve("supabase/migrations/20260718211000_fix_psico_report_methodology_snapshot.sql"),
  "utf8",
);
const duplicateTemplateVersionMigration = readFileSync(
  resolve("supabase/migrations/20260718210224_8002e5db-05ab-41c8-9de8-c2c4a13afae4.sql"),
  "utf8",
);
const canonicalTemplateVersionMigration = readFileSync(
  resolve("supabase/migrations/20260718213000_bump_psico_report_template_version.sql"),
  "utf8",
);
const reportTemplateVersionMigration = readFileSync(
  resolve("supabase/migrations/20260718213351_b7cfa611-b98b-4039-8511-2183747260b3.sql"),
  "utf8",
);
const reportExecutiveSnapshotMigration = readFileSync(
  resolve("supabase/migrations/20260720141040_enrich_psico_report_snapshot.sql"),
  "utf8",
);
const reportVisualMethodologyMigration = readFileSync(
  resolve("supabase/migrations/20260720151008_enrich_psico_report_methodology_v1_2.sql"),
  "utf8",
);
const reportEditorialVersionMigration = readFileSync(
  resolve("supabase/migrations/20260720161655_bump_psico_report_editorial_v1_3.sql"),
  "utf8",
);
const duplicatePreviewQrMigration = readFileSync(
  resolve("supabase/migrations/20260718220000_bump_psico_report_template_preview_qr.sql"),
  "utf8",
);
const reportFunction = readFileSync(
  resolve("supabase/functions/psico-gerar-relatorio/template.tsx"),
  "utf8",
);
const reportDocument = readFileSync(
  resolve("supabase/functions/psico-gerar-relatorio/report-document.tsx"),
  "utf8",
);

describe("validação da emissão do relatório psicossocial", () => {
  it("usa a coluna real de status do processamento", () => {
    expect(migration).not.toContain("v_proc.status_processamento");
    expect(migration).toContain("v_proc.status IS DISTINCT FROM 'concluido'");
    expect(migration).toContain("v_processamento_valido := true");
  });

  it("retorna flags falsas sem acessar records não inicializados", () => {
    expect(migration).toContain("'processamento_valido', v_processamento_valido");
    expect(migration).toContain("'revisao_tecnica_aprovada', v_revisao_aprovada");
    expect(migration).toContain("'plano_aprovado', v_plano_aprovado");
    expect(migration).toContain("'responsavel_tecnico_valido', v_responsavel_valido");
  });
});

describe("autenticação da função de geração do relatório", () => {
  it("usa a API disponível na versão fixada do supabase-js", () => {
    expect(reportFunction).toContain('userClient.auth.getUser(token)');
    expect(reportFunction).toContain('const userId = userData.user.id');
    expect(reportFunction).not.toContain('userClient.auth.getClaims');
  });
});

describe("conteudo aprovado do relatorio sem importacao", () => {
  it("nao acessa um record de importacao que nunca foi inicializado", () => {
    expect(reportContentMigration).toContain("_tem_importacao BOOLEAN := false");
    expect(reportContentMigration).toContain("_tem_importacao := FOUND");
    expect(reportContentMigration).toContain("CASE WHEN NOT _tem_importacao");
    expect(reportContentMigration).not.toContain("CASE WHEN _imp IS NULL");
  });

  it("trata avaliacao ou revisao ausente usando FOUND", () => {
    expect(reportContentMigration.match(/IF NOT FOUND THEN/g)).toHaveLength(2);
    expect(reportContentMigration).not.toContain("IF _av IS NULL");
    expect(reportContentMigration).not.toContain("IF _rev IS NULL");
  });

  it("define a estrutura do registro de importacao antes de acessar seus campos", () => {
    expect(reportContentMigration).toContain(
      "_imp public.psico_importacoes_avaliacoes%ROWTYPE",
    );
    expect(reportImportRecordMigration).toContain(
      "_imp public.psico_importacoes_avaliacoes%ROWTYPE",
    );
    expect(reportImportRecordMigration).not.toContain("_imp RECORD");
  });
});

describe("hash do snapshot do relatorio", () => {
  it("resolve digest no schema onde o pgcrypto esta instalado", () => {
    expect(reportSnapshotDigestMigration).toContain("extensions.digest(");
    expect(reportSnapshotDigestMigration).toContain("SET search_path = public");
    expect(reportSnapshotDigestMigration).not.toMatch(/(?<!extensions\.)digest\(/);
  });
});

describe("codigo de validacao do relatorio", () => {
  it("resolve gen_random_bytes no schema onde o pgcrypto esta instalado", () => {
    expect(reportValidationCodeMigration).toContain("extensions.gen_random_bytes(16)");
    expect(reportValidationCodeMigration).toContain("SET search_path = public");
    expect(reportValidationCodeMigration).not.toMatch(
      /(?<!extensions\.)gen_random_bytes\(/,
    );
  });
});

describe("integracao do relatorio com documentos tecnicos", () => {
  it("registra a timeline somente depois de inserir o documento pai", () => {
    expect(reportDocumentTimelineRetryMigration).toContain(
      "AFTER INSERT ON public.documentos_tecnicos",
    );
    expect(reportDocumentTimelineRetryMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.documentos_timeline_after_insert()",
    );
    expect(reportDocumentTimelineRetryMigration).toContain(
      "COALESCE(auth.uid(), NEW.created_by)",
    );
  });

  it("reutiliza uma revisao falha para permitir retry sem violar a numeracao", () => {
    expect(reportDocumentTimelineRetryMigration).toContain("AND status = 'falhou'");
    expect(reportDocumentTimelineRetryMigration).toContain("status = 'gerando'");
    expect(reportDocumentTimelineRetryMigration).toContain("erro_codigo = NULL");
    expect(reportDocumentTimelineRetryMigration).toContain(
      "'emissao_relatorio_retentada'",
    );
    expect(reportDocumentTimelineRetryMigration).not.toMatch(
      /DELETE FROM public\.psico_relatorios_versoes/i,
    );
  });
});

describe("metadados seguros do PDF psicossocial", () => {
  it("preserva somente a identificacao profissional aprovada", () => {
    expect(reportSafeMetadataMigration).toContain("'nome_responsavel'");
    expect(reportSafeMetadataMigration).toContain("v->>'nome'");
    expect(reportSafeMetadataMigration).toContain("'registro_profissional'");
    expect(reportSafeMetadataMigration).not.toMatch(
      /responsavel_seguro\s*:=.*v->>'email'/s,
    );
  });

  it("persiste a metodologia vinculada no snapshot aprovado", () => {
    expect(reportMethodologySnapshotMigration).toContain(
      "'{avaliacao,metodologia}'",
    );
    expect(reportMethodologySnapshotMigration).toContain("mv.codigo");
    expect(reportMethodologySnapshotMigration).toContain("mv.versao");
    expect(reportMethodologySnapshotMigration).toContain(
      "av.processamento_resultado_ativo_id",
    );
    expect(reportMethodologySnapshotMigration).toContain(
      "proc.metodologia_versao_id",
    );
  });

  it("prioriza a metodologia imutavel do snapshot e nunca concatena nome ausente", () => {
    expect(reportDocument).toContain("assessment?.metodologia");
    expect(reportDocument).toContain(
      "snapshot?.agregado?.processamento?.metodologia",
    );
    expect(reportDocument).toContain("methodologyLabel");
    expect(reportDocument).toContain("responsible?.nome_responsavel");
    expect(reportDocument).not.toContain("${biblioteca.nome}");
    expect(reportDocument).not.toContain('{responsavel?.nome || "—"}');
  });

  it("formata o horario de aprovacao no fuso oficial do portal", () => {
    expect(reportDocument).toMatch(
      /function dateTime[\s\S]*?timeZone: "America\/Sao_Paulo"[\s\S]*?\n}/,
    );
  });

  it("versiona a RPC e o renderer juntos quando o template muda", () => {
    const edgeVersion = reportDocument.match(
      /export const REPORT_MODEL_VERSION = "([^"]+)"/,
    )?.[1];

    expect(edgeVersion).toBe("1.3.0");
    expect(reportEditorialVersionMigration).toContain(
      `v_modelo_versao text := ''${edgeVersion}''`,
    );
    expect(reportEditorialVersionMigration).toContain(
      "psico_preparar_emissao_relatorio(uuid,text,text)",
    );
  });

  it("inclui somente indicadores agregados no resumo executivo", () => {
    expect(reportExecutiveSnapshotMigration).toContain("'total_participantes', e.respondentes");
    expect(reportExecutiveSnapshotMigration).toContain("'indice_geral_descritivo'");
    expect(reportExecutiveSnapshotMigration).toContain("'fator_nome', f.nome");
    expect(reportExecutiveSnapshotMigration).toContain("'score_medio', rf.score_medio");
    expect(reportExecutiveSnapshotMigration).not.toContain("psico_respostas");
    expect(reportExecutiveSnapshotMigration).not.toContain("psico_participantes");
  });

  it("inclui parâmetros metodológicos e distribuição agregada sem respostas individuais", () => {
    expect(reportVisualMethodologyMigration).toContain("'escala_min', 0");
    expect(reportVisualMethodologyMigration).toContain("'escala_max'");
    expect(reportVisualMethodologyMigration).toContain("'criterio_principal_percentual'");
    expect(reportVisualMethodologyMigration).toContain("'percentual_critico', rf.percentual_critico");
    expect(reportVisualMethodologyMigration).not.toContain("psico_respostas");
    expect(reportVisualMethodologyMigration).not.toContain("psico_participantes");
  });

  it("usa a identidade oficial e dados completos da organização avaliada", () => {
    expect(reportDocument).toContain("HSE_LOGO_GREEN_DATA_URL");
    expect(reportDocument).toContain("Razão social:");
    expect(reportDocument).toContain("CNPJ:");
    expect(reportDocument).toContain("Endereço:");
    expect(reportFunction).toContain("cnpj_cpf, endereco, numero, complemento, bairro, cidade, uf, cep");
    expect(reportFunction).toContain('from("proposal_template")');
  });

  it("apresenta distribuição percentual e critérios de significância", () => {
    expect(reportDocument).toContain("Distribuição das respostas por fator");
    expect(reportDocument).toContain("percentual_irrelevante");
    expect(reportDocument).toContain("percentual_critico");
    expect(reportDocument).toContain("Índice geral descritivo:");
    expect(reportDocument).toContain("principalCriterionLabel");
    expect(reportDocument).toContain("principalLimit");
    expect(reportDocument).toContain("aggravationLimit");
    expect(reportDocument).toContain("criticalLimit");
    expect(reportDocument).not.toContain("PANORAMA DOS RISCOS");
    expect(reportDocument).not.toContain("avaliação de riscos psicossociais");
  });

  it("aplica as regras editoriais para dados ausentes e planos preventivos", () => {
    expect(reportDocument).toContain("Plano de monitoramento preventivo");
    expect(reportDocument).toContain("Prioridade ${riskLabel(highest?.prioridade)}");
    expect(reportDocument).toContain("Dados históricos importados");
    expect(reportDocument).toContain("Amostra de pequeno porte");
    expect(reportDocument).not.toContain("Muito baixo");
    expect(reportDocument).not.toContain("Endereço não informado no cadastro");
  });

  it("mantém como no-op a migração duplicada criada pelo sincronismo", () => {
    expect(duplicateTemplateVersionMigration).toContain("NULL;");
    expect(duplicateTemplateVersionMigration).not.toContain("pg_get_functiondef");
    expect(canonicalTemplateVersionMigration).toContain(
      "v_modelo_versao text := ''1.0.1''",
    );
  });

  it("mantém como no-op o identificador original após o Lovable materializar 1.0.2", () => {
    expect(duplicatePreviewQrMigration).toContain("NULL;");
    expect(duplicatePreviewQrMigration).not.toContain("pg_get_functiondef");
    expect(reportTemplateVersionMigration).toContain(
      "v_modelo_versao text := ''1.0.2''",
    );
  });

  it("gera QR Code apontando para a validação pública somente no PDF oficial", () => {
    expect(reportFunction).toContain('import QRCode from "npm:qrcode@1.5.4"');
    expect(reportFunction).toContain("VALIDATION_PAGE_URL");
    expect(reportFunction).toContain("?codigo=${encodeURIComponent(codigoValidacao)}");
    expect(reportFunction).toContain("QRCode.toDataURL(validationUrl");
    expect(reportDocument).toContain("<Image src={qrDataUrl}");
    expect(reportDocument).toContain("!preview && qrDataUrl");
  });

  it("renderiza prévia marcada sem preparar ou persistir uma emissão", () => {
    const previewStart = reportFunction.indexOf('if (modo === "preview")');
    const prepareStart = reportFunction.indexOf(
      'userClient.rpc("psico_preparar_emissao_relatorio"',
    );

    expect(previewStart).toBeGreaterThan(0);
    expect(prepareStart).toBeGreaterThan(previewStart);
    expect(reportFunction).toContain("PRÉVIA — SEM VALIDADE");
    expect(reportDocument).toContain("{preview && <Text style={styles.watermark}>");
    expect(reportFunction).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(reportFunction.slice(previewStart, prepareStart)).not.toContain(
      '.storage.from("psico-relatorios")',
    );
    expect(reportFunction.slice(previewStart, prepareStart)).not.toContain(
      "psico_concluir_emissao_relatorio",
    );
  });
});
