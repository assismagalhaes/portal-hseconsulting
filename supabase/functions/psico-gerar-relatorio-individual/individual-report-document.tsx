// deno-lint-ignore-file no-explicit-any no-import-prefix jsx-curly-braces
// @deno-types="npm:@types/react@18.3.3"
import React from "npm:react@18.3.1";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "npm:@react-pdf/renderer@3.4.5";
import { HSE_LOGO_GREEN_DATA_URL } from "../psico-gerar-relatorio/brand-assets.ts";

export const IND_MODEL_CODE = "HSE-PSICO-REL-IND-1.0";
export const IND_MODEL_VERSION = "1.0.0";

const C = {
  navy: "#0B2545", teal: "#159A85", green: "#27864A",
  amber: "#D99000", red: "#B42318",
  ink: "#172033", muted: "#667085", line: "#D9E2EC",
  panel: "#F4F7FA", paleTeal: "#EAF7F4", white: "#FFFFFF",
};
Font.registerHyphenationCallback((w) => [w]);

const FACTOR_LABELS: Record<string, string> = {
  carga_excessiva: "Carga excessiva de trabalho",
  falta_autonomia: "Falta de autonomia no trabalho",
  conflitos_hierarquicos: "Conflitos hierárquicos",
  relacoes_interpessoais: "Qualidade das relações interpessoais",
  conflitos_interpessoais: "Conflitos interpessoais",
  falta_clareza: "Falta de clareza nas expectativas e responsabilidades",
  gestao_mudancas: "Gestão de mudanças",
};
function fatorNome(codigo: string): string {
  return FACTOR_LABELS[codigo] || String(codigo || "").replace(/_/g, " ");
}

function classColor(nivel: string): string {
  const n = String(nivel || "").toLowerCase();
  if (n === "critico" || n === "crítico") return C.red;
  if (n === "alto") return C.amber;
  if (n === "moderado") return C.teal;
  return C.green;
}

const s = StyleSheet.create({
  page: { paddingTop: 62, paddingBottom: 50, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, lineHeight: 1.4, color: C.ink },
  cover: { padding: 0, backgroundColor: C.white },
  coverBand: { height: 220, backgroundColor: C.navy, paddingHorizontal: 48, paddingTop: 34 },
  coverLogo: { width: 116, height: 58, objectFit: "contain" },
  coverKicker: { marginTop: 43, fontSize: 9, color: "#7FE0CF", fontFamily: "Helvetica-Bold", letterSpacing: 1.8 },
  coverTitle: { marginTop: 8, width: 450, fontSize: 26, lineHeight: 1.1, color: C.white, fontFamily: "Helvetica-Bold" },
  coverBody: { paddingHorizontal: 48, paddingTop: 24 },
  metaLabel: { fontSize: 7.2, color: C.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.7 },
  metaValue: { marginTop: 3, fontSize: 10, color: C.ink },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  metaCell: { width: "50%", marginBottom: 12, paddingRight: 12 },
  h1: { fontSize: 18, color: C.navy, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h2: { fontSize: 12, color: C.navy, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 10, color: C.navy, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  kicker: { fontSize: 7.6, color: C.teal, fontFamily: "Helvetica-Bold", letterSpacing: 1.3, marginBottom: 4 },
  intro: { fontSize: 9, color: C.muted, marginBottom: 12 },
  p: { marginBottom: 6, textAlign: "justify" },
  panel: { padding: 12, borderRadius: 6, backgroundColor: C.panel, marginBottom: 10 },
  panelTeal: { padding: 12, borderRadius: 6, backgroundColor: C.paleTeal, borderLeftWidth: 3, borderLeftColor: C.teal, marginBottom: 10 },
  findingCard: { padding: 10, borderRadius: 6, borderLeftWidth: 4, backgroundColor: C.panel, marginBottom: 8 },
  findingTitle: { fontSize: 10.5, color: C.navy, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  badge: { fontSize: 7.5, color: C.white, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  row: { flexDirection: "row" },
  planItem: { padding: 10, borderRadius: 6, backgroundColor: C.panel, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: C.teal },
  header: { position: "absolute", top: 22, left: 40, right: 40, height: 30, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line },
  headerLogo: { width: 58, height: 24, objectFit: "contain" },
  headerMeta: { color: C.muted, fontSize: 7.2, textAlign: "right" },
  footer: { position: "absolute", bottom: 18, left: 40, right: 40, height: 20, flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, color: C.muted, fontSize: 6.8 },
  watermark: { position: "absolute", top: "44%", left: 55, right: 55, color: C.red, opacity: 0.12, fontSize: 36, fontFamily: "Helvetica-Bold", textAlign: "center", transform: "rotate(-34deg)" },
  signBox: { marginTop: 18, padding: 14, borderRadius: 6, borderWidth: 1, borderColor: C.line },
  signImg: { width: 180, height: 60, objectFit: "contain", marginBottom: 6 },
});

function PageChrome(props: { codigo: string; rev: string; total?: number; preview?: boolean }) {
  return (
    <>
      <View style={s.header} fixed>
        <Image src={HSE_LOGO_GREEN_DATA_URL} style={s.headerLogo} />
        <Text style={s.headerMeta}>{props.codigo} • {props.rev}{"\n"}Relatório de Avaliação de Fatores Psicossociais — Individual</Text>
      </View>
      {props.preview ? <Text style={s.watermark} fixed>PRÉVIA — SEM VALIDADE</Text> : null}
      <View style={s.footer} fixed>
        <Text style={{ width: "50%" }}>HSE Consulting • CNPJ 46.208.297/0001-51</Text>
        <Text style={{ width: "50%", textAlign: "right" }} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </>
  );
}

export function IndividualReportDocument(props: {
  snapshot: any;
  codigo: string;
  codigoRev: string;
  codigoValidacao: string;
  cliente: any;
  dataEmissao: string;
  qrDataUrl?: string;
  assinaturaDataUrl?: string;
  preview?: boolean;
}) {
  const { snapshot, codigo, codigoRev, codigoValidacao, cliente, dataEmissao, qrDataUrl, assinaturaDataUrl, preview } = props;
  const av = snapshot?.avaliacao || {};
  const proc = snapshot?.processamento || {};
  const achados: any[] = Array.isArray(snapshot?.achados) ? snapshot.achados : [];
  const plano: any[] = Array.isArray(snapshot?.plano) ? snapshot.plano : [];
  const revisao = snapshot?.revisao || {};
  const parecer = revisao?.parecer || {};
  const resp = revisao?.responsavel || {};

  const prioritarios = achados.filter((a) => a.estado_final === "prioritario");
  const criticos = achados.filter((a) => String(a.nivel_evidencia).toLowerCase().includes("critic"));
  const divergentes = achados.filter((a) => a.estado_convergencia === "divergente");
  const dataFmt = new Date(dataEmissao).toLocaleDateString("pt-BR");

  return (
    <Document title={`Relatório Individual ${codigo}`} author="HSE Consulting" subject="Avaliação Assistida Individual - Fatores Psicossociais">
      {/* Capa */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverBand}>
          <Image src={HSE_LOGO_GREEN_DATA_URL} style={s.coverLogo} />
          <Text style={s.coverKicker}>HSE • AVALIAÇÃO ASSISTIDA INDIVIDUAL</Text>
          <Text style={s.coverTitle}>Relatório de Avaliação de Fatores Psicossociais Relacionados ao Trabalho — Modalidade Individual (Microempresa)</Text>
        </View>
        <View style={s.coverBody}>
          <Text style={s.metaLabel}>Empresa</Text>
          <Text style={{ marginTop: 4, fontSize: 18, color: C.navy, fontFamily: "Helvetica-Bold" }}>
            {cliente?.nome_fantasia || cliente?.razao_social || cliente?.nome || "—"}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 9, color: C.muted }}>
            {cliente?.cnpj_cpf ? `CNPJ/CPF: ${cliente.cnpj_cpf}` : ""}
            {cliente?.cidade ? `  •  ${cliente.cidade}${cliente.uf ? "/" + cliente.uf : ""}` : ""}
          </Text>

          <View style={s.metaGrid}>
            <View style={s.metaCell}><Text style={s.metaLabel}>Código</Text><Text style={s.metaValue}>{codigo}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Revisão</Text><Text style={s.metaValue}>{codigoRev}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Modalidade</Text><Text style={s.metaValue}>Individual (empregado + empregador)</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Motor de conciliação</Text><Text style={s.metaValue}>{proc?.engine_versao || "—"}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Data de emissão</Text><Text style={s.metaValue}>{dataFmt}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Código de validação</Text><Text style={s.metaValue}>{codigoValidacao}</Text></View>
          </View>

          {qrDataUrl ? (
            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center" }}>
              <Image src={qrDataUrl} style={{ width: 70, height: 70 }} />
              <Text style={{ marginLeft: 12, fontSize: 8, color: C.muted, maxWidth: 380 }}>
                Escaneie o QR Code ou acesse portal.hseconsulting.com.br/validar/relatorio-psicossocial para validar a autenticidade deste documento.
              </Text>
            </View>
          ) : null}
          {preview ? <Text style={{ marginTop: 20, color: C.red, fontFamily: "Helvetica-Bold" }}>DOCUMENTO EM PRÉVIA — SEM VALIDADE PARA REGISTRO</Text> : null}
        </View>
      </Page>

      {/* Metodologia */}
      <Page size="A4" style={s.page}>
        <PageChrome codigo={codigo} rev={codigoRev} preview={preview} />
        <Text style={s.kicker}>SEÇÃO 1</Text>
        <Text style={s.h1}>Metodologia da avaliação individual</Text>
        <Text style={s.intro}>Esta avaliação segue a modalidade individual assistida, aplicável a microempresas quando a coleta coletiva agregada não é viável (n insuficiente). Consiste na aplicação simultânea de dois questionários independentes — um respondido pelo(a) empregado(a) e outro pelo(a) empregador(a) — sobre os mesmos fatores psicossociais, com posterior conciliação técnica determinística.</Text>

        <View style={s.panelTeal}>
          <Text style={s.h3}>Instrumentos aplicados</Text>
          <Text style={s.p}>• AQI-EMPREGADO v1.0 — questionário assistido para o(a) empregado(a).</Text>
          <Text style={s.p}>• AQI-EMPREGADOR v1.0 — questionário assistido para o(a) empregador(a).</Text>
          <Text style={s.p}>Ambos com escalas equivalentes e mapeamento direto para os fatores da NR-01.</Text>
        </View>

        <Text style={s.h2}>Motor de conciliação</Text>
        <Text style={s.p}>Motor determinístico {proc?.engine_versao || "HSE-PSICO-IND-ENGINE-1.0"}. Regras: a maior exposição percebida prevalece; divergência forte gera revisão obrigatória; achados com evidência crítica são elevados a prioritários automaticamente.</Text>

        <Text style={s.h2}>Limitações metodológicas</Text>
        <Text style={s.p}>Amostra de dois respondentes (n=2), inviabilizando tratamento estatístico coletivo. Resultados devem ser lidos como indicadores qualitativos, sujeitos a verificação no trabalho real e a reavaliação periódica no ciclo do PGR.</Text>
      </Page>

      {/* Panorama */}
      <Page size="A4" style={s.page}>
        <PageChrome codigo={codigo} rev={codigoRev} preview={preview} />
        <Text style={s.kicker}>SEÇÃO 2</Text>
        <Text style={s.h1}>Panorama do caso</Text>
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          <View style={{ ...s.panel, flex: 1, marginRight: 8 }}>
            <Text style={s.metaLabel}>Total de achados</Text>
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: C.navy }}>{achados.length}</Text>
          </View>
          <View style={{ ...s.panel, flex: 1, marginRight: 8, backgroundColor: "#FDECEC" }}>
            <Text style={s.metaLabel}>Prioritários</Text>
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: C.red }}>{prioritarios.length}</Text>
          </View>
          <View style={{ ...s.panel, flex: 1, marginRight: 8, backgroundColor: "#FFF6DB" }}>
            <Text style={s.metaLabel}>Críticos</Text>
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: C.amber }}>{criticos.length}</Text>
          </View>
          <View style={{ ...s.panel, flex: 1 }}>
            <Text style={s.metaLabel}>Divergentes</Text>
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: C.teal }}>{divergentes.length}</Text>
          </View>
        </View>

        <Text style={s.h2}>Parecer — síntese do caso</Text>
        <Text style={s.p}>{parecer.sintese_caso || "—"}</Text>

        <Text style={s.h2}>Interpretação — convergências e divergências</Text>
        <Text style={s.p}>{parecer.interpretacao_convergencia || "—"}</Text>
      </Page>

      {/* Achados */}
      <Page size="A4" style={s.page}>
        <PageChrome codigo={codigo} rev={codigoRev} preview={preview} />
        <Text style={s.kicker}>SEÇÃO 3</Text>
        <Text style={s.h1}>Achados por fator</Text>
        <Text style={s.intro}>Cada achado apresenta o resultado conciliado, a evidência classificada e, quando aplicável, a decisão técnica adotada em caso de divergência entre as percepções.</Text>

        {achados.length === 0 ? (
          <Text style={s.p}>Nenhum achado registrado.</Text>
        ) : achados.map((a: any, i: number) => (
          <View key={i} style={{ ...s.findingCard, borderLeftColor: classColor(a.nivel_evidencia) }} wrap={false}>
            <View style={{ ...s.row, justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={s.findingTitle}>{fatorNome(a.fator_codigo)}</Text>
              <Text style={{ ...s.badge, backgroundColor: classColor(a.nivel_evidencia) }}>
                {String(a.nivel_evidencia || "—").toUpperCase()}
              </Text>
            </View>
            <Text style={{ fontSize: 8, color: C.muted, marginBottom: 4 }}>
              Convergência: {a.estado_convergencia || "—"} • Estado final: {a.estado_final || "—"} • Necessita ação: {a.necessita_acao ? "sim" : "não"}
            </Text>
            {a.fundamentacao_sanitizada ? <Text style={{ ...s.p, fontSize: 8.5 }}>{a.fundamentacao_sanitizada}</Text> : null}
            {a.justificativa_alteracao ? (
              <Text style={{ fontSize: 8, color: C.navy, fontFamily: "Helvetica-Bold", marginTop: 3 }}>
                Decisão técnica: <Text style={{ fontFamily: "Helvetica", color: C.ink }}>{a.justificativa_alteracao}</Text>
              </Text>
            ) : null}
          </View>
        ))}
      </Page>

      {/* Plano de ação */}
      <Page size="A4" style={s.page}>
        <PageChrome codigo={codigo} rev={codigoRev} preview={preview} />
        <Text style={s.kicker}>SEÇÃO 4</Text>
        <Text style={s.h1}>Plano de ação aprovado</Text>
        <Text style={s.intro}>Ações organizacionais consolidadas e congeladas para este ciclo. A implementação e verificação de eficácia competem à empresa, conforme a NR-01.</Text>

        {plano.length === 0 ? (
          <Text style={s.p}>Nenhum item aprovado no plano.</Text>
        ) : plano.map((it: any, i: number) => (
          <View key={i} style={s.planItem} wrap={false}>
            <Text style={s.h3}>{i + 1}. {it.titulo || it.acao || "Ação"} — {fatorNome(it.fator_codigo)}</Text>
            {it.objetivo ? <Text style={{ ...s.p, fontSize: 8.5 }}>Objetivo: {it.objetivo}</Text> : null}
            {it.acao ? <Text style={{ ...s.p, fontSize: 8.5 }}>Ação: {it.acao}</Text> : null}
            <View style={{ flexDirection: "row", marginTop: 3 }}>
              <Text style={{ fontSize: 8, color: C.muted, marginRight: 12 }}>Responsável: {it.responsavel || "a definir"}</Text>
              <Text style={{ fontSize: 8, color: C.muted, marginRight: 12 }}>Prazo: {it.prazo || "a definir"}</Text>
            </View>
            {it.evidencia ? <Text style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>Evidência esperada: {it.evidencia}</Text> : null}
            {it.indicador ? <Text style={{ fontSize: 8, color: C.muted }}>Indicador de eficácia: {it.indicador}</Text> : null}
            {it.origem === "ia" ? <Text style={{ fontSize: 7, color: C.teal, marginTop: 3 }}>Origem: sugestão de IA revisada por técnico</Text> : null}
          </View>
        ))}
      </Page>

      {/* Parecer conclusivo */}
      <Page size="A4" style={s.page}>
        <PageChrome codigo={codigo} rev={codigoRev} preview={preview} />
        <Text style={s.kicker}>SEÇÃO 5</Text>
        <Text style={s.h1}>Parecer técnico conclusivo</Text>

        <Text style={s.h2}>Prioridades de intervenção</Text>
        <Text style={s.p}>{parecer.prioridades || "—"}</Text>

        <Text style={s.h2}>Recomendações organizacionais</Text>
        <Text style={s.p}>{parecer.recomendacoes_organizacionais || "—"}</Text>

        <Text style={s.h2}>Limitações</Text>
        <Text style={s.p}>{parecer.limitacoes || "—"}</Text>

        <Text style={s.h2}>Conclusão</Text>
        <Text style={s.p}>{parecer.conclusao || "—"}</Text>

        <Text style={{ fontSize: 7, color: C.muted, marginTop: 10 }}>
          Parecer gerado com apoio de {revisao?.prompt_codigo || "—"} / modelo {revisao?.modelo_ia || "—"} (versão {revisao?.parecer_versao || 0}) e revisado por profissional habilitado antes da emissão.
        </Text>
      </Page>

      {/* Responsabilidade técnica */}
      <Page size="A4" style={s.page}>
        <PageChrome codigo={codigo} rev={codigoRev} preview={preview} />
        <Text style={s.kicker}>SEÇÃO 6</Text>
        <Text style={s.h1}>Responsabilidade técnica e validação</Text>
        <Text style={s.intro}>Este relatório é assinado eletronicamente pelo profissional responsável e possui código de validação verificável no portal HSE.</Text>

        <View style={s.signBox}>
          {assinaturaDataUrl ? <Image src={assinaturaDataUrl} style={s.signImg} /> : (
            <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 6 }} />
          )}
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: C.navy }}>{resp?.nome_responsavel || "—"}</Text>
          {resp?.cargo ? <Text style={{ fontSize: 9, color: C.ink }}>{resp.cargo}</Text> : null}
          {resp?.registro_profissional ? <Text style={{ fontSize: 9, color: C.ink }}>Registro: {resp.registro_profissional}</Text> : null}
          <Text style={{ fontSize: 8, color: C.muted, marginTop: 6 }}>Aprovação da revisão: {revisao?.aprovado_em ? new Date(revisao.aprovado_em).toLocaleString("pt-BR") : "—"}</Text>
          {resp?.assinatura_hash_sha256 ? (
            <Text style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>Hash assinatura: {String(resp.assinatura_hash_sha256).slice(0, 32)}…</Text>
          ) : null}
        </View>

        <View style={{ ...s.panel, marginTop: 20 }}>
          <Text style={s.h3}>Autenticidade</Text>
          <Text style={{ ...s.p, fontSize: 8.5 }}>
            Código de validação: {codigoValidacao}. Consulte em portal.hseconsulting.com.br/validar/relatorio-psicossocial informando o código para confirmar autenticidade, versão vigente e status (emitido, revogado ou substituído).
          </Text>
        </View>

        <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 20 }}>
          Documento produzido em conformidade com a NR-01. Este relatório NÃO constitui diagnóstico clínico. A implementação das ações e a verificação da eficácia competem à empresa contratante, salvo escopo específico contratado.
        </Text>
      </Page>
    </Document>
  );
}