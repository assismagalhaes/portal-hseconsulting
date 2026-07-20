// deno-lint-ignore-file no-explicit-any no-import-prefix no-unused-vars
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import QRCode from "npm:qrcode@1.5.4";
import React from "npm:react@18.3.1";
import { renderToBuffer } from "npm:@react-pdf/renderer@3.4.5";
import {
  PsychosocialReportDocument,
  REPORT_COLORS,
  REPORT_MODEL_CODE,
  REPORT_MODEL_VERSION,
} from "./report-document.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELO_CODIGO = REPORT_MODEL_CODE;
const MODELO_VERSAO = REPORT_MODEL_VERSION;
const VALIDATION_PAGE_URL = "https://portal.hseconsulting.com.br/validar/relatorio-psicossocial";

type SnapshotRpcError = {
  message?: string;
  code?: string;
  hint?: string;
} | null;

function previewSnapshotError(stage: string, error: SnapshotRpcError) {
  const message = error?.message || "RPC retornou resultado vazio";
  console.error("[psico-gerar-relatorio] preview snapshot error", {
    stage,
    message,
    code: error?.code,
    hint: error?.hint,
  });

  const failure = new Error("SNAPSHOT_INVALIDO") as Error & { detalhe: string };
  failure.detalhe = `${stage}: ${message}`;
  return failure;
}

// ============================================================================
// HANDLER
// ============================================================================

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const digestInput = new Uint8Array(buf).buffer as ArrayBuffer;
  const h = await crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Best-effort page count from PDF bytes (regex /Type /Page)
function estimatePageCount(bytes: Uint8Array): number {
  const txt = new TextDecoder("latin1").decode(bytes);
  const matches = txt.match(/\/Type\s*\/Page[^s]/g);
  return matches?.length ?? 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const avaliacaoId: string | undefined = body?.avaliacao_id;
  const modo: string = body?.modo === "preview" ? "preview" : "emitir";
  const confirmacao: string | undefined = body?.confirmacao;
  const descricaoRevisao: string | null = body?.descricao_revisao ?? null;

  if (!avaliacaoId || (modo === "emitir" && !confirmacao)) {
    return new Response(JSON.stringify({ error: "campos_obrigatorios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (modo === "preview") {
    try {
      // A prévia valida a autorização e os pré-requisitos, mas não prepara uma
      // emissão: nenhum relatório, revisão, arquivo ou evento é persistido.
      const validacao = await userClient.rpc("psico_validar_emissao_relatorio", {
        p_avaliacao_id: avaliacaoId,
      });
      if (validacao.error) throw new Error(validacao.error.message);
      const validacaoData: any = validacao.data;
      if (!validacaoData?.pode_emitir) {
        return new Response(JSON.stringify({
          error: "validacao_falhou",
          erros: validacaoData?.erros || [],
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const conteudo = await userClient.rpc("psico_obter_conteudo_aprovado_relatorio", {
        p_avaliacao_id: avaliacaoId,
      });
      if (conteudo.error || !conteudo.data) {
        throw previewSnapshotError("psico_obter_conteudo_aprovado_relatorio", conteudo.error);
      }
      const sanitizado = await admin.rpc("psico_sanitize_snapshot", { p_data: conteudo.data });
      if (sanitizado.error || !sanitizado.data) {
        throw previewSnapshotError("psico_sanitize_snapshot", sanitizado.error);
      }
      const snapshot = {
        ...(sanitizado.data as Record<string, unknown>),
        modelo: { codigo: MODELO_CODIGO, versao: MODELO_VERSAO },
      };

      const avQ = await admin.from("psico_avaliacoes")
        .select("cliente_id").eq("id", avaliacaoId).maybeSingle();
      let cliente: any = { nome: "—" };
      if (avQ.data?.cliente_id) {
        const cli = await admin.from("clients").select("razao_social, nome_fantasia, cnpj_cpf, endereco, numero, complemento, bairro, cidade, uf, cep")
          .eq("id", avQ.data.cliente_id).maybeSingle();
        cliente = { ...cli.data, nome: cli.data?.nome_fantasia || cli.data?.razao_social || "—" };
      }
      const empresaQ = await admin.from("proposal_template")
        .select("quem_somos, telefone, email, site, endereco, slogan, cor_primaria, cor_secundaria")
        .limit(1).maybeSingle();

      const codigoRafp = `PRÉVIA-${validacaoData.avaliacao_codigo || "RELATÓRIO"}`;
      const codigoRev = validacaoData.proxima_revisao || "R00";
      const nodeBuf = await renderToBuffer(
        <PsychosocialReportDocument
          snapshot={snapshot}
          codigoRafp={codigoRafp}
          codigoRev={codigoRev}
          codigoValidacao="PRÉVIA — SEM VALIDADE"
          cliente={cliente}
          empresa={empresaQ.data || {}}
          dataEmissao={new Date().toISOString()}
          preview
        />
      );
      const pdfBuffer = new Uint8Array(nodeBuf as any);
      if (pdfBuffer.length < 500) throw new Error("PDF_INVALIDO");

      return new Response(pdfBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${codigoRafp}_${codigoRev}_PREVIA.pdf"`,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    } catch (err: any) {
      console.error("[psico-gerar-relatorio] preview error", err);
      const codigo = ["SNAPSHOT_INVALIDO", "ERRO_RENDERIZACAO", "PDF_INVALIDO"]
        .includes(err?.message) ? err.message : "ERRO_INTERNO";
      return new Response(JSON.stringify({ error: codigo, detalhe: err?.detalhe || err?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 1) preparar emissão (como usuário — usa auth.uid())
  const prep = await userClient.rpc("psico_preparar_emissao_relatorio", {
    p_avaliacao_id: avaliacaoId,
    p_confirmacao: confirmacao,
    p_descricao_revisao: descricaoRevisao,
  });
  if (prep.error) {
    return new Response(JSON.stringify({ error: prep.error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const prepData: any = prep.data;
  if (prepData?.reutilizada) {
    return new Response(JSON.stringify({
      ok: true, reutilizada: true,
      relatorio_id: prepData.relatorio_id,
      relatorio_versao_id: prepData.relatorio_versao_id,
      codigo: prepData.codigo, codigo_revisao: prepData.codigo_revisao,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const versaoId: string = prepData.relatorio_versao_id;
  const codigoRafp: string = prepData.codigo;
  const codigoRev: string = prepData.codigo_revisao;

  try {
    // 2) Buscar snapshot + dados auxiliares (service_role para bypassar RLS de forma controlada)
    const versaoQ = await admin.from("psico_relatorios_versoes")
      .select("id, snapshot_conteudo, codigo_validacao, avaliacao_id")
      .eq("id", versaoId).maybeSingle();
    if (versaoQ.error || !versaoQ.data) throw new Error("SNAPSHOT_INVALIDO");

    const snapshot: any = versaoQ.data.snapshot_conteudo;
    const codigoValidacao: string = versaoQ.data.codigo_validacao;
    const validationUrl = `${VALIDATION_PAGE_URL}?codigo=${encodeURIComponent(codigoValidacao)}`;
    const qrDataUrl = await QRCode.toDataURL(validationUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: REPORT_COLORS.navy, light: REPORT_COLORS.white },
    });

    const avQ = await admin.from("psico_avaliacoes").select("cliente_id").eq("id", versaoQ.data.avaliacao_id).maybeSingle();
    let cliente: any = { nome: "—" };
    if (avQ.data?.cliente_id) {
      const cli = await admin.from("clients")
        .select("razao_social, nome_fantasia, cnpj_cpf, endereco, numero, complemento, bairro, cidade, uf, cep")
        .eq("id", avQ.data.cliente_id).maybeSingle();
      cliente = { ...cli.data, nome: cli.data?.nome_fantasia || cli.data?.razao_social || "—" };
    }
    const empresaQ = await admin.from("proposal_template")
      .select("quem_somos, telefone, email, site, endereco, slogan, cor_primaria, cor_secundaria")
      .limit(1).maybeSingle();

    // 3) Renderizar PDF
    let pdfBuffer: Uint8Array;
    try {
      const nodeBuf = await renderToBuffer(
        <PsychosocialReportDocument
          snapshot={snapshot}
          codigoRafp={codigoRafp}
          codigoRev={codigoRev}
          codigoValidacao={codigoValidacao}
          cliente={cliente}
          empresa={empresaQ.data || {}}
          dataEmissao={new Date().toISOString()}
          qrDataUrl={qrDataUrl}
        />
      );
      pdfBuffer = new Uint8Array(nodeBuf as any);
    } catch (e) {
      console.error("[psico-gerar-relatorio] render error", e);
      throw new Error("ERRO_RENDERIZACAO");
    }

    if (!pdfBuffer || pdfBuffer.length < 500) throw new Error("PDF_INVALIDO");

    const hash = await sha256Hex(pdfBuffer);
    const paginas = estimatePageCount(pdfBuffer);
    const nomeArquivo = `${codigoRafp}_${codigoRev}.pdf`;
    const storagePath = `${versaoQ.data.avaliacao_id}/${versaoId}/${nomeArquivo}`;

    // 4) Upload
    const up = await admin.storage.from("psico-relatorios").upload(storagePath, pdfBuffer, {
      contentType: "application/pdf", upsert: true,
    });
    if (up.error) {
      console.error("[psico-gerar-relatorio] upload error", up.error);
      throw new Error("ERRO_STORAGE");
    }

    // 5) Concluir
    const concl = await admin.rpc("psico_concluir_emissao_relatorio", {
      p_relatorio_versao_id: versaoId,
      p_storage_path: storagePath,
      p_nome_arquivo: nomeArquivo,
      p_tamanho_bytes: pdfBuffer.length,
      p_quantidade_paginas: paginas,
      p_pdf_hash: hash,
      p_emitido_por: userId,
    });
    if (concl.error) {
      console.error("[psico-gerar-relatorio] concluir error", concl.error);
      throw new Error("ERRO_INTEGRACAO_DOCUMENTOS");
    }

    return new Response(JSON.stringify({
      ok: true,
      relatorio_id: prepData.relatorio_id,
      relatorio_versao_id: versaoId,
      codigo: codigoRafp,
      codigo_revisao: codigoRev,
      paginas, tamanho_bytes: pdfBuffer.length,
      hash_sha256: hash,
      documento_tecnico_id: (concl.data as any)?.documento_tecnico_id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    const codigo = ["SNAPSHOT_INVALIDO","MODELO_NAO_LOCALIZADO","ERRO_RENDERIZACAO",
      "ERRO_GRAFICO","PDF_INVALIDO","ERRO_STORAGE","ERRO_INTEGRACAO_DOCUMENTOS",
      "TEMPO_LIMITE","ERRO_INTERNO"].includes(err?.message) ? err.message : "ERRO_INTERNO";
    try {
      await admin.rpc("psico_falhar_emissao_relatorio", {
        p_relatorio_versao_id: versaoId, p_erro_codigo: codigo,
      });
    } catch (e2) { console.error("[psico-gerar-relatorio] falhar error", e2); }
    return new Response(JSON.stringify({ error: codigo, detalhe: err?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
