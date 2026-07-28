// deno-lint-ignore-file no-explicit-any no-import-prefix jsx-curly-braces
// @deno-types="npm:@types/react@18.3.3"
import React from "npm:react@18.3.1";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "npm:@react-pdf/renderer@3.4.5";
import { HSE_LOGO_GREEN_DATA_URL } from "./brand-assets.ts";

export const REPORT_MODEL_CODE = "HSE-PSICO-REL-1.0";
export const REPORT_MODEL_VERSION = "1.6.0";

export const REPORT_COLORS = {
  navy: "#0B2545", blue: "#176B87", teal: "#159A85", green: "#27864A",
  lime: "#86C89A", amber: "#D99000", orange: "#C55A11", red: "#B42318",
  ink: "#172033", muted: "#667085", line: "#D9E2EC", panel: "#F4F7FA",
  paleBlue: "#EAF2F8", paleGreen: "#EAF7EF", paleAmber: "#FFF6DB",
  paleRed: "#FDECEC", white: "#FFFFFF",
};

Font.registerHyphenationCallback((word) => [word]);

const FACTOR_LABELS: Record<string, string> = {
  carga_excessiva: "Carga excessiva de trabalho",
  falta_autonomia: "Falta de autonomia no trabalho",
  conflitos_hierarquicos: "Conflitos hierárquicos",
  relacoes_interpessoais: "Qualidade das relações interpessoais",
  conflitos_interpessoais: "Conflitos interpessoais",
  falta_clareza: "Falta de clareza nas expectativas e responsabilidades",
  gestao_mudancas: "Gestão de mudanças",
};

const FACTOR_DIRECTION: Record<string, string> = {
  carga_excessiva: "Rever volume de trabalho, ritmo, distribuição de tarefas, pausas e recursos disponíveis, comparando os números com o dia a dia real das equipes.",
  falta_autonomia: "Ampliar a margem de decisão das equipes, envolver o time no planejamento e deixar claros os limites de autonomia de cada função.",
  conflitos_hierarquicos: "Rever práticas de liderança, forma de cobrança, canais para levar problemas adiante e o respeito nas relações de chefia.",
  relacoes_interpessoais: "Fortalecer cooperação, apoio entre colegas, comunicação clara e condições para resolver bem as dificuldades do dia a dia.",
  conflitos_interpessoais: "Organizar a prevenção e o tratamento de conflitos, com canais seguros, critérios conhecidos e resposta firme e consistente.",
  falta_clareza: "Deixar claros papéis, responsabilidades, prioridades e critérios de desempenho, reduzindo dúvidas e retrabalho.",
  gestao_mudancas: "Planejar comunicação, participação e apoio às equipes durante mudanças na organização (novos processos, sistemas, estruturas).",
};

const styles = StyleSheet.create({
  page: { paddingTop: 70, paddingBottom: 54, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 8.7, lineHeight: 1.38, color: REPORT_COLORS.ink, backgroundColor: REPORT_COLORS.white },
  cover: { padding: 0, backgroundColor: REPORT_COLORS.white },
  coverBand: { height: 228, backgroundColor: REPORT_COLORS.navy, paddingHorizontal: 48, paddingTop: 34, overflow: "hidden" },
  coverShapeOne: { position: "absolute", width: 220, height: 220, backgroundColor: REPORT_COLORS.teal, opacity: 0.15, top: -110, right: -40, transform: "rotate(35deg)" },
  coverShapeTwo: { position: "absolute", width: 150, height: 150, backgroundColor: REPORT_COLORS.teal, opacity: 0.1, bottom: -100, left: -30, transform: "rotate(35deg)" },
  coverLogo: { width: 116, height: 58, objectFit: "contain" },
  coverKicker: { marginTop: 43, fontSize: 9, color: "#7FE0CF", fontFamily: "Helvetica-Bold", letterSpacing: 1.8 },
  coverTitle: { marginTop: 8, width: 450, fontSize: 29, lineHeight: 1.08, color: REPORT_COLORS.white, fontFamily: "Helvetica-Bold" },
  coverBody: { paddingHorizontal: 48, paddingTop: 25 },
  clientLabel: { color: REPORT_COLORS.muted, fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  clientName: { marginTop: 4, maxWidth: 490, fontSize: 19, lineHeight: 1.1, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold" },
  organizationCard: { marginTop: 10, padding: 11, borderRadius: 6, backgroundColor: REPORT_COLORS.panel, borderLeftWidth: 3, borderLeftColor: REPORT_COLORS.teal },
  organizationLine: { marginBottom: 3, fontSize: 8.7 },
  coverMetaGrid: { marginTop: 20, flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, paddingTop: 14 },
  coverMeta: { width: "50%", marginBottom: 13, paddingRight: 16 },
  metaLabel: { fontSize: 7.2, color: REPORT_COLORS.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.7 },
  metaValue: { marginTop: 3, fontSize: 9.8, color: REPORT_COLORS.ink },
  approval: { marginTop: 6, padding: 12, borderRadius: 6, backgroundColor: REPORT_COLORS.paleGreen, flexDirection: "row", alignItems: "center" },
  approvalDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: REPORT_COLORS.green, alignItems: "center", justifyContent: "center" },
  approvalDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: REPORT_COLORS.white },
  approvalText: { flex: 1, marginLeft: 10 },
  qr: { width: 60, height: 60, marginLeft: 12 },
  header: { position: "absolute", top: 19, left: 40, right: 40, height: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.line },
  headerIdentity: { maxWidth: "68%", flexDirection: "row", alignItems: "center" },
  headerClientLogo: { width: 52, height: 27, objectFit: "contain", marginRight: 8 },
  headerClientMark: { width: 27, height: 27, borderRadius: 4, backgroundColor: REPORT_COLORS.paleGreen, color: REPORT_COLORS.green, fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "center", paddingTop: 8, marginRight: 8 },
  headerClientName: { maxWidth: 300, color: REPORT_COLORS.navy, fontSize: 7.8, fontFamily: "Helvetica-Bold" },
  headerMeta: { color: REPORT_COLORS.muted, fontSize: 7.2, textAlign: "right" },
  footer: { position: "absolute", bottom: 18, left: 40, right: 40, height: 20, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, paddingTop: 6, color: REPORT_COLORS.muted, fontSize: 6.8 },
  footerLogo: { width: 39, height: 14, objectFit: "contain" },
  footerLeft: { width: "40%" }, footerCenter: { width: "30%", textAlign: "center" }, footerRight: { width: "30%", textAlign: "right" },
  watermark: { position: "absolute", top: "44%", left: 55, right: 55, color: REPORT_COLORS.red, opacity: 0.12, fontSize: 36, fontFamily: "Helvetica-Bold", textAlign: "center", transform: "rotate(-34deg)" },
  kicker: { fontSize: 7.6, color: REPORT_COLORS.teal, fontFamily: "Helvetica-Bold", letterSpacing: 1.3, marginBottom: 4 },
  h1: { fontSize: 19, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", lineHeight: 1.15, marginBottom: 6 },
  h2: { fontSize: 11.5, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", marginTop: 13, marginBottom: 6 },
  h3: { fontSize: 9.4, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  intro: { fontSize: 9, color: REPORT_COLORS.muted, marginBottom: 13, maxWidth: 490 },
  note: { fontSize: 7.7, color: REPORT_COLORS.muted, lineHeight: 1.35 },
  decisionPanel: { padding: 15, borderRadius: 7, backgroundColor: REPORT_COLORS.panel, borderLeftWidth: 5, marginBottom: 13 },
  decisionLabel: { fontSize: 7.3, color: REPORT_COLORS.muted, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  decisionTitle: { marginTop: 5, fontSize: 15, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", lineHeight: 1.12 },
  decisionText: { marginTop: 7, fontSize: 9.2 },
  secondaryIndex: { marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, fontSize: 7.7, color: REPORT_COLORS.muted },
  row: { flexDirection: "row" },
  kpi: { flex: 1, minHeight: 74, padding: 10, backgroundColor: REPORT_COLORS.white, borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 6, marginRight: 8 },
  kpiLast: { marginRight: 0 }, kpiValue: { fontSize: 16, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold" },
  kpiLabel: { marginTop: 5, fontSize: 7, color: REPORT_COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiHint: { marginTop: 4, fontSize: 6.8, color: REPORT_COLORS.muted },
  timelineItem: { flexDirection: "row", marginBottom: 7, padding: 9, borderRadius: 5, backgroundColor: REPORT_COLORS.panel },
  timelineWhen: { width: 78, fontFamily: "Helvetica-Bold", color: REPORT_COLORS.teal },
  timelineBody: { flex: 1 }, timelineTitle: { fontFamily: "Helvetica-Bold", color: REPORT_COLORS.navy },
  infoPanel: { padding: 10, borderRadius: 5, backgroundColor: REPORT_COLORS.paleBlue, borderLeftWidth: 3, borderLeftColor: REPORT_COLORS.blue },
  chartAxis: { marginTop: 6, marginLeft: 150, marginRight: 88, flexDirection: "row", justifyContent: "space-between" },
  axisText: { fontSize: 6.2, color: REPORT_COLORS.muted },
  chartRow: { flexDirection: "row", alignItems: "center", minHeight: 38, borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.line },
  chartLabel: { width: 145, paddingRight: 8, fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  chartArea: { flex: 1, height: 18, position: "relative", backgroundColor: REPORT_COLORS.panel, flexDirection: "row", borderRadius: 9, overflow: "hidden" },
  chartBand: { width: "20%", height: 18, borderRightWidth: 0.5, borderRightColor: REPORT_COLORS.white },
  chartBar: { position: "absolute", left: 0, top: 4, height: 10, borderRadius: 5 },
  chartScore: { width: 40, marginLeft: 7, fontSize: 8.3, fontFamily: "Helvetica-Bold", textAlign: "right" },
  chartClass: { width: 76, marginLeft: 5, fontSize: 6.4, lineHeight: 1.25, textAlign: "right" },
  table: { borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 4, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: REPORT_COLORS.navy, color: REPORT_COLORS.white, fontFamily: "Helvetica-Bold", fontSize: 6.5, paddingVertical: 5 },
  tableRow: { flexDirection: "row", minHeight: 23, alignItems: "center", borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, paddingVertical: 4 },
  cellFactor: { width: "31%", paddingHorizontal: 5 }, cellScore: { width: "9%", paddingHorizontal: 3, textAlign: "center" },
  cellMetric: { width: "10%", paddingHorizontal: 2, textAlign: "center" }, cellSig: { width: "13%", paddingHorizontal: 2, textAlign: "center" },
  cellPriority: { width: "17%", paddingHorizontal: 3, textAlign: "center" },
  factorCard: { marginBottom: 9, padding: 10, borderWidth: 1, borderColor: REPORT_COLORS.line, borderTopWidth: 3, borderRadius: 5 },
  factorHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  factorName: { flex: 1, paddingRight: 8, fontSize: 10.5, fontFamily: "Helvetica-Bold", color: REPORT_COLORS.navy },
  pill: { color: REPORT_COLORS.white, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 6.8, fontFamily: "Helvetica-Bold" },
  metricRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 5 },
  metric: { marginRight: 12, fontSize: 7.3, color: REPORT_COLORS.muted }, metricValue: { color: REPORT_COLORS.ink, fontFamily: "Helvetica-Bold" },
  questionAttention: { marginTop: 4, padding: 6, backgroundColor: REPORT_COLORS.panel, borderRadius: 4 },
  questionSignal: { marginTop: 3, paddingTop: 4, borderTopWidth: 1, borderTopColor: REPORT_COLORS.line },
  questionSignalTitle: { fontSize: 7.5, color: REPORT_COLORS.ink, fontFamily: "Helvetica-Bold" },
  attentionPill: { marginTop: 2, alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, fontSize: 6.4, color: REPORT_COLORS.white, fontFamily: "Helvetica-Bold" },
  compactFactorCard: { marginBottom: 8, padding: 9, borderWidth: 1, borderColor: REPORT_COLORS.line, borderLeftWidth: 3, borderRadius: 5 },
  compactFactorTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  compactFactorSummary: { fontSize: 7.8, color: REPORT_COLORS.muted },
  questionGroup: { marginBottom: 13 },
  questionHeader: { padding: 7, backgroundColor: REPORT_COLORS.paleBlue, borderLeftWidth: 3, borderLeftColor: REPORT_COLORS.blue },
  questionTitle: { fontSize: 9.2, fontFamily: "Helvetica-Bold", color: REPORT_COLORS.navy },
  qNo: { width: "7%", textAlign: "center" }, qText: { width: "45%", paddingHorizontal: 4 }, qScore: { width: "9%", textAlign: "center" },
  qClass: { width: "13%", textAlign: "center" }, qPct: { width: "8.67%", textAlign: "center" },
  actionCard: { marginBottom: 10, borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 6, overflow: "hidden" },
  actionHeader: { padding: 8, backgroundColor: REPORT_COLORS.navy, color: REPORT_COLORS.white, flexDirection: "row", alignItems: "center" },
  actionNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: REPORT_COLORS.teal, textAlign: "center", paddingTop: 5, fontFamily: "Helvetica-Bold" },
  actionTitle: { flex: 1, marginLeft: 8, fontSize: 10, fontFamily: "Helvetica-Bold" },
  actionBody: { padding: 9 }, actionLabel: { fontSize: 6.7, color: REPORT_COLORS.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 2 },
  actionValue: { fontSize: 8.1, marginBottom: 6 }, actionGrid: { flexDirection: "row", flexWrap: "wrap" }, actionField: { width: "50%", paddingRight: 9 },
  bullet: { flexDirection: "row", marginBottom: 3 }, bulletMark: { width: 10, color: REPORT_COLORS.teal, fontFamily: "Helvetica-Bold" }, bulletText: { flex: 1 },
  opinionSection: { marginBottom: 7, padding: 8, borderRadius: 4, backgroundColor: REPORT_COLORS.panel },
  methodFlow: { flexDirection: "row", marginBottom: 12 }, methodStep: { flex: 1, padding: 8, backgroundColor: REPORT_COLORS.panel, marginRight: 6, borderRadius: 4 },
  methodNo: { width: 18, height: 18, borderRadius: 9, backgroundColor: REPORT_COLORS.teal, color: REPORT_COLORS.white, textAlign: "center", paddingTop: 3, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  methodTitle: { fontSize: 7.8, fontFamily: "Helvetica-Bold", color: REPORT_COLORS.navy, marginBottom: 3 }, methodText: { fontSize: 6.9, color: REPORT_COLORS.muted },
  criteriaRow: { flexDirection: "row", marginBottom: 12 }, criteriaCard: { flex: 1, padding: 9, backgroundColor: REPORT_COLORS.paleAmber, marginRight: 7, borderRadius: 4 },
  criteriaValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: REPORT_COLORS.orange }, criteriaText: { marginTop: 3, fontSize: 6.8 },
  traceRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.line, paddingVertical: 5 }, traceKey: { width: "35%", color: REPORT_COLORS.muted }, traceValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  signatureBox: { marginTop: 14, minHeight: 122, padding: 12, borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 6, alignItems: "center" },
  signatureImage: { width: 128, height: 57, objectFit: "contain", marginBottom: -3 }, signatureBlank: { height: 65 }, signatureLine: { width: 230, borderTopWidth: 1, borderTopColor: REPORT_COLORS.ink },
  contactText: { fontSize: 7.2, textAlign: "center" },
});

function clean(value: unknown, fallback = ""): string {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text && text.toLowerCase() !== "não aplicável" && text !== "-" ? text : fallback;
}
function usable(value: unknown) { return clean(value).length > 0; }
function date(value: unknown) { if (!value) return ""; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? clean(value) : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d); }
function dateTime(value: unknown) { if (!value) return ""; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? clean(value) : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(d); }
function formatCnpj(value: unknown) { const d = clean(value).replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : clean(value); }
function organizationAddress(c: any) { return [c?.endereco, c?.numero, c?.complemento, c?.bairro, [c?.cidade, c?.uf].filter(usable).join(" / "), c?.cep].map((x) => clean(x)).filter(Boolean).join(", ").replace(/,\s*,/g, ", "); }
function factorName(f: any) { return clean(f?.fator_nome || FACTOR_LABELS[f?.fator_codigo] || f?.nome || f?.fator_codigo, "Fator avaliado"); }
function priorityRank(value: unknown) { const v = clean(value).toLowerCase(); return v.startsWith("crit") || v.includes("crít") ? 4 : v.includes("alt") ? 3 : v.startsWith("med") || v.includes("méd") ? 2 : 1; }
function riskLabel(value: unknown, fallback = "Monitoramento") { const v = clean(value).toLowerCase(); return v.startsWith("crit") || v.includes("crít") ? "Crítico" : v.includes("alt") ? "Alto" : v.startsWith("med") || v.includes("méd") ? "Médio" : v.includes("baix") ? "Baixo" : v.includes("irrel") ? "Favorável" : fallback; }
function riskColor(value: unknown) { const rank = priorityRank(value); return rank === 4 ? REPORT_COLORS.red : rank === 3 ? REPORT_COLORS.orange : rank === 2 ? REPORT_COLORS.amber : REPORT_COLORS.green; }
function deadlineFor(value: unknown) { const rank = priorityRank(value); return rank === 4 ? 30 : rank === 3 ? 60 : rank === 2 ? 90 : 180; }
function pct(value: unknown) { const n = Number(value); return Number.isFinite(n) ? `${n.toFixed(1)}%` : "-"; }
function score(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(2) : "-"; }
function fixTypos(input: unknown): string {
  const s = clean(input);
  if (!s) return s;
  return s
    .replace(/\blidernaça\b/gi, "liderança")
    .replace(/\blideranca\b/gi, "liderança")
    .replace(/\bdiso\b/gi, "sido")
    .replace(/\biteressante\b/gi, "interessante")
    .replace(/\bsiginificante\b/gi, "significativo")
    .replace(/\bReduç[aã]o de e (\d)/gi, "Redução de $1")
    .replace(/\bde e (\d+\s*%)/gi, "de $1")
    .replace(/≥\s*(\d)/g, "no mínimo $1")
    .replace(/≤\s*(\d)/g, "até $1")
    .replace(/[≥≤]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function editorialText(input: unknown, fallback = "") {
  return fixTypos(clean(input, fallback))
    .replace(
      /apesar do fator ter sido não significativo e baixa exposição,?\s*é interessante recomendar um monitoramento preventivo,?\s*ao invés de deixar sem ação\.?/gi,
      "Embora o fator não tenha ultrapassado os limites de ação, recomenda-se acompanhamento preventivo para preservar as condições atuais e identificar mudanças.",
    )
    .replace(
      /fator não significativo e faixa favorável\.?/gi,
      "O fator permaneceu dentro dos limites de ação no período.",
    )
    .replace(
      /(?:o fator )?não foi significativo\.?/gi,
      "O fator permaneceu dentro dos limites de ação no período.",
    )
    .replace(
      /o fator não atingiu critério de significância no período analisado;?\s*recomenda-se manter acompanhamento preventivo\.?/gi,
      "O fator permaneceu dentro dos limites de ação no período; recomenda-se preservar as condições favoráveis e acompanhar mudanças.",
    )
    .replace(/cenário de baixo risco psicossocial predominante/gi, "cenário predominantemente favorável quanto à exposição aos fatores psicossociais")
    .replace(/riscos predominantemente irrelevantes/gi, "fatores predominantemente em faixas favoráveis")
    .replace(/risco irrelevante/gi, "faixa favorável")
    .replace(/Risco Irrelevante/g, "Faixa favorável")
    .replace(/risco baixo/gi, "baixa exposição")
    .replace(/Risco Baixo/g, "Baixa exposição")
    .replace(/o risco seja baixo/gi, "a exposição esteja em faixa baixa")
    .replace(/níveis de risco moderado ou alto/gi, "faixas de atenção moderada ou alta")
    .replace(/significância estatística/gi, "critérios de significância definidos na metodologia")
    .replace(/\bscore\b/gi, "índice")
    .replace(/\bscores\b/gi, "índices");
}
function list(value: unknown): string[] { return Array.isArray(value) ? value.map((x) => fixTypos(x)).filter(Boolean) : usable(value) ? [fixTypos(value)] : []; }
function evidenceText(value: unknown) { const items = list(value); return items.length ? items.join("; ") : "Definir evidência verificável no cronograma da organização."; }
function normalizeText(v: unknown) { return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function isRedundantAction(title: unknown, action: unknown) {
  const t = normalizeText(title); const a = normalizeText(action);
  return a.length === 0 || t.length === 0 || t === a || (a.length < 80 && t.startsWith(a)) || (t.length < 80 && a.startsWith(t));
}
function questionHasAttention(q: any) {
  return Number(q?.percentual_critico || 0) > 0
    || Number(q?.percentual_alto_critico || 0) > 0
    || Number(q?.percentual_desfavoravel || 0) > 0;
}
function responseTotal(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
function countFromPct(value: unknown, total: number | null) {
  const n = Number(value);
  return total && Number.isFinite(n) ? Math.max(0, Math.min(total, Math.round(total * n / 100))) : null;
}
function participantPhrase(count: number, total: number) {
  return `${count} de ${total} ${total === 1 ? "participante" : "participantes"}`;
}
type AttentionLimits = { principal: number; aggravation: number; critical: number };
const DEFAULT_ATTENTION_LIMITS: AttentionLimits = { principal: 50, aggravation: 30, critical: 10 };
function questionAttentionLevel(q: any, limits: AttentionLimits = DEFAULT_ATTENTION_LIMITS) {
  if (Number(q?.percentual_critico || 0) >= limits.critical) return "Situação crítica";
  if (Number(q?.percentual_alto_critico || 0) >= limits.aggravation) return "Atenção intensa";
  if (Number(q?.percentual_desfavoravel || 0) >= limits.principal) return "Atenção geral";
  if (Number(q?.percentual_desfavoravel || 0) > 0) return "Atenção pontual";
  return "Resultado favorável";
}
function questionAttentionColor(q: any, limits: AttentionLimits = DEFAULT_ATTENTION_LIMITS) {
  if (Number(q?.percentual_critico || 0) >= limits.critical) return REPORT_COLORS.red;
  if (Number(q?.percentual_alto_critico || 0) >= limits.aggravation) return REPORT_COLORS.orange;
  if (Number(q?.percentual_desfavoravel || 0) >= limits.principal) return REPORT_COLORS.amber;
  return REPORT_COLORS.green;
}
function questionAttentionText(q: any, total: number | null) {
  if (!total) {
    return `${pct(q?.percentual_desfavoravel)} de respostas desfavoráveis; ${pct(q?.percentual_alto_critico)} em atenção intensa; ${pct(q?.percentual_critico)} em situação crítica.`;
  }
  const unfavorable = countFromPct(q?.percentual_desfavoravel, total) || 0;
  const intense = countFromPct(q?.percentual_alto_critico, total) || 0;
  const critical = countFromPct(q?.percentual_critico, total) || 0;
  const parts = [
    unfavorable ? `${participantPhrase(unfavorable, total)} em sentido desfavorável` : "nenhuma resposta em sentido desfavorável",
    intense ? `${participantPhrase(intense, total)} em atenção intensa` : "nenhuma resposta em atenção intensa",
    critical ? `${participantPhrase(critical, total)} em situação crítica` : "nenhuma resposta em situação crítica",
  ];
  return `${parts.join("; ")}.`;
}
function clientInitials(value: unknown) {
  return clean(value, "OA").split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
}
function deadlineLabel(days: unknown) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return "No ciclo definido pela organização";
  const months = Math.max(1, Math.round(n / 30));
  return months === 1 ? "Em até 1 mês" : `Em até ${months} meses`;
}
function factorStatusText(factor: any) {
  return factor?.significativo
    ? "Ultrapassou pelo menos um limite de ação e deve ser tratado no plano aprovado."
    : "Não ultrapassou os limites de ação; recomenda-se preservar as condições favoráveis e acompanhar mudanças.";
}
function bucketByPrazo(prazoDias: number | null | undefined, prioridade: unknown) {
  const p = Number(prazoDias) > 0 ? Number(prazoDias) : deadlineFor(prioridade);
  if (p <= 60) return "onda1";
  if (p <= 120) return "onda2";
  if (p <= 210) return "onda3";
  return "onda4";
}
function originLabel(origin: any) { const value = clean(origin?.coleta); return value === "importacao_bruta" ? "Importação de formulário externo em dados brutos" : value === "importacao_agregada" ? "Importação agregada" : "Coleta realizada pelo Portal HSE"; }
function criteriaActivated(f: any) { const out: string[] = []; if (f?.criterio_principal) out.push("M+A+C"); if (f?.criterio_agravamento) out.push("A+C"); if (f?.criterio_critico_automatico) out.push("crítico"); return out.length ? out.join(", ") : "nenhum critério"; }

function HeaderFooter({ code, revision, preview, hseLogoSrc, clientLogoSrc, clientName }: any) {
  return <>
    <View style={styles.header} fixed>
      <View style={styles.headerIdentity}>
        {clientLogoSrc
          ? <Image src={clientLogoSrc} style={styles.headerClientLogo} />
          : <Text style={styles.headerClientMark}>{clientInitials(clientName)}</Text>}
        <Text style={styles.headerClientName}>{clean(clientName, "Organização avaliada")}</Text>
      </View>
      <Text style={styles.headerMeta}>{code} · {revision}{"\n"}Modelo {REPORT_MODEL_VERSION}</Text>
    </View>
    <View style={styles.footer} fixed>
      <View style={styles.footerLeft}><Image src={hseLogoSrc} style={styles.footerLogo} /></View>
      <Text style={styles.footerCenter}>HSE Consulting</Text>
      <Text style={styles.footerRight} render={({ pageNumber }) => `Página ${pageNumber}`} />
    </View>
    {preview && <Text style={styles.watermark} fixed>PRÉVIA · SEM VALIDADE</Text>}
  </>;
}
function Meta({ label, value }: any) { return usable(value) ? <View style={styles.coverMeta}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{clean(value)}</Text></View> : null; }
function Kpi({ value, label, hint, last, color }: any) { return <View style={[styles.kpi, last ? styles.kpiLast : {}]}><Text style={[styles.kpiValue, color ? { color } : {}]}>{clean(value, "-")}</Text><Text style={styles.kpiLabel}>{label}</Text>{usable(hint) ? <Text style={styles.kpiHint}>{hint}</Text> : null}</View>; }
function BulletList({ items }: { items: string[] }) { return <>{items.slice(0, 6).map((item, index) => <View style={styles.bullet} key={index}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>{item}</Text></View>)}</>; }

function ScoreChart({ factors }: { factors: any[] }) {
  const bands = [REPORT_COLORS.paleGreen, "#E1F1E6", REPORT_COLORS.paleAmber, "#FBE6D5", REPORT_COLORS.paleRed];
  return <View>
    <View style={styles.chartAxis}>{["0", "0,80", "1,60", "2,40", "3,20", "4,00"].map((v) => <Text key={v} style={styles.axisText}>{v}</Text>)}</View>
    {factors.map((factor) => {
      const value = Math.max(0, Math.min(4, Number(factor?.score_medio) || 0));
      return <View key={factor?.fator_codigo} style={styles.chartRow} wrap={false}>
        <Text style={styles.chartLabel}>{factorName(factor)}</Text>
        <View style={styles.chartArea}>{bands.map((color, i) => <View key={i} style={[styles.chartBand, { backgroundColor: color }]} />)}<View style={[styles.chartBar, { width: `${value / 4 * 100}%`, backgroundColor: riskColor(factor?.classificacao) }]} /></View>
        <Text style={styles.chartScore}>{score(value)}</Text><Text style={[styles.chartClass, { color: riskColor(factor?.classificacao) }]}>{riskLabel(factor?.classificacao)}{"\n"}{factor?.significativo ? `Exige ação · ${riskLabel(factor?.prioridade)}` : "Dentro dos limites"}</Text>
      </View>;
    })}
  </View>;
}

function SignificanceTable({ factors }: { factors: any[] }) {
  return <View style={styles.table}>
    <View style={styles.tableHeader} fixed><Text style={styles.cellFactor}>Fator avaliado</Text><Text style={styles.cellScore}>Índice</Text><Text style={styles.cellMetric}>Atenção geral</Text><Text style={styles.cellMetric}>Atenção intensa</Text><Text style={styles.cellMetric}>Situação crítica</Text><Text style={styles.cellSig}>Acima do limite?</Text><Text style={styles.cellPriority}>Acompanhamento</Text></View>
    {factors.map((factor) => <View key={factor?.fator_codigo} style={styles.tableRow} wrap={false}>
      <Text style={styles.cellFactor}>{factorName(factor)}</Text><Text style={styles.cellScore}>{score(factor?.score_medio)}</Text><Text style={styles.cellMetric}>{pct(factor?.percentual_medio_alto_critico)}</Text><Text style={styles.cellMetric}>{pct(factor?.percentual_alto_critico)}</Text><Text style={styles.cellMetric}>{pct(factor?.percentual_critico)}</Text><Text style={styles.cellSig}>{factor?.significativo ? "Sim" : "Não"}</Text><Text style={[styles.cellPriority, { color: riskColor(factor?.prioridade), fontFamily: "Helvetica-Bold" }]}>{riskLabel(factor?.prioridade)}</Text>
    </View>)}
  </View>;
}

function QuestionTable({ questions, limits }: { questions: any[]; limits: AttentionLimits }) {
  return <View style={styles.table}>
    <View style={styles.tableHeader} fixed><Text style={styles.qNo}>Nº</Text><Text style={styles.qText}>Pergunta</Text><Text style={styles.qScore}>Índice</Text><Text style={styles.qClass}>Leitura</Text><Text style={styles.qPct}>Desfav.</Text><Text style={styles.qPct}>Intensa</Text><Text style={styles.qPct}>Crítica</Text></View>
    {questions.map((question) => <View key={question?.numero} style={styles.tableRow} wrap={false}><Text style={styles.qNo}>{question?.numero}</Text><Text style={styles.qText}>{clean(question?.texto, "Pergunta do questionário")}</Text><Text style={styles.qScore}>{score(question?.score_medio)}</Text><Text style={[styles.qClass, { color: questionAttentionColor(question, limits) }]}>{questionAttentionLevel(question, limits)}</Text><Text style={styles.qPct}>{pct(question?.percentual_desfavoravel)}</Text><Text style={styles.qPct}>{pct(question?.percentual_alto_critico)}</Text><Text style={styles.qPct}>{pct(question?.percentual_critico)}</Text></View>)}
  </View>;
}

export function PsychosocialReportDocument({ snapshot, codigoRafp, codigoRev, codigoValidacao, cliente, empresa, dataEmissao, preview = false, qrDataUrl, assinaturaDataUrl, clientLogoDataUrl }: any) {
  const assessment = snapshot?.avaliacao || {};
  const review = snapshot?.revisao || {};
  const responsible = review?.responsavel || {};
  const result = snapshot?.resultado || {};
  const origin = snapshot?.origem || {};
  const factors: any[] = (Array.isArray(snapshot?.fatores) ? snapshot.fatores : []).sort((a: any, b: any) => Number(a?.ordem || 0) - Number(b?.ordem || 0));
  const actions: any[] = Array.isArray(snapshot?.plano?.itens) ? snapshot.plano.itens : [];
  const questions: any[] = Array.isArray(snapshot?.perguntas) ? snapshot.perguntas : [];
  const significant = factors.filter((factor) => factor?.significativo);
  const highest = [...significant].sort((a, b) => priorityRank(b?.prioridade) - priorityRank(a?.prioridade))[0];
  const methodology = assessment?.metodologia || snapshot?.agregado?.processamento?.metodologia || snapshot?.biblioteca || {};
  const methodologyLabel = methodology?.codigo ? `${methodology.codigo} v${clean(methodology.versao)}` : "Metodologia registrada no Portal HSE";
  const principalLimit = Number(methodology?.criterio_principal_percentual ?? 50);
  const aggravationLimit = Number(methodology?.criterio_agravamento_percentual ?? 30);
  const criticalLimit = Number(methodology?.criterio_critico_percentual ?? 10);
  const attentionLimits = { principal: principalLimit, aggravation: aggravationLimit, critical: criticalLimit };
  const responsibleName = responsible?.nome_responsavel || responsible?.nome || "Responsável técnico";
  const registration = usable(responsible?.registro_profissional) ? clean(responsible.registro_profissional) : "";
  const responseCount = result?.total_participantes ?? result?.total_respostas ?? "-";
  const totalResponses = responseTotal(responseCount);
  const generalScore = Number(result?.indice_geral_descritivo);
  const opinion = review?.parecer_conclusivo || {};
  const address = organizationAddress(cliente);
  const hseLogoSrc = empresa?.logo_url || HSE_LOGO_GREEN_DATA_URL;
  const companyContacts = [empresa?.telefone, empresa?.email, empresa?.site].filter(usable).join("  ·  ");
  const clientName = clean(cliente?.nome || cliente?.nome_fantasia || cliente?.razao_social, "Organização avaliada");
  const actionDeadlines = actions.map((a) => Number(a?.prazo_dias) > 0 ? Number(a.prazo_dias) : deadlineFor(a?.prioridade)).filter((n) => Number.isFinite(n) && n > 0);
  const priorityDeadline = actionDeadlines.length ? Math.min(...actionDeadlines) : deadlineFor(highest?.prioridade);
  const questionsByFactor = new Map<string, any[]>();
  questions.forEach((question) => {
    const key = clean(question?.fator_codigo);
    if (!key) return;
    const group = questionsByFactor.get(key) || [];
    group.push(question);
    questionsByFactor.set(key, group);
  });
  const includeFullQuestionAnnex = false;
  const questionGroups = includeFullQuestionAnnex
    ? factors.map((factor) => ({ factor, questions: questionsByFactor.get(factor?.fator_codigo) || [] })).filter((group) => group.questions.length)
    : [];
  const questionPages: any[][] = [];
  for (let i = 0; i < questionGroups.length; i += 4) questionPages.push(questionGroups.slice(i, i + 4));
  const priorityQuestions = significant.flatMap((factor) => questions.filter((q) => q?.fator_codigo === factor?.fator_codigo).filter(questionHasAttention).sort((a, b) => Number(b?.percentual_critico || 0) - Number(a?.percentual_critico || 0) || Number(b?.percentual_alto_critico || 0) - Number(a?.percentual_alto_critico || 0) || Number(b?.percentual_desfavoravel || 0) - Number(a?.percentual_desfavoravel || 0) || Number(b?.score_medio || 0) - Number(a?.score_medio || 0) || Number(a?.numero || 0) - Number(b?.numero || 0)).slice(0, 5).map((q) => ({ ...q, factor })));
  const detailedFactors = significant.length
    ? significant
    : [...factors]
      .sort((a, b) =>
        Number(b?.percentual_critico || 0) - Number(a?.percentual_critico || 0)
        || Number(b?.percentual_alto_critico || 0) - Number(a?.percentual_alto_critico || 0)
        || Number(b?.percentual_medio_alto_critico || 0) - Number(a?.percentual_medio_alto_critico || 0)
        || Number(b?.score_medio || 0) - Number(a?.score_medio || 0))
      .slice(0, 3);
  const detailedCodes = new Set(detailedFactors.map((factor) => factor?.fator_codigo));
  const summarizedFactors = factors.filter((factor) => !detailedCodes.has(factor?.fator_codigo));
  const factorPages: any[][] = [];
  for (let i = 0; i < detailedFactors.length; i += 3) factorPages.push(detailedFactors.slice(i, i + 3));
  const summaryFactorPages: any[][] = [];
  for (let i = 0; i < summarizedFactors.length; i += 4) summaryFactorPages.push(summarizedFactors.slice(i, i + 4));
  const priorityQuestionGroups = significant.map((factor) => ({ factor, questions: priorityQuestions.filter((question) => question.factor?.fator_codigo === factor?.fator_codigo) })).filter((group) => group.questions.length);
  const priorityQuestionPages: any[][] = [];
  for (let i = 0; i < priorityQuestionGroups.length; i += 4) priorityQuestionPages.push(priorityQuestionGroups.slice(i, i + 4));
  const actionPages: any[][] = [];
  let currentActions: any[] = []; let currentWeight = 0;
  actions.forEach((action) => { const weight = 135 + list(action?.orientacoes_praticas).length * 20 + list(action?.exemplos_aplicacao).length * 20 + Math.ceil(clean(action?.acao).length / 100) * 12; if (currentActions.length && currentWeight + weight > 390) { actionPages.push(currentActions); currentActions = []; currentWeight = 0; } currentActions.push(action); currentWeight += weight; });
  if (currentActions.length) actionPages.push(currentActions);
  if (!actionPages.length) actionPages.push([]);
  const headerFooter = <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} hseLogoSrc={hseLogoSrc} clientLogoSrc={clientLogoDataUrl} clientName={clientName} />;

  return <Document title={`Relatório ${codigoRafp} ${codigoRev}`} author="HSE Consulting" subject="Avaliação de Fatores Psicossociais" creator="Portal HSE" producer="Portal HSE">
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverBand}><View style={styles.coverShapeOne} /><View style={styles.coverShapeTwo} /><Image src={hseLogoSrc} style={styles.coverLogo} /><Text style={styles.coverKicker}>RELATÓRIO TÉCNICO</Text><Text style={styles.coverTitle}>Avaliação de Fatores Psicossociais</Text></View>
      <View style={styles.coverBody}>
        <Text style={styles.clientLabel}>ORGANIZAÇÃO AVALIADA</Text><Text style={styles.clientName}>{clientName}</Text>
        {(usable(cliente?.razao_social) || usable(cliente?.cnpj_cpf) || usable(address)) && <View style={styles.organizationCard}>{usable(cliente?.razao_social) && <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Razão social: </Text>{clean(cliente.razao_social)}</Text>}{usable(cliente?.cnpj_cpf) && <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>CNPJ: </Text>{formatCnpj(cliente.cnpj_cpf)}</Text>}{usable(address) ? <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Endereço: </Text>{address}</Text> : null}</View>}
        <View style={styles.coverMetaGrid}><Meta label="Relatório e revisão" value={`${codigoRafp} · ${codigoRev}`} /><Meta label="Período analisado" value={assessment?.periodo?.inicio && assessment?.periodo?.fim ? `${date(assessment.periodo.inicio)} a ${date(assessment.periodo.fim)}` : ""} /><Meta label="Emissão" value={date(dataEmissao)} /><Meta label="Metodologia" value={methodologyLabel} /><Meta label="Modelo do documento" value={`${REPORT_MODEL_CODE} v${REPORT_MODEL_VERSION}`} /></View>
        <View style={styles.approval}><View style={styles.approvalDot}><View style={styles.approvalDotInner} /></View><View style={styles.approvalText}><Text style={{ color: REPORT_COLORS.green, fontFamily: "Helvetica-Bold", fontSize: 9 }}>CONTEÚDO TÉCNICO APROVADO</Text><Text style={{ marginTop: 3, fontFamily: "Helvetica-Bold" }}>{responsibleName}</Text><Text style={styles.note}>{[clean(responsible?.cargo), registration].filter(Boolean).join(" · ")}</Text></View></View>
        {usable(companyContacts) ? <Text style={[styles.contactText, { color: REPORT_COLORS.muted, marginTop: 11 }]}>{companyContacts}</Text> : null}
      </View>{preview && <Text style={styles.watermark}>PRÉVIA · SEM VALIDADE</Text>}
    </Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>PARA A DIREÇÃO E LIDERANÇAS</Text><Text style={styles.h1}>Resumo executivo</Text><Text style={styles.intro}>Este resumo apresenta os principais resultados, os pontos que merecem acompanhamento e as medidas recomendadas para os próximos 12 meses.</Text>
      <View style={[styles.decisionPanel, { borderLeftColor: highest ? riskColor(highest.prioridade) : REPORT_COLORS.green }]}><Text style={styles.decisionLabel}>CONCLUSÃO PRINCIPAL</Text><Text style={styles.decisionTitle}>{significant.length ? `${significant.length} ${significant.length === 1 ? "fator ultrapassou" : "fatores ultrapassaram"} os limites de ação` : "Manter prevenção e acompanhamento periódico"}</Text><Text style={styles.decisionText}>{significant.length ? editorialText(opinion?.sintese_resultados || review?.conclusao, "Foram identificadas condições coletivas que devem ser tratadas conforme as prioridades e medidas aprovadas.") : "Nenhum fator ultrapassou os limites de ação no período. Recomenda-se preservar as condições favoráveis e acompanhar mudanças na organização do trabalho."}</Text>{Number.isFinite(generalScore) && <Text style={styles.secondaryIndex}>Índice geral descritivo: {generalScore.toFixed(2)} / 4. O índice auxilia a leitura do conjunto, mas os limites metodológicos por fator orientam a necessidade de ação.</Text>}</View>
      <View style={styles.row}><Kpi value={responseCount} label="Pessoas que responderam" /><Kpi value={significant.length} label="Fatores acima dos limites" /><Kpi value={actions.length} label="Medidas aprovadas" /><Kpi value={highest ? riskLabel(highest.prioridade) : "Preventiva"} label="Maior prioridade" hint={deadlineLabel(priorityDeadline)} last color={highest ? riskColor(highest.prioridade) : REPORT_COLORS.green} /></View>
      <Text style={styles.h2}>O que fazer agora</Text>
      {(actions.length ? [
        ["Primeiros 60 dias", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda1")],
        ["Até 4 meses", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda2")],
        ["Até 7 meses", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda3")],
        ["Até 12 meses", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda4")],
      ].filter(([, items]: any) => items.length).slice(0, 4) : [["Ciclo anual · até 365 dias", []]]).map(([when, items]: any) => <View key={when} style={styles.timelineItem} wrap={false}><Text style={styles.timelineWhen}>{when}</Text><View style={styles.timelineBody}><Text style={styles.timelineTitle}>{items.length ? items.slice(0, 2).map((a: any) => fixTypos(a?.titulo)).join("; ") : "Preservar controles, acompanhar indicadores e repetir a avaliação no ciclo definido."}</Text><Text style={styles.note}>Liderança sugerida: {items.length ? fixTypos(items[0]?.responsavel) || "Gestão da unidade e RH" : "Gestão da unidade e RH"}</Text></View></View>)}
      <View style={styles.infoPanel}><Text style={styles.h3}>Como ler este relatório</Text><Text style={styles.note}>Os resultados representam a percepção coletiva das equipes sobre a organização do trabalho. Eles não identificam pessoas nem constituem diagnóstico psicológico individual. A empresa deve comparar os achados com a rotina real, ouvir as equipes e acompanhar as condições de trabalho ao longo do tempo.</Text><Text style={[styles.note, { marginTop: 6 }]}><Text style={{ fontFamily: "Helvetica-Bold" }}>Glossário rápido: </Text>Índice: média das respostas de 0 (favorável) a 4 (muito desfavorável). Atenção geral: respostas nas faixas média, alta ou crítica. Atenção intensa: respostas nas faixas alta ou crítica. Situação crítica: respostas na faixa mais grave. Acima do limite: fator que alcançou pelo menos um critério da metodologia.</Text></View>
    </Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>PANORAMA GERAL</Text><Text style={styles.h1}>Como cada fator foi avaliado</Text><Text style={styles.intro}>O gráfico apresenta o índice médio de cada fator em uma escala de 0 (favorável) a 4 (muito desfavorável). A decisão considera o índice e a quantidade de respostas nas faixas de atenção; por isso, o quadro abaixo é a principal referência para o plano.</Text><ScoreChart factors={factors} /><Text style={styles.h2}>Quadro de referência para a decisão</Text><SignificanceTable factors={factors} /><Text style={[styles.note, { marginTop: 7 }]}>Atenção geral: respostas nas faixas média, alta ou crítica. Atenção intensa: respostas nas faixas alta ou crítica. Situação crítica: respostas na faixa mais grave. O fator fica acima do limite quando alcança pelo menos um dos critérios explicados na seção de metodologia.</Text></Page>

    {factorPages.map((pageFactors, pageIndex) => <Page key={`factor-analysis-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>ANÁLISE POR FATOR</Text><Text style={styles.h1}>{significant.length ? "Fatores acima dos limites de ação" : "Fatores em destaque para acompanhamento"}</Text><Text style={styles.intro}>{significant.length ? "Os fatores abaixo ultrapassaram pelo menos um limite da metodologia. A leitura combina os indicadores, as perguntas com maior atenção e as medidas aprovadas." : "Nenhum fator ultrapassou os limites de ação. Destacamos os sinais que merecem acompanhamento preventivo para preservar as condições atuais."}</Text>
      {pageFactors.map((factor) => { const qs = (questionsByFactor.get(factor?.fator_codigo) || []).filter(questionHasAttention).sort((a, b) => Number(b?.percentual_critico || 0) - Number(a?.percentual_critico || 0) || Number(b?.percentual_alto_critico || 0) - Number(a?.percentual_alto_critico || 0) || Number(b?.percentual_desfavoravel || 0) - Number(a?.percentual_desfavoravel || 0)).slice(0, 2); const relatedActions = actions.filter((a) => list(a?.fatores).includes(factor?.fator_codigo)); return <View key={factor?.fator_codigo} style={[styles.factorCard, { borderTopColor: riskColor(factor?.prioridade || factor?.classificacao) }]} wrap={false}><View style={styles.factorHeader}><Text style={styles.factorName}>{factorName(factor)}</Text><Text style={[styles.pill, { backgroundColor: riskColor(factor?.prioridade) }]}>Acompanhamento: {riskLabel(factor?.prioridade)}</Text></View><View style={styles.metricRow}><Text style={styles.metric}>Índice <Text style={styles.metricValue}>{score(factor?.score_medio)}</Text></Text><Text style={styles.metric}>Atenção geral <Text style={styles.metricValue}>{pct(factor?.percentual_medio_alto_critico)}</Text></Text><Text style={styles.metric}>Atenção intensa <Text style={styles.metricValue}>{pct(factor?.percentual_alto_critico)}</Text></Text><Text style={styles.metric}>Situação crítica <Text style={styles.metricValue}>{pct(factor?.percentual_critico)}</Text></Text></View><Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Leitura para a organização: </Text>{editorialText(factor?.observacao || factor?.justificativa, factorStatusText(factor))}</Text><Text style={{ marginTop: 4 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Orientação: </Text>{FACTOR_DIRECTION[factor?.fator_codigo] || "Comparar os indicadores com o trabalho real e acompanhar se as medidas adotadas produzem efeito."}</Text>{qs.length > 0 && <View style={styles.questionAttention}><Text style={styles.h3}>Perguntas que merecem atenção</Text>{qs.map((q) => <View key={q.numero} style={styles.questionSignal}><Text style={styles.questionSignalTitle}>Pergunta {q.numero} - {clean(q.texto)}</Text><Text style={[styles.attentionPill, { backgroundColor: questionAttentionColor(q, attentionLimits) }]}>{questionAttentionLevel(q, attentionLimits)}</Text><Text style={[styles.note, { marginTop: 3 }]}>{questionAttentionText(q, totalResponses)}</Text></View>)}</View>}{relatedActions.length > 0 && <Text style={[styles.note, { marginTop: 4 }]}>Medidas aprovadas relacionadas: {relatedActions.map((a) => fixTypos(a.titulo)).join("; ")}.</Text>}</View>; })}
    </Page>)}

    {summaryFactorPages.map((pageFactors, pageIndex) => <Page key={`factor-summary-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>ANÁLISE POR FATOR</Text><Text style={styles.h1}>Demais fatores avaliados</Text><Text style={styles.intro}>Todos os fatores fazem parte da conclusão. Abaixo estão os resultados que não aparecem na seção de destaque, com a orientação preventiva correspondente.</Text>{pageFactors.map((factor) => <View key={factor?.fator_codigo} style={[styles.compactFactorCard, { borderLeftColor: riskColor(factor?.prioridade || factor?.classificacao) }]} wrap={false}><View style={styles.compactFactorTop}><Text style={styles.factorName}>{factorName(factor)}</Text><Text style={[styles.pill, { backgroundColor: riskColor(factor?.prioridade) }]}>{factor?.significativo ? "Acima do limite" : "Dentro dos limites"}</Text></View><View style={styles.metricRow}><Text style={styles.metric}>Índice <Text style={styles.metricValue}>{score(factor?.score_medio)}</Text></Text><Text style={styles.metric}>Atenção geral <Text style={styles.metricValue}>{pct(factor?.percentual_medio_alto_critico)}</Text></Text><Text style={styles.metric}>Atenção intensa <Text style={styles.metricValue}>{pct(factor?.percentual_alto_critico)}</Text></Text><Text style={styles.metric}>Situação crítica <Text style={styles.metricValue}>{pct(factor?.percentual_critico)}</Text></Text></View><Text style={styles.compactFactorSummary}>{factorStatusText(factor)} {FACTOR_DIRECTION[factor?.fator_codigo] || "Acompanhar o fator em conjunto com a rotina real de trabalho."}</Text></View>)}</Page>)}

    {priorityQuestionPages.map((groups, pageIndex) => <Page key={`priority-questions-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>ONDE CONCENTRAR A ATENÇÃO</Text><Text style={styles.h1}>Perguntas prioritárias</Text>{pageIndex === 0 && <Text style={styles.intro}>Estas perguntas concentraram os sinais mais relevantes nos fatores acima dos limites. Os resultados são coletivos e devem orientar a análise do trabalho, sem identificar participantes.</Text>}{groups.map(({ factor, questions: groupQuestions }) => <View key={factor?.fator_codigo} style={styles.questionGroup} wrap={false}><View style={styles.questionHeader}><Text style={styles.questionTitle}>{factorName(factor)}</Text></View><QuestionTable questions={groupQuestions} limits={attentionLimits} /></View>)}</Page>)}

    {questionPages.map((groups, pageIndex) => <Page key={`questions-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>ANEXO TÉCNICO · RESULTADOS COLETIVOS</Text><Text style={styles.h1}>Resultados completos por pergunta</Text>{pageIndex === 0 && <Text style={styles.intro}>As 35 perguntas são apresentadas por fator, exclusivamente com indicadores agregados. “Desfav.” representa a proporção de respostas em sentido desfavorável conforme a pontuação da pergunta.</Text>}{groups.map(({ factor, questions: groupQuestions }) => <View key={factor?.fator_codigo} style={styles.questionGroup}><View style={styles.questionHeader}><Text style={styles.questionTitle}>{factorName(factor)} · {groupQuestions.length} perguntas</Text></View><QuestionTable questions={groupQuestions} limits={attentionLimits} /></View>)}</Page>)}

    {actionPages.map((pageActions, pageIndex) => <Page key={`actions-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>PLANO PARA OS PRÓXIMOS 12 MESES</Text><Text style={styles.h1}>{significant.length ? "Plano de ação" : "Plano preventivo"}</Text>{pageIndex === 0 && <Text style={styles.intro}>O plano apresenta as medidas recomendadas, os responsáveis sugeridos, os prazos, as evidências esperadas e os critérios para verificar os resultados.</Text>}{pageActions.length ? pageActions.map((action, index) => { const number = actionPages.slice(0, pageIndex).reduce((sum, page) => sum + page.length, 0) + index + 1; const titulo = fixTypos(action?.titulo) || `Ação ${number}`; const acaoDesc = fixTypos(action?.acao); const showAcao = !isRedundantAction(titulo, acaoDesc); const actionDeadline = Number(action?.prazo_dias) > 0 ? Number(action.prazo_dias) : deadlineFor(action?.prioridade); return <View key={action?.id || number} style={styles.actionCard}><View style={styles.actionHeader} wrap={false}><Text style={styles.actionNo}>{number}</Text><Text style={styles.actionTitle}>{titulo}</Text></View><View style={styles.actionBody}><View style={styles.actionGrid}><View style={styles.actionField}><Text style={styles.actionLabel}>Fatores relacionados</Text><Text style={styles.actionValue}>{list(action?.fatores).map((code) => FACTOR_LABELS[code] || code).join("; ") || "Medida transversal"}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Natureza e acompanhamento</Text><Text style={styles.actionValue}>{[editorialText(action?.nivel), riskLabel(action?.prioridade)].filter(Boolean).join(" · ")}</Text></View></View>{usable(action?.objetivo) && <><Text style={styles.actionLabel}>Objetivo</Text><Text style={styles.actionValue}>{editorialText(action.objetivo)}</Text></>}{showAcao && <><Text style={styles.actionLabel}>O que fazer</Text><Text style={styles.actionValue}>{editorialText(acaoDesc, "Aplicar a medida aprovada e registrar sua execução.")}</Text></>}{list(action?.orientacoes_praticas).length > 0 && <><Text style={styles.actionLabel}>Como implementar</Text><BulletList items={list(action.orientacoes_praticas)} /></>}{list(action?.exemplos_aplicacao).length > 0 && <><Text style={[styles.actionLabel, { marginTop: 5 }]}>Exemplos de aplicação</Text><BulletList items={list(action.exemplos_aplicacao)} /></>}<View style={[styles.actionGrid, { marginTop: 6 }]}><View style={styles.actionField}><Text style={styles.actionLabel}>Responsável sugerido</Text><Text style={styles.actionValue}>{fixTypos(action?.responsavel) || "Gestão da unidade e RH"}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Prazo recomendado</Text><Text style={styles.actionValue}>{deadlineLabel(actionDeadline)}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Abrangência</Text><Text style={styles.actionValue}>{fixTypos(action?.abrangencia || action?.grupo) || "Organização"}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Como comprovar</Text><Text style={styles.actionValue}>{evidenceText(action?.evidencias)}</Text></View></View><Text style={styles.actionLabel}>Indicador de eficácia</Text><Text style={styles.actionValue}>{editorialText(action?.indicador_eficacia, "Verificar implantação, percepção das equipes e evolução do fator em reavaliação posterior.")}</Text></View></View>; }) : <View style={styles.infoPanel}><Text>Manter os controles preventivos, registrar mudanças relevantes no trabalho e programar reavaliação no ciclo definido pela organização.</Text></View>}</Page>)}

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>PARECER DO RESPONSÁVEL TÉCNICO</Text><Text style={styles.h1}>Parecer técnico conclusivo</Text><Text style={styles.intro}>O parecer reúne a conclusão do responsável técnico, os pontos que merecem acompanhamento e as orientações aprovadas para a organização.</Text>{[["Conclusão técnica", "conclusao"], ["O que os resultados indicam", "interpretacao_integrada"], ["Prioridades para a organização", "prioridades_intervencao"], ["Orientações recomendadas", "recomendacoes"], ["Limitações da leitura", "limitacoes"]].map(([label, key]) => <View key={key} style={styles.opinionSection}><Text style={styles.h3}>{label}</Text><Text>{editorialText(opinion?.[key], key === "limitacoes" ? clean(review?.limitacoes, "Os resultados são coletivos e não constituem diagnóstico individual.") : clean(opinion?.sintese_resultados || review?.conclusao, "Parecer registrado na revisão técnica aprovada."))}</Text></View>)}<View style={styles.infoPanel}><Text style={styles.note}>A HSE Consulting recomenda e orienta as medidas técnicas. Cabe à organização definir responsáveis internos, disponibilizar recursos, executar as ações e manter os registros correspondentes, salvo quando houver contratação específica para essa execução. O relatório apoia a Avaliação de Exposição Psicossocial (AEP), o Inventário de Riscos e o Plano de Ação do PGR, mas não substitui esses documentos.</Text></View></Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>COMO A CONCLUSÃO FOI CONSTRUÍDA</Text><Text style={styles.h1}>O caminho técnico até o resultado</Text><Text style={styles.intro}>A conclusão combina cálculo padronizado das respostas, análise dos indicadores coletivos e revisão de um profissional habilitado, sempre preservando a confidencialidade de quem respondeu.</Text><View style={styles.methodFlow}>{[["1", "Como as respostas viram números", "Cada alternativa recebe um peso de 0 a 4, conforme o sentido da pergunta (favorável ou desfavorável)."], ["2", "Como o coletivo é calculado", "Somamos e agrupamos as respostas por pergunta e por fator, gerando indicadores do grupo (nunca de pessoas)."], ["3", "Quando um fator exige ação", "Comparamos os indicadores do grupo com os limites definidos na metodologia. Basta cruzar um deles."], ["4", "Revisão", "Um responsável técnico habilitado revisa números, contexto e plano de ação antes de aprovar o relatório."]].map(([no, title, text]) => <View key={no} style={styles.methodStep} wrap={false}><Text style={styles.methodNo}>{no}</Text><Text style={styles.methodTitle}>{title}</Text><Text style={styles.methodText}>{text}</Text></View>)}</View><Text style={styles.h3}>Limites que definem quando é preciso agir</Text><View style={styles.criteriaRow}><View style={styles.criteriaCard}><Text style={styles.criteriaValue}>{principalLimit}%</Text><Text style={styles.criteriaText}>ou mais das pessoas em nível médio, alto ou crítico (atenção geral).</Text></View><View style={styles.criteriaCard}><Text style={styles.criteriaValue}>{aggravationLimit}%</Text><Text style={styles.criteriaText}>ou mais das pessoas em nível alto ou crítico (atenção intensa).</Text></View><View style={[styles.criteriaCard, { marginRight: 0 }]}><Text style={styles.criteriaValue}>{criticalLimit}%</Text><Text style={styles.criteriaText}>ou mais das pessoas na faixa mais grave (situação crítica).</Text></View></View><View style={styles.infoPanel}><Text style={styles.h3}>O que este relatório não faz</Text><Text>{clean(opinion?.limitacoes || review?.limitacoes, "A avaliação mostra a percepção coletiva do grupo no período analisado. Ela não identifica pessoas, não faz diagnóstico psicológico individual e não prova sozinha a causa de nenhum problema. Os achados devem ser comparados com o trabalho real e acompanhados depois que as medidas forem implantadas.")}</Text></View><Text style={styles.h2}>Como saber se as medidas funcionaram</Text><BulletList items={["confirmar se cada medida prevista foi realmente implantada;", "reunir evidências (documentos, registros) e ouvir a percepção das equipes;", "acompanhar indicadores relacionados ao trabalho e mudanças organizacionais no período;", "repetir a avaliação depois de tempo suficiente para observar mudanças."]} /></Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>CONTROLE E RASTREABILIDADE</Text><Text style={styles.h1}>Ficha técnica do documento</Text><View style={styles.table}><View style={styles.traceRow}><Text style={styles.traceKey}>Origem dos dados</Text><Text style={styles.traceValue}>{originLabel(origin)}</Text></View>{usable(assessment?.codigo) && <View style={styles.traceRow}><Text style={styles.traceKey}>Identificador interno</Text><Text style={styles.traceValue}>{clean(assessment.codigo)}</Text></View>}<View style={styles.traceRow}><Text style={styles.traceKey}>Código e revisão</Text><Text style={styles.traceValue}>{codigoRafp} · {codigoRev}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Versão do modelo</Text><Text style={styles.traceValue}>{REPORT_MODEL_CODE} v{REPORT_MODEL_VERSION}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Metodologia</Text><Text style={styles.traceValue}>{methodologyLabel}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Data da aprovação</Text><Text style={styles.traceValue}>{dateTime(review?.aprovada_em || responsible?.aprovado_em)}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Data da emissão</Text><Text style={styles.traceValue}>{dateTime(dataEmissao)}</Text></View>{review?.parecer_prompt_codigo && <View style={styles.traceRow}><Text style={styles.traceKey}>Assistência à minuta</Text><Text style={styles.traceValue}>{review.parecer_prompt_codigo} · conteúdo revisado e aprovado por responsável humano</Text></View>}</View>
      <Text style={styles.h2}>Responsabilidade técnica</Text><View style={styles.signatureBox}>{assinaturaDataUrl ? <Image src={assinaturaDataUrl} style={styles.signatureImage} /> : <View style={styles.signatureBlank} />}<View style={styles.signatureLine} /><Text style={{ marginTop: 5, fontFamily: "Helvetica-Bold", fontSize: 10 }}>{responsibleName}</Text>{usable(responsible?.cargo) ? <Text>{clean(responsible.cargo)}</Text> : null}{usable(registration) ? <Text>{registration}</Text> : null}{assinaturaDataUrl ? <Text style={[styles.note, { marginTop: 4 }]}>Assinatura reproduzida graficamente.</Text> : null}<Text style={[styles.note, { marginTop: 5 }]}>Conteúdo técnico aprovado no Portal HSE Consulting em {date(review?.aprovada_em || responsible?.aprovado_em)}. Documento emitido em {date(dataEmissao)}.</Text></View>
      {!preview && qrDataUrl && <View style={[styles.approval, { marginTop: 13 }]}><View style={{ flex: 1 }}><Text style={styles.h3}>Validação do documento</Text><Text style={styles.note}>Leia o QR Code para confirmar código RAFP, revisão, emissão, status, responsável técnico e versão do modelo. O relatório permanece em armazenamento privado.</Text><Text style={[styles.note, { marginTop: 4 }]}>Código de validação: {clean(codigoValidacao)}</Text></View><Image src={qrDataUrl} style={styles.qr} /></View>}
    </Page>
  </Document>;
}
