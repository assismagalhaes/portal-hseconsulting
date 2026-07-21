// deno-lint-ignore-file no-explicit-any no-import-prefix jsx-curly-braces
// @deno-types="npm:@types/react@18.3.3"
import React from "npm:react@18.3.1";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "npm:@react-pdf/renderer@3.4.5";
import { HSE_LOGO_GREEN_DATA_URL } from "./brand-assets.ts";

export const REPORT_MODEL_CODE = "HSE-PSICO-REL-1.0";
export const REPORT_MODEL_VERSION = "1.5.0";

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
  header: { position: "absolute", top: 22, left: 40, right: 40, height: 31, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.line },
  headerLogo: { width: 58, height: 24, objectFit: "contain" },
  headerMeta: { color: REPORT_COLORS.muted, fontSize: 7.2, textAlign: "right" },
  footer: { position: "absolute", bottom: 18, left: 40, right: 40, height: 20, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, paddingTop: 6, color: REPORT_COLORS.muted, fontSize: 6.8 },
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
  opinionSection: { marginBottom: 9, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.line },
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
  return text && text.toLowerCase() !== "não aplicável" && text !== "—" ? text : fallback;
}
function usable(value: unknown) { return clean(value).length > 0; }
function date(value: unknown) { if (!value) return ""; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? clean(value) : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d); }
function dateTime(value: unknown) { if (!value) return ""; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? clean(value) : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(d); }
function formatCnpj(value: unknown) { const d = clean(value).replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : clean(value); }
function organizationAddress(c: any) { return [c?.endereco, c?.numero, c?.complemento, c?.bairro, [c?.cidade, c?.uf].filter(usable).join(" / "), c?.cep].map((x) => clean(x)).filter(Boolean).join(", ").replace(/,\s*,/g, ", "); }
function factorName(f: any) { return clean(f?.fator_nome || FACTOR_LABELS[f?.fator_codigo] || f?.nome || f?.fator_codigo, "Fator avaliado"); }
function priorityRank(value: unknown) { const v = clean(value).toLowerCase(); return v.startsWith("crit") || v.includes("crít") ? 4 : v.includes("alt") ? 3 : v.startsWith("med") || v.includes("méd") ? 2 : 1; }
function riskLabel(value: unknown, fallback = "Monitoramento") { const v = clean(value).toLowerCase(); return v.startsWith("crit") || v.includes("crít") ? "Crítico" : v.includes("alt") ? "Alto" : v.startsWith("med") || v.includes("méd") ? "Médio" : v.includes("baix") ? "Baixo" : v.includes("irrel") ? "Irrelevante" : fallback; }
function riskColor(value: unknown) { const rank = priorityRank(value); return rank === 4 ? REPORT_COLORS.red : rank === 3 ? REPORT_COLORS.orange : rank === 2 ? REPORT_COLORS.amber : REPORT_COLORS.green; }
function deadlineFor(value: unknown) { const rank = priorityRank(value); return rank === 4 ? 30 : rank === 3 ? 60 : rank === 2 ? 90 : 180; }
function pct(value: unknown) { const n = Number(value); return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—"; }
function score(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(2) : "—"; }
function fixTypos(input: unknown): string {
  const s = clean(input);
  if (!s) return s;
  return s
    .replace(/\blidernaça\b/gi, "liderança")
    .replace(/\blideranca\b/gi, "liderança")
    .replace(/\bReduç[aã]o de e (\d)/gi, "Redução de $1")
    .replace(/\bde e (\d+\s*%)/gi, "de $1")
    .replace(/≥\s*(\d)/g, "no mínimo $1")
    .replace(/≤\s*(\d)/g, "até $1")
    .replace(/[≥≤]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
function bucketByPrazo(prazoDias: number | null | undefined, prioridade: unknown) {
  const p = Number(prazoDias) > 0 ? Number(prazoDias) : deadlineFor(prioridade);
  if (p <= 60) return "onda1";
  if (p <= 120) return "onda2";
  if (p <= 210) return "onda3";
  return "onda4";
}
function originLabel(origin: any) { const value = clean(origin?.coleta); return value === "importacao_bruta" ? "Importação de formulário externo em dados brutos" : value === "importacao_agregada" ? "Importação agregada" : "Coleta realizada pelo Portal HSE"; }
function criteriaActivated(f: any) { const out: string[] = []; if (f?.criterio_principal) out.push("M+A+C"); if (f?.criterio_agravamento) out.push("A+C"); if (f?.criterio_critico_automatico) out.push("crítico"); return out.length ? out.join(", ") : "nenhum critério"; }

function HeaderFooter({ code, revision, preview, logoSrc, clientName }: any) {
  return <>
    <View style={styles.header} fixed><Image src={logoSrc} style={styles.headerLogo} /><Text style={styles.headerMeta}>{code} · {revision}{"\n"}Modelo {REPORT_MODEL_VERSION}</Text></View>
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>{clean(clientName, "Organização avaliada")}</Text>
      <Text style={styles.footerCenter}>{code} · {revision}</Text>
      <Text style={styles.footerRight} render={({ pageNumber }) => `Página ${pageNumber}`} />
    </View>
    {preview && <Text style={styles.watermark} fixed>PRÉVIA · SEM VALIDADE</Text>}
  </>;
}
function Meta({ label, value }: any) { return usable(value) ? <View style={styles.coverMeta}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{clean(value)}</Text></View> : null; }
function Kpi({ value, label, hint, last, color }: any) { return <View style={[styles.kpi, last ? styles.kpiLast : {}]}><Text style={[styles.kpiValue, color ? { color } : {}]}>{clean(value, "—")}</Text><Text style={styles.kpiLabel}>{label}</Text>{usable(hint) ? <Text style={styles.kpiHint}>{hint}</Text> : null}</View>; }
function BulletList({ items }: { items: string[] }) { return <>{items.slice(0, 3).map((item, index) => <View style={styles.bullet} key={index}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>{item}</Text></View>)}</>; }

function ScoreChart({ factors }: { factors: any[] }) {
  const bands = [REPORT_COLORS.paleGreen, "#E1F1E6", REPORT_COLORS.paleAmber, "#FBE6D5", REPORT_COLORS.paleRed];
  return <View>
    <View style={styles.chartAxis}>{["0", "0,80", "1,60", "2,40", "3,20", "4,00"].map((v) => <Text key={v} style={styles.axisText}>{v}</Text>)}</View>
    {factors.map((factor) => {
      const value = Math.max(0, Math.min(4, Number(factor?.score_medio) || 0));
      return <View key={factor?.fator_codigo} style={styles.chartRow} wrap={false}>
        <Text style={styles.chartLabel}>{factorName(factor)}</Text>
        <View style={styles.chartArea}>{bands.map((color, i) => <View key={i} style={[styles.chartBand, { backgroundColor: color }]} />)}<View style={[styles.chartBar, { width: `${value / 4 * 100}%`, backgroundColor: riskColor(factor?.classificacao) }]} /></View>
        <Text style={styles.chartScore}>{score(value)}</Text><Text style={[styles.chartClass, { color: riskColor(factor?.classificacao) }]}>{riskLabel(factor?.classificacao)}{"\n"}{factor?.significativo ? `Significativo · ${riskLabel(factor?.prioridade)}` : "Não significativo"}</Text>
      </View>;
    })}
  </View>;
}

function SignificanceTable({ factors }: { factors: any[] }) {
  return <View style={styles.table}>
    <View style={styles.tableHeader} fixed><Text style={styles.cellFactor}>Fator avaliado</Text><Text style={styles.cellScore}>Índice</Text><Text style={styles.cellMetric}>Atenção geral</Text><Text style={styles.cellMetric}>Atenção intensa</Text><Text style={styles.cellMetric}>Situação crítica</Text><Text style={styles.cellSig}>Exige ação?</Text><Text style={styles.cellPriority}>Prioridade</Text></View>
    {factors.map((factor) => <View key={factor?.fator_codigo} style={styles.tableRow} wrap={false}>
      <Text style={styles.cellFactor}>{factorName(factor)}</Text><Text style={styles.cellScore}>{score(factor?.score_medio)}</Text><Text style={styles.cellMetric}>{pct(factor?.percentual_medio_alto_critico)}</Text><Text style={styles.cellMetric}>{pct(factor?.percentual_alto_critico)}</Text><Text style={styles.cellMetric}>{pct(factor?.percentual_critico)}</Text><Text style={styles.cellSig}>{factor?.significativo ? "Sim" : "Não"}</Text><Text style={[styles.cellPriority, { color: riskColor(factor?.prioridade), fontFamily: "Helvetica-Bold" }]}>{riskLabel(factor?.prioridade)}</Text>
    </View>)}
  </View>;
}

function QuestionTable({ questions }: { questions: any[] }) {
  return <View style={styles.table}>
    <View style={styles.tableHeader} fixed><Text style={styles.qNo}>Nº</Text><Text style={styles.qText}>Pergunta</Text><Text style={styles.qScore}>Índice</Text><Text style={styles.qClass}>Nível</Text><Text style={styles.qPct}>Desfav.</Text><Text style={styles.qPct}>Atenção</Text><Text style={styles.qPct}>Crítico</Text></View>
    {questions.map((question) => <View key={question?.numero} style={styles.tableRow} wrap={false}><Text style={styles.qNo}>{question?.numero}</Text><Text style={styles.qText}>{clean(question?.texto, "Pergunta do questionário")}</Text><Text style={styles.qScore}>{score(question?.score_medio)}</Text><Text style={[styles.qClass, { color: riskColor(question?.classificacao) }]}>{riskLabel(question?.classificacao)}</Text><Text style={styles.qPct}>{pct(question?.percentual_desfavoravel)}</Text><Text style={styles.qPct}>{pct(question?.percentual_alto_critico)}</Text><Text style={styles.qPct}>{pct(question?.percentual_critico)}</Text></View>)}
  </View>;
}

export function PsychosocialReportDocument({ snapshot, codigoRafp, codigoRev, codigoValidacao, cliente, empresa, dataEmissao, preview = false, qrDataUrl, assinaturaDataUrl }: any) {
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
  const responsibleName = responsible?.nome_responsavel || responsible?.nome || "Responsável técnico";
  const registration = usable(responsible?.registro_profissional) ? clean(responsible.registro_profissional) : "";
  const responseCount = result?.total_participantes ?? result?.total_respostas ?? "—";
  const generalScore = Number(result?.indice_geral_descritivo);
  const opinion = review?.parecer_conclusivo || {};
  const address = organizationAddress(cliente);
  const logoSrc = empresa?.logo_url || HSE_LOGO_GREEN_DATA_URL;
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
  const priorityQuestions = significant.flatMap((factor) => questions.filter((q) => q?.fator_codigo === factor?.fator_codigo).sort((a, b) => Number(b?.percentual_critico || 0) - Number(a?.percentual_critico || 0) || Number(b?.percentual_alto_critico || 0) - Number(a?.percentual_alto_critico || 0) || Number(b?.percentual_desfavoravel || 0) - Number(a?.percentual_desfavoravel || 0) || Number(b?.score_medio || 0) - Number(a?.score_medio || 0) || Number(a?.numero || 0) - Number(b?.numero || 0)).slice(0, 5).map((q) => ({ ...q, factor })));
  const analyzedFactors = significant.length ? significant : factors.slice(0, 3);
  const factorPages: any[][] = [];
  for (let i = 0; i < analyzedFactors.length; i += 2) factorPages.push(analyzedFactors.slice(i, i + 2));
  const priorityQuestionGroups = significant.map((factor) => ({ factor, questions: priorityQuestions.filter((question) => question.factor?.fator_codigo === factor?.fator_codigo) })).filter((group) => group.questions.length);
  const priorityQuestionPages: any[][] = [];
  for (let i = 0; i < priorityQuestionGroups.length; i += 4) priorityQuestionPages.push(priorityQuestionGroups.slice(i, i + 4));
  const actionPages: any[][] = [];
  let currentActions: any[] = []; let currentWeight = 0;
  actions.forEach((action) => { const weight = 135 + list(action?.orientacoes_praticas).length * 20 + list(action?.exemplos_aplicacao).length * 20 + Math.ceil(clean(action?.acao).length / 100) * 12; if (currentActions.length && currentWeight + weight > 390) { actionPages.push(currentActions); currentActions = []; currentWeight = 0; } currentActions.push(action); currentWeight += weight; });
  if (currentActions.length) actionPages.push(currentActions);
  if (!actionPages.length) actionPages.push([]);
  const headerFooter = <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} logoSrc={logoSrc} clientName={clientName} />;

  return <Document title={`Relatório ${codigoRafp} ${codigoRev}`} author="HSE Consulting" subject="Avaliação de Fatores Psicossociais" creator="Portal HSE" producer="Portal HSE">
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverBand}><View style={styles.coverShapeOne} /><View style={styles.coverShapeTwo} /><Image src={logoSrc} style={styles.coverLogo} /><Text style={styles.coverKicker}>RELATÓRIO TÉCNICO</Text><Text style={styles.coverTitle}>Avaliação de Fatores Psicossociais</Text></View>
      <View style={styles.coverBody}>
        <Text style={styles.clientLabel}>ORGANIZAÇÃO AVALIADA</Text><Text style={styles.clientName}>{clientName}</Text>
        {(usable(cliente?.razao_social) || usable(cliente?.cnpj_cpf) || usable(address)) && <View style={styles.organizationCard}>{usable(cliente?.razao_social) && <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Razão social: </Text>{clean(cliente.razao_social)}</Text>}{usable(cliente?.cnpj_cpf) && <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>CNPJ: </Text>{formatCnpj(cliente.cnpj_cpf)}</Text>}{usable(address) ? <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Endereço: </Text>{address}</Text> : null}</View>}
        <View style={styles.coverMetaGrid}><Meta label="Relatório e revisão" value={`${codigoRafp} · ${codigoRev}`} /><Meta label="Período analisado" value={assessment?.periodo?.inicio && assessment?.periodo?.fim ? `${date(assessment.periodo.inicio)} a ${date(assessment.periodo.fim)}` : ""} /><Meta label="Emissão" value={date(dataEmissao)} /><Meta label="Metodologia" value={methodologyLabel} /><Meta label="Modelo do documento" value={`${REPORT_MODEL_CODE} v${REPORT_MODEL_VERSION}`} /></View>
        <View style={styles.approval}><View style={styles.approvalDot}><View style={styles.approvalDotInner} /></View><View style={styles.approvalText}><Text style={{ color: REPORT_COLORS.green, fontFamily: "Helvetica-Bold", fontSize: 9 }}>CONTEÚDO TÉCNICO APROVADO</Text><Text style={{ marginTop: 3, fontFamily: "Helvetica-Bold" }}>{responsibleName}</Text><Text style={styles.note}>{[clean(responsible?.cargo), registration].filter(Boolean).join(" · ")}</Text></View></View>
        {usable(companyContacts) ? <Text style={[styles.contactText, { color: REPORT_COLORS.muted, marginTop: 11 }]}>{companyContacts}</Text> : null}
      </View>{preview && <Text style={styles.watermark}>PRÉVIA · SEM VALIDADE</Text>}
    </Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>LEITURA PARA DECISÃO</Text><Text style={styles.h1}>Resumo executivo</Text><Text style={styles.intro}>O essencial para compreender o resultado coletivo, definir prioridades e organizar a resposta da empresa.</Text>
      <View style={[styles.decisionPanel, { borderLeftColor: highest ? riskColor(highest.prioridade) : REPORT_COLORS.green }]}><Text style={styles.decisionLabel}>DECISÃO TÉCNICA</Text><Text style={styles.decisionTitle}>{significant.length ? `${significant.length} ${significant.length === 1 ? "fator significativo requer" : "fatores significativos requerem"} intervenção organizacional` : "Manter prevenção e monitoramento periódico"}</Text><Text style={styles.decisionText}>{clean(opinion?.sintese_resultados || review?.conclusao, significant.length ? "Foram identificadas condições coletivas que exigem tratamento organizacional conforme as prioridades e medidas aprovadas." : "Nenhum fator atingiu os critérios de significância no período; recomenda-se preservar controles e acompanhar mudanças.")}</Text>{Number.isFinite(generalScore) && <Text style={styles.secondaryIndex}>Índice geral descritivo: {generalScore.toFixed(2)} / 4. Este indicador auxilia a leitura global, mas não determina sozinho a significância.</Text>}</View>
      <View style={styles.row}><Kpi value={responseCount} label="Participantes analisados" /><Kpi value={significant.length} label="Fatores significativos" /><Kpi value={highest ? riskLabel(highest.prioridade) : "Monitoramento"} label="PRIORIDADE MÁXIMA DE INTERVENÇÃO" hint={`Prazo recomendado: até ${priorityDeadline} dias`} last color={highest ? riskColor(highest.prioridade) : REPORT_COLORS.green} /></View>
      <Text style={styles.h2}>O que fazer agora</Text>
      {(actions.length ? [
        ["Onda 1 · até 60 dias", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda1")],
        ["Onda 2 · até 120 dias", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda2")],
        ["Onda 3 · até 210 dias", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda3")],
        ["Onda 4 · até 365 dias", actions.filter((a) => bucketByPrazo(a?.prazo_dias, a?.prioridade) === "onda4")],
      ].filter(([, items]: any) => items.length).slice(0, 4) : [["Ciclo anual · até 365 dias", []]]).map(([when, items]: any) => <View key={when} style={styles.timelineItem} wrap={false}><Text style={styles.timelineWhen}>{when}</Text><View style={styles.timelineBody}><Text style={styles.timelineTitle}>{items.length ? items.slice(0, 2).map((a: any) => fixTypos(a?.titulo)).join("; ") : "Preservar controles, acompanhar indicadores e repetir a avaliação no ciclo definido."}</Text><Text style={styles.note}>Liderança sugerida: {items.length ? fixTypos(items[0]?.responsavel) || "Gestão da unidade e RH" : "Gestão da unidade e RH"}</Text></View></View>)}
      <View style={styles.infoPanel}><Text style={styles.h3}>Como ler este documento</Text><Text style={styles.note}>Os resultados descrevem percepções coletivas sobre a organização do trabalho. Não constituem diagnóstico psicológico individual e precisam ser confrontados com o trabalho real por meio de escuta, observação e análise técnica.</Text></View>
    </Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>PANORAMA DOS SETE FATORES</Text><Text style={styles.h1}>Score médio por fator</Text><Text style={styles.intro}>Escala de 0 a 4 com limites visuais em 0,80, 1,60, 2,40 e 3,20. O score organiza a comparação; a significância considera também as distribuições percentuais.</Text><ScoreChart factors={factors} /><Text style={styles.h2}>Critérios que sustentam a decisão</Text><SignificanceTable factors={factors} /><Text style={[styles.note, { marginTop: 7 }]}>M+A+C: percentual nas faixas média, alta e crítica. A+C: percentual nas faixas alta e crítica. Um fator é significativo quando atende a pelo menos um critério configurado na metodologia.</Text></Page>

    {factorPages.map((pageFactors, pageIndex) => <Page key={`factor-analysis-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>LEITURA TÉCNICA</Text><Text style={styles.h1}>{significant.length ? "Fatores que exigem atenção" : "Monitoramento preventivo"}{pageIndex ? " · continuação" : ""}</Text><Text style={styles.intro}>{pageIndex ? "Continuação da análise dos fatores, mantendo resultado, critérios e direcionamento organizacional no mesmo bloco." : significant.length ? "Cada análise apresenta o resultado matemático, o critério acionado, as perguntas de maior atenção e o direcionamento organizacional aprovado." : "Como nenhum fator atingiu significância, o foco é preservar condições favoráveis e acompanhar mudanças no trabalho."}</Text>
      {pageFactors.map((factor) => { const qs = (questionsByFactor.get(factor?.fator_codigo) || []).filter(questionHasAttention).sort((a, b) => Number(b?.percentual_critico || 0) - Number(a?.percentual_critico || 0) || Number(b?.percentual_alto_critico || 0) - Number(a?.percentual_alto_critico || 0) || Number(b?.percentual_desfavoravel || 0) - Number(a?.percentual_desfavoravel || 0)).slice(0, 3); const relatedActions = actions.filter((a) => list(a?.fatores).includes(factor?.fator_codigo)); return <View key={factor?.fator_codigo} style={[styles.factorCard, { borderTopColor: riskColor(factor?.prioridade || factor?.classificacao) }]} wrap={false}><View style={styles.factorHeader}><Text style={styles.factorName}>{factorName(factor)}</Text><Text style={[styles.pill, { backgroundColor: riskColor(factor?.prioridade) }]}>Prioridade {riskLabel(factor?.prioridade)}</Text></View><View style={styles.metricRow}><Text style={styles.metric}>Score <Text style={styles.metricValue}>{score(factor?.score_medio)}</Text></Text><Text style={styles.metric}>M+A+C <Text style={styles.metricValue}>{pct(factor?.percentual_medio_alto_critico)}</Text></Text><Text style={styles.metric}>A+C <Text style={styles.metricValue}>{pct(factor?.percentual_alto_critico)}</Text></Text><Text style={styles.metric}>Crítico <Text style={styles.metricValue}>{pct(factor?.percentual_critico)}</Text></Text><Text style={styles.metric}>Critério <Text style={styles.metricValue}>{criteriaActivated(factor)}</Text></Text></View><Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Interpretação: </Text>{clean(factor?.observacao || factor?.justificativa, `${factorName(factor)} ${factor?.significativo ? "atingiu critério de significância e requer análise do trabalho real" : "não atingiu critério de significância no período"}.`)}</Text><Text style={{ marginTop: 4 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Direcionamento: </Text>{FACTOR_DIRECTION[factor?.fator_codigo] || "Confrontar os indicadores com o trabalho real e acompanhar a eficácia das medidas organizacionais."}</Text>{qs.length > 0 && <View style={styles.questionAttention}><Text style={styles.h3}>Perguntas que mais contribuíram para a atenção</Text>{qs.map((q) => <Text key={q.numero} style={styles.note}>Q{q.numero} · {clean(q.texto)} — crítico {pct(q.percentual_critico)}, A+C {pct(q.percentual_alto_critico)}</Text>)}</View>}{relatedActions.length > 0 && <Text style={[styles.note, { marginTop: 4 }]}>Medidas relacionadas: {relatedActions.map((a) => fixTypos(a.titulo)).join("; ")}.</Text>}</View>; })}
    </Page>)}

    {priorityQuestionPages.map((groups, pageIndex) => <Page key={`priority-questions-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>EVIDÊNCIAS AGREGADAS</Text><Text style={styles.h1}>Perguntas de maior atenção{pageIndex ? " · continuação" : ""}</Text>{pageIndex === 0 && <Text style={styles.intro}>Seleção de três a cinco perguntas por fator significativo, ordenada por percentual crítico, A+C, desfavorável, score e número da pergunta. Nenhuma resposta individual é apresentada.</Text>}{groups.map(({ factor, questions: groupQuestions }) => <View key={factor?.fator_codigo} style={styles.questionGroup} wrap={false}><View style={styles.questionHeader}><Text style={styles.questionTitle}>{factorName(factor)}</Text></View><QuestionTable questions={groupQuestions} /></View>)}</Page>)}

    {questionPages.map((groups, pageIndex) => <Page key={`questions-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>ANEXO TÉCNICO · RESULTADOS COLETIVOS</Text><Text style={styles.h1}>Resultados completos por pergunta{pageIndex ? " · continuação" : ""}</Text>{pageIndex === 0 && <Text style={styles.intro}>As 35 perguntas são apresentadas por fator, exclusivamente com indicadores agregados. “Desfav.” representa a proporção de respostas em sentido desfavorável conforme a pontuação da pergunta.</Text>}{groups.map(({ factor, questions: groupQuestions }) => <View key={factor?.fator_codigo} style={styles.questionGroup}><View style={styles.questionHeader}><Text style={styles.questionTitle}>{factorName(factor)} · {groupQuestions.length} perguntas</Text></View><QuestionTable questions={groupQuestions} /></View>)}</Page>)}

    {actionPages.map((pageActions, pageIndex) => <Page key={`actions-${pageIndex}`} size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>DA ANÁLISE À EXECUÇÃO</Text><Text style={styles.h1}>{significant.length ? "Plano de ação" : "Plano preventivo"}{pageIndex ? " · continuação" : ""}</Text>{pageIndex === 0 && <Text style={styles.intro}>As medidas abaixo orientam a organização sobre o que fazer, como implementar, quem deve liderar, quais evidências manter e como verificar a eficácia.</Text>}{pageActions.length ? pageActions.map((action, index) => { const number = actionPages.slice(0, pageIndex).reduce((sum, page) => sum + page.length, 0) + index + 1; const titulo = fixTypos(action?.titulo) || `Ação ${number}`; const acaoDesc = fixTypos(action?.acao); const showAcao = !isRedundantAction(titulo, acaoDesc); return <View key={action?.id || number} style={styles.actionCard}><View style={styles.actionHeader} wrap={false}><Text style={styles.actionNo}>{number}</Text><Text style={styles.actionTitle}>{titulo}</Text></View><View style={styles.actionBody}><View style={styles.actionGrid}><View style={styles.actionField}><Text style={styles.actionLabel}>Fatores relacionados</Text><Text style={styles.actionValue}>{list(action?.fatores).map((code) => FACTOR_LABELS[code] || code).join("; ") || "Medida transversal"}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Nível e prioridade</Text><Text style={styles.actionValue}>{[clean(action?.nivel), riskLabel(action?.prioridade)].filter(Boolean).join(" · ")}</Text></View></View>{usable(action?.objetivo) && <><Text style={styles.actionLabel}>Objetivo</Text><Text style={styles.actionValue}>{fixTypos(action.objetivo)}</Text></>}{showAcao && <><Text style={styles.actionLabel}>O que fazer</Text><Text style={styles.actionValue}>{acaoDesc || "Aplicar a medida aprovada e registrar sua execução."}</Text></>}{list(action?.orientacoes_praticas).length > 0 && <><Text style={styles.actionLabel}>Como implementar</Text><BulletList items={list(action.orientacoes_praticas)} /></>}{list(action?.exemplos_aplicacao).length > 0 && <><Text style={[styles.actionLabel, { marginTop: 5 }]}>Exemplos de aplicação</Text><BulletList items={list(action.exemplos_aplicacao)} /></>}<View style={[styles.actionGrid, { marginTop: 6 }]}><View style={styles.actionField}><Text style={styles.actionLabel}>Responsável sugerido</Text><Text style={styles.actionValue}>{fixTypos(action?.responsavel) || "Gestão da unidade e RH"}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Prazo recomendado</Text><Text style={styles.actionValue}>{action?.prazo_dias ? `Até ${action.prazo_dias} dias` : `Até ${deadlineFor(action?.prioridade)} dias`}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Abrangência</Text><Text style={styles.actionValue}>{fixTypos(action?.abrangencia || action?.grupo) || "Organização"}</Text></View><View style={styles.actionField}><Text style={styles.actionLabel}>Como comprovar</Text><Text style={styles.actionValue}>{evidenceText(action?.evidencias)}</Text></View></View><Text style={styles.actionLabel}>Indicador de eficácia</Text><Text style={styles.actionValue}>{fixTypos(action?.indicador_eficacia) || "Verificar implantação, percepção das equipes e evolução do fator em reavaliação posterior."}</Text></View></View>; }) : <View style={styles.infoPanel}><Text>Manter os controles preventivos, registrar mudanças relevantes no trabalho e programar reavaliação no ciclo definido pela organização.</Text></View>}</Page>)}

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>SÍNTESE PROFISSIONAL APROVADA</Text><Text style={styles.h1}>Parecer técnico conclusivo</Text><Text style={styles.intro}>Integração dos resultados coletivos, do contexto informado, das prioridades e das medidas aprovadas pelo responsável técnico.</Text>{[["Síntese dos resultados", "sintese_resultados"], ["Interpretação integrada", "interpretacao_integrada"], ["Prioridades de intervenção", "prioridades_intervencao"], ["Recomendações", "recomendacoes"], ["Limitações", "limitacoes"], ["Conclusão", "conclusao"]].map(([label, key]) => <View key={key} style={styles.opinionSection}><Text style={styles.h3}>{label}</Text><Text>{clean(opinion?.[key], key === "limitacoes" ? clean(review?.limitacoes, "Os resultados são coletivos e não constituem diagnóstico individual.") : clean(review?.conclusao, "Parecer registrado na revisão técnica aprovada."))}</Text></View>)}<View style={styles.infoPanel}><Text style={styles.note}>A HSE recomenda e orienta as medidas técnicas. A definição de responsáveis, recursos e implementação compete à empresa, salvo contratação específica. Este relatório deve subsidiar a AEP, o Inventário de Riscos e o Plano de Ação do PGR, conforme aplicável, sem substituir esses documentos.</Text></View></Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>METODOLOGIA, LIMITES E CONTROLE</Text><Text style={styles.h1}>Como a conclusão foi construída</Text><Text style={styles.intro}>A metodologia combina cálculo estruturado, indicadores coletivos e revisão profissional, preservando a confidencialidade dos participantes.</Text><View style={styles.methodFlow}>{[["1", "Pontuação", "As alternativas recebem pesos de 0 a 4, conforme o sentido de cada pergunta."], ["2", "Consolidação", "Scores e percentuais são calculados por pergunta e por fator."], ["3", "Significância", "Os três critérios percentuais são avaliados de forma independente."], ["4", "Revisão", "O profissional confronta resultados, contexto e plano antes de aprovar."]].map(([no, title, text]) => <View key={no} style={styles.methodStep} wrap={false}><Text style={styles.methodNo}>{no}</Text><Text style={styles.methodTitle}>{title}</Text><Text style={styles.methodText}>{text}</Text></View>)}</View><Text style={styles.h3}>Quando um fator é significativo</Text><View style={styles.criteriaRow}><View style={styles.criteriaCard}><Text style={styles.criteriaValue}>{principalLimit}%</Text><Text style={styles.criteriaText}>ou mais em M+A+C, conforme o operador configurado.</Text></View><View style={styles.criteriaCard}><Text style={styles.criteriaValue}>{aggravationLimit}%</Text><Text style={styles.criteriaText}>ou mais em A+C, conforme o operador configurado.</Text></View><View style={[styles.criteriaCard, { marginRight: 0 }]}><Text style={styles.criteriaValue}>{criticalLimit}%</Text><Text style={styles.criteriaText}>ou mais na faixa crítica, conforme o operador configurado.</Text></View></View><View style={styles.infoPanel}><Text style={styles.h3}>Limites da interpretação</Text><Text>{clean(opinion?.limitacoes || review?.limitacoes, "A avaliação representa a percepção coletiva no período analisado. Não permite diagnóstico individual, comprovação isolada de causalidade ou identificação de pessoas. Os achados devem ser confrontados com o trabalho real e acompanhados após a implantação das medidas.")}</Text></View><Text style={styles.h2}>Verificação da eficácia</Text><BulletList items={["confirmar se as medidas previstas foram efetivamente implantadas;", "verificar evidências documentais e a percepção das equipes;", "acompanhar indicadores relacionados ao trabalho e eventuais mudanças organizacionais;", "repetir a avaliação após período suficiente para observar mudanças."]} /></Page>

    <Page size="A4" style={styles.page}>{headerFooter}<Text style={styles.kicker}>RASTREABILIDADE E RESPONSABILIDADE</Text><Text style={styles.h1}>Controle técnico do documento</Text><View style={styles.table}><View style={styles.traceRow}><Text style={styles.traceKey}>Origem dos dados</Text><Text style={styles.traceValue}>{originLabel(origin)}</Text></View>{usable(assessment?.codigo) && <View style={styles.traceRow}><Text style={styles.traceKey}>Identificador interno</Text><Text style={styles.traceValue}>{clean(assessment.codigo)}</Text></View>}<View style={styles.traceRow}><Text style={styles.traceKey}>Código e revisão</Text><Text style={styles.traceValue}>{codigoRafp} · {codigoRev}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Versão do modelo</Text><Text style={styles.traceValue}>{REPORT_MODEL_CODE} v{REPORT_MODEL_VERSION}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Metodologia</Text><Text style={styles.traceValue}>{methodologyLabel}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Data da aprovação</Text><Text style={styles.traceValue}>{dateTime(review?.aprovada_em || responsible?.aprovado_em)}</Text></View><View style={styles.traceRow}><Text style={styles.traceKey}>Data da emissão</Text><Text style={styles.traceValue}>{dateTime(dataEmissao)}</Text></View>{review?.parecer_prompt_codigo && <View style={styles.traceRow}><Text style={styles.traceKey}>Assistência à minuta</Text><Text style={styles.traceValue}>{review.parecer_prompt_codigo} · conteúdo revisado e aprovado por responsável humano</Text></View>}</View>
      <Text style={styles.h2}>Responsabilidade técnica</Text><View style={styles.signatureBox}>{assinaturaDataUrl ? <Image src={assinaturaDataUrl} style={styles.signatureImage} /> : <View style={styles.signatureBlank} />}<View style={styles.signatureLine} /><Text style={{ marginTop: 5, fontFamily: "Helvetica-Bold", fontSize: 10 }}>{responsibleName}</Text>{usable(responsible?.cargo) ? <Text>{clean(responsible.cargo)}</Text> : null}{usable(registration) ? <Text>{registration}</Text> : null}{assinaturaDataUrl ? <Text style={[styles.note, { marginTop: 4 }]}>Assinatura reproduzida graficamente.</Text> : null}<Text style={[styles.note, { marginTop: 5 }]}>Conteúdo técnico aprovado no Portal HSE Consulting em {date(review?.aprovada_em || responsible?.aprovado_em)}. Documento emitido em {date(dataEmissao)}.</Text></View>
      {!preview && qrDataUrl && <View style={[styles.approval, { marginTop: 13 }]}><View style={{ flex: 1 }}><Text style={styles.h3}>Validação do documento</Text><Text style={styles.note}>Leia o QR Code para confirmar código RAFP, revisão, emissão, status, responsável técnico e versão do modelo. O relatório permanece em armazenamento privado.</Text><Text style={[styles.note, { marginTop: 4 }]}>Código de validação: {clean(codigoValidacao)}</Text></View><Image src={qrDataUrl} style={styles.qr} /></View>}
    </Page>
  </Document>;
}
