// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import QRCode from "npm:qrcode@1.5.4";
// @deno-types="npm:@types/react@18.3.3"
import React from "npm:react@18.3.1";
import { renderToBuffer } from "npm:@react-pdf/renderer@3.4.5";
import { IndividualReportDocument, IND_MODEL_CODE, IND_MODEL_VERSION } from "./individual-report-document.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALIDATION_URL = "https://portal.hseconsulting.com.br/validar/relatorio-psicossocial";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = new Uint8Array(bytes).buffer as ArrayBuffer;
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function estimatePages(bytes: Uint8Array): number {
  const txt = new TextDecoder("latin1").decode(bytes);
  return (txt.match(/\/Type\s*\/Page[^s]/g)?.length) ?? 1;
}

async function loadSignature(admin: any, snapshot: any): Promise<string | undefined> {
  const resp = snapshot?.revisao?.responsavel;
  const path = resp?.assinatura_storage_path;
  if (!path) return undefined;
  const dl = await admin.storage.from("psico-assinaturas").download(path);
  if (dl.error || !dl.data) throw new Error("ASSINATURA_INDISPONIVEL");
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024) throw new Error("ASSINATURA_INVALIDA");
  const hash = await sha256Hex(bytes);
  if (resp?.assinatura_hash_sha256 && hash !== resp.assinatura_hash_sha256) throw new Error("ASSINATURA_INTEGRIDADE_INVALIDA");
  let binary = "";
  for (let off = 0; off < bytes.length; off += 8192) binary += String.fromCharCode(...bytes.subarray(off, off + 8192));
  const mime = resp?.assinatura_mime_type === "image/jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${btoa(binary)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const avaliacaoId: string | undefined = body?.avaliacao_id;
  const modo: "preview" | "emitir" = body?.modo === "emitir" ? "emitir" : "preview";
  if (!avaliacaoId) {
    return new Response(JSON.stringify({ error: "campos_obrigatorios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // Gates (executa como usuário autenticado — respeita can_see_internal)
    const gatesQ = await userClient.rpc("psico_ind_gates_emissao", { p_avaliacao: avaliacaoId });
    if (gatesQ.error) throw new Error(gatesQ.error.message);
    const gates: any = gatesQ.data;
    if (!gates?.pode_emitir) {
      return new Response(JSON.stringify({ error: "validacao_falhou", erros: gates?.erros || [] }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Snapshot com service_role
    const snapQ = await admin.rpc("psico_ind_snapshot_relatorio", { p_avaliacao: avaliacaoId });
    if (snapQ.error || !snapQ.data) throw new Error("SNAPSHOT_INVALIDO");
    const snapshot: any = snapQ.data;

    const cliente = snapshot?.empresa || {};
    const dataEmissao = new Date().toISOString();
    const assinaturaDataUrl = await loadSignature(admin, snapshot);

    if (modo === "preview") {
      const codigo = `PRÉVIA-${snapshot?.avaliacao?.codigo || "RAFPI"}`;
      const codigoRev = "R00";
      const nodeBuf = await renderToBuffer(
        <IndividualReportDocument
          snapshot={snapshot}
          codigo={codigo}
          codigoRev={codigoRev}
          codigoValidacao="PRÉVIA — SEM VALIDADE"
          cliente={cliente}
          dataEmissao={dataEmissao}
          assinaturaDataUrl={assinaturaDataUrl}
          preview
        />
      );
      const pdf = new Uint8Array(nodeBuf as any);
      if (pdf.length < 500) throw new Error("PDF_INVALIDO");
      return new Response(pdf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${codigo}_PREVIA.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Emitir: prepara com service_role
    const prep = await admin.rpc("psico_ind_preparar_relatorio", {
      p_avaliacao: avaliacaoId,
      p_modelo_codigo: IND_MODEL_CODE,
      p_modelo_versao: IND_MODEL_VERSION,
    });
    if (prep.error || !prep.data) throw new Error(prep.error?.message || "PREPARO_FALHOU");
    const relatorio = prep.data as any;
    const codigo: string = relatorio.codigo;
    const codigoRev = `R${String(relatorio.versao).padStart(2, "0")}`;
    const codigoValidacao: string = relatorio.codigo_validacao;
    const relatorioId: string = relatorio.id;

    try {
      const validationUrl = `${VALIDATION_URL}?codigo=${encodeURIComponent(codigoValidacao)}`;
      const qrDataUrl = await QRCode.toDataURL(validationUrl, {
        width: 180, margin: 1, errorCorrectionLevel: "M",
        color: { dark: "#0B2545", light: "#FFFFFF" },
      });

      const nodeBuf = await renderToBuffer(
        <IndividualReportDocument
          snapshot={snapshot}
          codigo={codigo}
          codigoRev={codigoRev}
          codigoValidacao={codigoValidacao}
          cliente={cliente}
          dataEmissao={dataEmissao}
          qrDataUrl={qrDataUrl}
          assinaturaDataUrl={assinaturaDataUrl}
        />
      );
      const pdf = new Uint8Array(nodeBuf as any);
      if (pdf.length < 500) throw new Error("PDF_INVALIDO");

      const hash = await sha256Hex(pdf);
      const paginas = estimatePages(pdf);
      const nomeArquivo = `${codigo}_${codigoRev}.pdf`;
      const storagePath = `${avaliacaoId}/${relatorioId}/${nomeArquivo}`;

      const up = await admin.storage.from("psico-relatorios").upload(storagePath, pdf, {
        contentType: "application/pdf", upsert: true,
      });
      if (up.error) throw new Error("ERRO_STORAGE");

      const concl = await admin.rpc("psico_ind_concluir_relatorio", {
        p_id: relatorioId,
        p_storage_path: storagePath,
        p_nome_arquivo: nomeArquivo,
        p_tamanho_bytes: pdf.length,
        p_quantidade_paginas: paginas,
        p_pdf_hash: hash,
        p_emitido_por: userId,
      });
      if (concl.error) throw new Error("ERRO_INTEGRACAO");

      return new Response(JSON.stringify({
        ok: true,
        relatorio_id: relatorioId,
        codigo, codigo_revisao: codigoRev,
        codigo_validacao: codigoValidacao,
        paginas, tamanho_bytes: pdf.length, hash_sha256: hash,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
      const codigo = ["SNAPSHOT_INVALIDO","PDF_INVALIDO","ERRO_STORAGE","ERRO_INTEGRACAO","ASSINATURA_INDISPONIVEL","ASSINATURA_INVALIDA","ASSINATURA_INTEGRIDADE_INVALIDA"]
        .includes(err?.message) ? err.message : "ERRO_INTERNO";
      try { await admin.rpc("psico_ind_falhar_relatorio", { p_id: relatorioId, p_erro: codigo }); } catch (_e) { /* noop */ }
      throw err;
    }
  } catch (err: any) {
    console.error("[psico-gerar-relatorio-individual]", err?.message || err);
    const codigo = ["validacao_falhou","SNAPSHOT_INVALIDO","PDF_INVALIDO","ERRO_STORAGE","ERRO_INTEGRACAO","ASSINATURA_INDISPONIVEL","ASSINATURA_INVALIDA","ASSINATURA_INTEGRIDADE_INVALIDA"]
      .includes(err?.message) ? err.message : "ERRO_INTERNO";
    return new Response(JSON.stringify({ error: codigo, detalhe: err?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});