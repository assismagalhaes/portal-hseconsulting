// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import React from "npm:react@18.3.1";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
  Svg,
  Rect,
  Line,
  G,
  Path,
} from "npm:@react-pdf/renderer@3.4.5";

// ============================================================================
// TEMPLATE HSE-PSICO-REL-1.0
// ============================================================================

const MODELO_CODIGO = "HSE-PSICO-REL-1.0";
const MODELO_VERSAO = "1.0.0";

const COLORS = {
  primary: "#0F4C81",
  primarySoft: "#E7EEF6",
  accent: "#2E7D32",
  danger: "#C62828",
  warn: "#EF6C00",
  text: "#111827",
  muted: "#6B7280",
  border: "#D1D5DB",
  softBg: "#F9FAFB",
  white: "#FFFFFF",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 90,
    paddingBottom: 70,
    paddingHorizontal: 48,
    fontSize: 10,
    color: COLORS.text,
    fontFamily: "Helvetica",
    lineHeight: 1.45,
  },
  header: {
    position: "absolute",
    top: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 9, color: COLORS.primary, fontFamily: "Helvetica-Bold" },
  headerMeta: { fontSize: 8, color: COLORS.muted, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: COLORS.primary, marginBottom: 8 },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primarySoft,
    paddingBottom: 3,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 4,
  },
  p: { marginBottom: 6, textAlign: "justify" },
  muted: { color: COLORS.muted, fontSize: 9 },
  chip: {
    padding: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.white,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: COLORS.softBg,
    marginBottom: 8,
  },
  kvRow: { flexDirection: "row", marginBottom: 3 },
  kvKey: { width: 140, color: COLORS.muted, fontSize: 9 },
  kvVal: { flex: 1, fontSize: 10 },
  table: { borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, borderRadius: 3 },
  thead: { flexDirection: "row", backgroundColor: COLORS.primarySoft, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  th: { padding: 6, fontFamily: "Helvetica-Bold", fontSize: 9, color: COLORS.primary },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  td: { padding: 6, fontSize: 9 },
  coverBox: {
    marginTop: 60,
    padding: 24,
    borderTopWidth: 4,
    borderTopColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  coverKicker: { fontSize: 10, color: COLORS.primary, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  coverTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", color: COLORS.text, marginTop: 8 },
  coverSub: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, color: COLORS.primary },
  seloBox: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: "#EAF5EB",
    padding: 12,
    borderRadius: 4,
    marginTop: 10,
  },
});

function fmtDate(v: any): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return String(v); }
}

function fmtDateTime(v: any): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return String(v); }
}

function prioridadeColor(p?: string): string {
  const k = (p || "").toLowerCase();
  if (k.includes("alta") || k.includes("crítica") || k.includes("critica")) return COLORS.danger;
  if (k.includes("média") || k.includes("media")) return COLORS.warn;
  return COLORS.accent;
}

function Chip({ label, color }: { label: string; color: string }) {
  return <Text style={[s.chip, { backgroundColor: color }]}>{label}</Text>;
}

function KV({ k, v }: { k: string; v: any }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvKey}>{k}</Text>
      <Text style={s.kvVal}>{v ?? "—"}</Text>
    </View>
  );
}

function PageChrome({ codigoRafp, codigoRev, modelo }: { codigoRafp: string; codigoRev: string; modelo: string }) {
  return (
    <>
      <View style={s.header} fixed>
        <View>
          <Text style={s.headerTitle}>Relatório de Avaliação de Fatores Psicossociais</Text>
          <Text style={s.headerMeta}>{codigoRafp} · {codigoRev}</Text>
        </View>
        <Text style={s.headerMeta}>Modelo {modelo}{"\n"}HSE Consulting</Text>
      </View>
      <View style={s.footer} fixed>
        <Text>Documento controlado — uso interno e do cliente. Não substitui parecer clínico individual.</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

// ---- Gráfico simples: barras horizontais dos fatores ----
function BarChart({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const width = 480;
  const rowH = 22;
  const height = Math.max(60, items.length * rowH + 20);
  const max = Math.max(1, ...items.map((i) => i.value));
  const labelW = 150;
  const chartW = width - labelW - 40;

  return (
    <Svg width={width} height={height}>
      {items.map((it, idx) => {
        const y = 10 + idx * rowH;
        const w = (it.value / max) * chartW;
        return (
          <G key={idx}>
            <Text x={0} y={y + 12} style={{ fontSize: 9, fill: COLORS.text } as any}>{it.label.slice(0, 32)}</Text>
            <Rect x={labelW} y={y} width={chartW} height={12} fill={COLORS.primarySoft} />
            <Rect x={labelW} y={y} width={Math.max(2, w)} height={12} fill={it.color} />
            <Text x={labelW + chartW + 4} y={y + 10} style={{ fontSize: 8, fill: COLORS.muted } as any}>{it.value.toFixed(2)}</Text>
          </G>
        );
      })}
    </Svg>
  );
}

// ---- Documento ----
function RelatorioPDF({ snapshot, codigoRafp, codigoRev, codigoValidacao, cliente, dataEmissao }: any) {
  const av = snapshot?.avaliacao || {};
  const rev = snapshot?.revisao || {};
  const responsavel = rev.responsavel || {};
  const biblioteca = snapshot?.biblioteca || {};
  const fatores: any[] = Array.isArray(snapshot?.fatores) ? snapshot.fatores : [];
  const plano = snapshot?.plano || {};
  const itens: any[] = Array.isArray(plano?.itens) ? plano.itens : [];
  const modelo = `${MODELO_CODIGO} v${MODELO_VERSAO}`;

  const fatoresSig = fatores.filter((f) => f.significativo);
  const chartItems = fatoresSig.slice(0, 12).map((f) => ({
    label: f.fator_codigo,
    value: Number(f.prioridade) || 1,
    color: prioridadeColor(f.tratamento),
  }));

  return (
    <Document
      title={`Relatório ${codigoRafp} ${codigoRev}`}
      author="HSE Consulting"
      subject="Avaliação de Fatores Psicossociais"
      creator="Portal HSE"
      producer="Portal HSE"
    >
      {/* Capa */}
      <Page size="A4" style={s.page}>
        <PageChrome codigoRafp={codigoRafp} codigoRev={codigoRev} modelo={modelo} />
        <View style={s.coverBox}>
          <Text style={s.coverKicker}>RELATÓRIO TÉCNICO</Text>
          <Text style={s.coverTitle}>Avaliação de Fatores Psicossociais</Text>
          <Text style={s.coverSub}>{cliente?.nome || "—"}</Text>
        </View>
        <View style={{ marginTop: 40 }}>
          <KV k="Código do relatório" v={codigoRafp} />
          <KV k="Revisão" v={codigoRev} />
          <KV k="Avaliação vinculada" v={`${av.codigo || "—"} — ${av.titulo || ""}`} />
          <KV k="Período de coleta" v={`${fmtDate(av.periodo?.inicio)} a ${fmtDate(av.periodo?.fim)}`} />
          <KV k="Modelo" v={modelo} />
          <KV k="Metodologia" v={biblioteca?.codigo ? `${biblioteca.codigo} v${biblioteca.versao} — ${biblioteca.nome}` : "—"} />
          <KV k="Data de emissão" v={fmtDate(dataEmissao)} />
          <KV k="Código de validação" v={codigoValidacao} />
        </View>

        <View style={[s.seloBox]}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: COLORS.accent }}>
            APROVADO TECNICAMENTE
          </Text>
          <Text style={{ fontSize: 10, marginTop: 4 }}>
            {responsavel?.nome || "—"}
            {responsavel?.cargo ? ` — ${responsavel.cargo}` : ""}
          </Text>
          <Text style={s.muted}>
            Registro: {responsavel?.registro_profissional || "—"} · Aprovado em {fmtDateTime(rev?.aprovada_em)}
          </Text>
        </View>

        <Text style={[s.muted, { marginTop: 20 }]}>
          Este relatório apresenta a análise consolidada de fatores de risco psicossociais em nível
          organizacional, com base em respostas anônimas e agregadas. Não substitui parecer clínico
          individual nem constitui prontuário. A validade do documento pode ser conferida pelo
          código de validação acima.
        </Text>
      </Page>

      {/* Sumário / Contexto */}
      <Page size="A4" style={s.page}>
        <PageChrome codigoRafp={codigoRafp} codigoRev={codigoRev} modelo={modelo} />

        <Text style={s.h1}>1. Contexto e objetivo</Text>
        <Text style={s.p}>
          {rev?.contexto || "Contexto organizacional não informado."}
        </Text>

        <Text style={s.h2}>1.1 Escopo e amostra</Text>
        <View style={s.card}>
          <KV k="Avaliação" v={`${av.codigo || "—"} — ${av.titulo || ""}`} />
          <KV k="Período" v={`${fmtDate(av.periodo?.inicio)} a ${fmtDate(av.periodo?.fim)}`} />
          <KV k="Amostra reduzida" v={rev?.amostra_reduzida ? "Sim — leitura com cautela" : "Não"} />
        </View>

        <Text style={s.h2}>1.2 Metodologia</Text>
        <Text style={s.p}>
          Aplicou-se a metodologia <Text style={{ fontFamily: "Helvetica-Bold" }}>
          {biblioteca?.codigo ? `${biblioteca.codigo} v${biblioteca.versao}` : "HSE-PSICO"}</Text>
          {biblioteca?.nome ? ` — ${biblioteca.nome}` : ""}. Os resultados foram calculados de forma
          agregada, sem qualquer vínculo nominal, e revisados tecnicamente antes da emissão.
        </Text>

        <Text style={s.h2}>1.3 Limitações declaradas</Text>
        <Text style={s.p}>{rev?.limitacoes || "—"}</Text>
      </Page>

      {/* Resultados por fator */}
      <Page size="A4" style={s.page} wrap>
        <PageChrome codigoRafp={codigoRafp} codigoRev={codigoRev} modelo={modelo} />

        <Text style={s.h1}>2. Resultados por fator</Text>
        <Text style={s.p}>
          Fatores com prioridade calculada e tratamento técnico definido pela responsável na revisão.
          Fatores marcados como significativos são detalhados a seguir.
        </Text>

        {chartItems.length > 0 && (
          <>
            <Text style={s.h3}>Prioridade dos fatores significativos</Text>
            <View wrap={false}>
              <BarChart items={chartItems} />
            </View>
          </>
        )}

        <Text style={s.h3}>Tabela de fatores</Text>
        <View style={s.table}>
          <View style={s.thead} fixed>
            <Text style={[s.th, { width: "18%" }]}>Fator</Text>
            <Text style={[s.th, { width: "14%" }]}>Significativo</Text>
            <Text style={[s.th, { width: "14%" }]}>Prioridade</Text>
            <Text style={[s.th, { width: "54%" }]}>Tratamento técnico</Text>
          </View>
          {fatores.length === 0 && (
            <View style={s.tr}><Text style={[s.td, { width: "100%", color: COLORS.muted }]}>Sem fatores registrados.</Text></View>
          )}
          {fatores.map((f, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <Text style={[s.td, { width: "18%", fontFamily: "Helvetica-Bold" }]}>{f.fator_codigo}</Text>
              <Text style={[s.td, { width: "14%" }]}>{f.significativo ? "Sim" : "Não"}</Text>
              <Text style={[s.td, { width: "14%" }]}>{f.prioridade ?? "—"}</Text>
              <Text style={[s.td, { width: "54%" }]}>{f.tratamento || "—"}</Text>
            </View>
          ))}
        </View>

        {fatoresSig.length > 0 && (
          <>
            <Text style={s.h2}>2.1 Análise dos fatores significativos</Text>
            {fatoresSig.map((f, i) => (
              <View key={i} style={s.card} wrap={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{f.fator_codigo}</Text>
                  <Chip label={`Prioridade ${f.prioridade ?? "—"}`} color={prioridadeColor(f.tratamento)} />
                </View>
                {f.observacao && <Text style={s.p}>{f.observacao}</Text>}
                {f.justificativa && (
                  <>
                    <Text style={s.h3}>Justificativa</Text>
                    <Text style={s.p}>{f.justificativa}</Text>
                  </>
                )}
              </View>
            ))}
          </>
        )}
      </Page>

      {/* Conclusão e Plano */}
      <Page size="A4" style={s.page} wrap>
        <PageChrome codigoRafp={codigoRafp} codigoRev={codigoRev} modelo={modelo} />

        <Text style={s.h1}>3. Conclusão técnica</Text>
        <Text style={s.p}>{rev?.conclusao || "—"}</Text>

        {rev?.recomendacao_geral && (
          <>
            <Text style={s.h2}>3.1 Recomendação geral</Text>
            <Text style={s.p}>{rev.recomendacao_geral}</Text>
          </>
        )}

        <Text style={s.h1}>4. Plano de ação</Text>
        {itens.length === 0 ? (
          <Text style={s.muted}>Nenhum item de plano selecionado.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.thead} fixed>
              <Text style={[s.th, { width: "28%" }]}>Ação</Text>
              <Text style={[s.th, { width: "14%" }]}>Nível</Text>
              <Text style={[s.th, { width: "18%" }]}>Responsável</Text>
              <Text style={[s.th, { width: "10%" }]}>Prazo</Text>
              <Text style={[s.th, { width: "12%" }]}>Prioridade</Text>
              <Text style={[s.th, { width: "18%" }]}>Fatores</Text>
            </View>
            {itens.map((it, i) => (
              <View key={i} style={s.tr} wrap={false}>
                <View style={{ width: "28%", padding: 6 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{it.titulo}</Text>
                  {it.acao && <Text style={{ fontSize: 8, color: COLORS.muted }}>{it.acao}</Text>}
                </View>
                <Text style={[s.td, { width: "14%" }]}>{it.nivel || "—"}</Text>
                <Text style={[s.td, { width: "18%" }]}>{it.responsavel || "—"}</Text>
                <Text style={[s.td, { width: "10%" }]}>{it.prazo_dias ? `${it.prazo_dias} d` : "—"}</Text>
                <Text style={[s.td, { width: "12%" }]}>{it.prioridade || "—"}</Text>
                <Text style={[s.td, { width: "18%" }]}>
                  {Array.isArray(it.fatores) ? it.fatores.join(", ") : "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>5. Considerações finais</Text>
        <Text style={s.p}>
          Este relatório foi emitido pelo Portal HSE mediante aprovação técnica registrada. Sua
          integridade pode ser verificada por meio do código de validação constante da capa. O
          conteúdo apresentado é imutável a partir do momento da emissão.
        </Text>

        <View style={[s.seloBox, { marginTop: 20 }]}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: COLORS.accent }}>
            APROVAÇÃO TÉCNICA
          </Text>
          <Text style={{ fontSize: 10, marginTop: 4 }}>
            {responsavel?.nome || "—"}
            {responsavel?.cargo ? ` — ${responsavel.cargo}` : ""}
          </Text>
          <Text style={s.muted}>
            Registro profissional: {responsavel?.registro_profissional || "—"} · Aprovado em {fmtDateTime(rev?.aprovada_em)}
          </Text>
          <Text style={[s.muted, { marginTop: 6 }]}>
            Código de validação: <Text style={{ fontFamily: "Helvetica-Bold" }}>{codigoValidacao}</Text>
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ============================================================================
// HANDLER
// ============================================================================

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
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
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const avaliacaoId: string | undefined = body?.avaliacao_id;
  const confirmacao: string | undefined = body?.confirmacao;
  const descricaoRevisao: string | null = body?.descricao_revisao ?? null;

  if (!avaliacaoId || !confirmacao) {
    return new Response(JSON.stringify({ error: "campos_obrigatorios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    const avQ = await admin.from("psico_avaliacoes").select("cliente_id").eq("id", versaoQ.data.avaliacao_id).maybeSingle();
    let clienteNome = "—";
    if (avQ.data?.cliente_id) {
      const cli = await admin.from("clients").select("razao_social, nome_fantasia").eq("id", avQ.data.cliente_id).maybeSingle();
      clienteNome = cli.data?.nome_fantasia || cli.data?.razao_social || "—";
    }

    // 3) Renderizar PDF
    let pdfBuffer: Uint8Array;
    try {
      const nodeBuf = await renderToBuffer(
        <RelatorioPDF
          snapshot={snapshot}
          codigoRafp={codigoRafp}
          codigoRev={codigoRev}
          codigoValidacao={codigoValidacao}
          cliente={{ nome: clienteNome }}
          dataEmissao={new Date().toISOString()}
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