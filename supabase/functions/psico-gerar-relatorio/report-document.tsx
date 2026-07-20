// deno-lint-ignore-file no-explicit-any no-import-prefix no-unused-vars jsx-curly-braces
import React from "npm:react@18.3.1";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "npm:@react-pdf/renderer@3.4.5";
import { HSE_LOGO_GREEN_DATA_URL } from "./brand-assets.ts";

export const REPORT_MODEL_CODE = "HSE-PSICO-REL-1.0";
export const REPORT_MODEL_VERSION = "1.3.0";

export const REPORT_COLORS = {
  navy: "#0B2545",
  blue: "#176B87",
  teal: "#16A085",
  green: "#27864A",
  amber: "#D99000",
  orange: "#C55A11",
  red: "#B42318",
  ink: "#172033",
  muted: "#667085",
  line: "#D9E2EC",
  panel: "#F4F7FA",
  paleBlue: "#EAF2F8",
  paleGreen: "#EAF7EF",
  paleAmber: "#FFF6DB",
  paleRed: "#FDECEC",
  white: "#FFFFFF",
};

Font.registerHyphenationCallback((word) => [word]);

const FACTOR_LABELS: Record<string, string> = {
  carga_excessiva: "Carga excessiva de trabalho",
  falta_autonomia: "Falta de autonomia no trabalho",
  conflitos_hierarquicos: "Conflitos hierárquicos",
  relacoes_interpessoais: "Relações interpessoais",
  conflitos_interpessoais: "Conflitos interpessoais",
  falta_clareza: "Falta de clareza sobre responsabilidades",
  gestao_mudancas: "Gestão de mudanças",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 76,
    paddingBottom: 58,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 9.3,
    lineHeight: 1.42,
    color: REPORT_COLORS.ink,
    backgroundColor: REPORT_COLORS.white,
  },
  cover: { padding: 0, backgroundColor: REPORT_COLORS.white },
  coverBand: { height: 225, backgroundColor: REPORT_COLORS.navy, paddingHorizontal: 48, paddingTop: 34, overflow: "hidden" },
  coverShapeOne: { position: "absolute", width: 210, height: 210, backgroundColor: REPORT_COLORS.teal, opacity: 0.13, top: -105, right: -35, transform: "rotate(35deg)" },
  coverShapeTwo: { position: "absolute", width: 145, height: 145, backgroundColor: REPORT_COLORS.teal, opacity: 0.1, bottom: -95, left: -35, transform: "rotate(35deg)" },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coverLogo: { width: 112, height: 56, objectFit: "contain" },
  coverKicker: { marginTop: 43, fontSize: 9, color: "#7FE0CF", fontFamily: "Helvetica-Bold", letterSpacing: 1.8 },
  coverTitle: { marginTop: 8, width: 430, fontSize: 29, lineHeight: 1.08, color: REPORT_COLORS.white, fontFamily: "Helvetica-Bold" },
  coverBody: { paddingHorizontal: 48, paddingTop: 25 },
  clientLabel: { color: REPORT_COLORS.muted, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  clientName: { marginTop: 4, maxWidth: 490, fontSize: 19, lineHeight: 1.1, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold" },
  organizationCard: { marginTop: 10, padding: 11, borderRadius: 6, backgroundColor: REPORT_COLORS.panel, borderLeftWidth: 3, borderLeftColor: REPORT_COLORS.teal },
  organizationLine: { marginBottom: 3, fontSize: 8.7 },
  coverMetaGrid: { marginTop: 24, flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, paddingTop: 15 },
  coverMeta: { width: "50%", marginBottom: 15, paddingRight: 16 },
  metaLabel: { fontSize: 7.5, color: REPORT_COLORS.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.7 },
  metaValue: { marginTop: 3, fontSize: 10.2, color: REPORT_COLORS.ink },
  approval: { marginTop: 8, padding: 13, borderRadius: 6, backgroundColor: REPORT_COLORS.paleGreen, flexDirection: "row", alignItems: "center" },
  approvalDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: REPORT_COLORS.green, color: REPORT_COLORS.white, textAlign: "center", paddingTop: 6, fontFamily: "Helvetica-Bold" },
  approvalText: { flex: 1, marginLeft: 10 },
  qr: { width: 60, height: 60, marginLeft: 12 },
  header: { position: "absolute", top: 24, left: 42, right: 42, height: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.line },
  headerLogo: { width: 60, height: 25, objectFit: "contain" },
  headerMeta: { color: REPORT_COLORS.muted, fontSize: 7.5, textAlign: "right" },
  footer: { position: "absolute", bottom: 20, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, paddingTop: 6, color: REPORT_COLORS.muted, fontSize: 7 },
  watermark: { position: "absolute", top: "44%", left: 55, right: 55, color: REPORT_COLORS.red, opacity: 0.12, fontSize: 36, fontFamily: "Helvetica-Bold", textAlign: "center", transform: "rotate(-34deg)" },
  sectionKicker: { fontSize: 8, color: REPORT_COLORS.teal, fontFamily: "Helvetica-Bold", letterSpacing: 1.3, marginBottom: 4 },
  h1: { fontSize: 20, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", lineHeight: 1.15, marginBottom: 6 },
  h2: { fontSize: 12, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6 },
  h3: { fontSize: 10, color: REPORT_COLORS.ink, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  intro: { fontSize: 10, color: REPORT_COLORS.muted, marginBottom: 14, maxWidth: 470 },
  row: { flexDirection: "row" },
  kpi: { flex: 1, minHeight: 78, borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 7, padding: 10, marginRight: 7, backgroundColor: REPORT_COLORS.white },
  kpiLast: { marginRight: 0 },
  kpiValue: { fontSize: 19, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold" },
  kpiLabel: { marginTop: 4, fontSize: 7.4, color: REPORT_COLORS.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  decisionPanel: { borderLeftWidth: 5, borderLeftColor: REPORT_COLORS.teal, padding: 14, backgroundColor: REPORT_COLORS.paleBlue, marginBottom: 12 },
  decisionLabel: { fontSize: 7.5, color: REPORT_COLORS.teal, fontFamily: "Helvetica-Bold", letterSpacing: 0.8 },
  decisionTitle: { marginTop: 4, fontSize: 16, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold" },
  decisionText: { marginTop: 5, fontSize: 9.5 },
  secondaryIndex: { marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, color: REPORT_COLORS.muted, fontSize: 8 },
  callout: { borderRadius: 7, padding: 13, backgroundColor: REPORT_COLORS.paleBlue, marginTop: 12 },
  calloutTitle: { color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 5 },
  bullet: { flexDirection: "row", marginBottom: 5 },
  bulletNo: { width: 18, height: 18, borderRadius: 9, backgroundColor: REPORT_COLORS.teal, color: REPORT_COLORS.white, textAlign: "center", paddingTop: 3, fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  bulletText: { flex: 1, marginLeft: 7, paddingTop: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 7.5, color: REPORT_COLORS.muted },
  factorCard: { borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 7, padding: 10, marginBottom: 8, backgroundColor: REPORT_COLORS.white },
  factorTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  factorName: { width: "70%", fontSize: 10.5, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold" },
  pill: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, color: REPORT_COLORS.white, fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  scoreRow: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  scoreTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: REPORT_COLORS.line, marginRight: 8 },
  scoreFill: { height: 7, borderRadius: 4 },
  scoreText: { width: 42, textAlign: "right", fontSize: 8, color: REPORT_COLORS.muted },
  chart: { padding: 12, borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 7, backgroundColor: REPORT_COLORS.white },
  chartRow: { flexDirection: "row", alignItems: "center", marginBottom: 11 },
  chartLabel: { width: 135, paddingRight: 8, fontSize: 7.8, color: REPORT_COLORS.ink },
  chartTrack: { flex: 1, height: 13, flexDirection: "row", backgroundColor: REPORT_COLORS.line, overflow: "hidden" },
  chartSegment: { height: 13 },
  chartValue: { width: 118, paddingLeft: 7, fontSize: 6.9, color: REPORT_COLORS.muted },
  factorMeta: { flexDirection: "row", marginTop: 6 },
  factorMetaText: { fontSize: 7.8, color: REPORT_COLORS.muted, marginRight: 14 },
  detailCard: { borderTopWidth: 2, borderTopColor: REPORT_COLORS.amber, paddingVertical: 9, marginBottom: 7 },
  metricRow: { flexDirection: "row", marginTop: 6, paddingVertical: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: REPORT_COLORS.line },
  metricItem: { flex: 1, fontSize: 7.2, color: REPORT_COLORS.muted },
  metricValue: { fontFamily: "Helvetica-Bold", color: REPORT_COLORS.navy },
  actionCard: { borderTopWidth: 2, borderTopColor: REPORT_COLORS.teal, marginBottom: 10, paddingTop: 7 },
  actionHeader: { paddingBottom: 5, flexDirection: "row", alignItems: "center" },
  actionNo: { width: 22, height: 22, borderRadius: 11, backgroundColor: REPORT_COLORS.teal, color: REPORT_COLORS.white, textAlign: "center", paddingTop: 4, fontFamily: "Helvetica-Bold", fontSize: 8 },
  actionTitle: { flex: 1, marginLeft: 8, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold", fontSize: 10 },
  actionBody: { paddingBottom: 4 },
  actionDescription: { fontSize: 8.7, marginBottom: 6 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: REPORT_COLORS.panel, padding: 7 },
  actionField: { width: "50%", paddingRight: 8, marginBottom: 5 },
  actionLabel: { color: REPORT_COLORS.muted, fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  actionValue: { marginTop: 2, fontSize: 8.4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 7 },
  tag: { backgroundColor: REPORT_COLORS.paleBlue, color: REPORT_COLORS.blue, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, fontSize: 7.2, marginRight: 5, marginBottom: 4 },
  note: { color: REPORT_COLORS.muted, fontSize: 8.3 },
  infoPanel: { padding: 11, borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 6, marginBottom: 9 },
  keyValue: { flexDirection: "row", marginBottom: 4 },
  key: { width: 135, color: REPORT_COLORS.muted, fontSize: 8.2 },
  value: { flex: 1, fontSize: 8.6 },
  signBox: { marginTop: 14, padding: 13, backgroundColor: REPORT_COLORS.paleGreen, borderRadius: 6, borderLeftWidth: 4, borderLeftColor: REPORT_COLORS.green },
  methodFlow: { flexDirection: "row", marginBottom: 12 },
  methodStep: { flex: 1, minHeight: 74, padding: 7, marginRight: 6, borderRadius: 6, backgroundColor: REPORT_COLORS.panel, borderTopWidth: 3, borderTopColor: REPORT_COLORS.teal },
  methodStepLast: { marginRight: 0 },
  methodNo: { fontFamily: "Helvetica-Bold", fontSize: 15, color: REPORT_COLORS.teal },
  methodTitle: { marginTop: 3, fontFamily: "Helvetica-Bold", fontSize: 8.4, color: REPORT_COLORS.navy },
  methodText: { marginTop: 3, fontSize: 7.2, color: REPORT_COLORS.muted },
  criteriaRow: { flexDirection: "row", marginTop: 7 },
  criteriaCard: { flex: 1, padding: 9, marginRight: 6, borderRadius: 6, backgroundColor: REPORT_COLORS.paleBlue },
  criteriaValue: { fontFamily: "Helvetica-Bold", fontSize: 13, color: REPORT_COLORS.navy },
  criteriaText: { marginTop: 3, fontSize: 7.4, color: REPORT_COLORS.muted },
  aboutPanel: { marginTop: 8, padding: 9, borderRadius: 7, backgroundColor: REPORT_COLORS.navy, color: REPORT_COLORS.white },
  aboutLogo: { width: 52, height: 25, objectFit: "contain", marginBottom: 4 },
  aboutText: { fontSize: 7.3, color: "#D8E4EF" },
  contactText: { marginTop: 4, fontSize: 7.1, color: "#AEEBDD" },
});

function clean(value: unknown, fallback = "Não informado"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function date(value: unknown): string {
  if (!value) return "Não informado";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? clean(value) : parsed.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function dateTime(value: unknown): string {
  if (!value) return "Não informado";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? clean(value) : parsed.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function factorName(factor: any): string {
  return clean(factor?.fator_nome || FACTOR_LABELS[factor?.fator_codigo] || factor?.fator_codigo, "Fator não identificado");
}

function riskColor(value: unknown): string {
  const key = clean(value, "").toLocaleLowerCase("pt-BR");
  if (key.includes("crít") || key.includes("crit")) return REPORT_COLORS.red;
  if (key.includes("alto") || key.includes("alta")) return REPORT_COLORS.orange;
  if (key.includes("méd") || key.includes("med")) return REPORT_COLORS.amber;
  if (key.includes("baixo")) return REPORT_COLORS.green;
  return REPORT_COLORS.teal;
}

function riskLabel(value: unknown, fallback = "Monitoramento"): string {
  const raw = clean(value, fallback);
  const withoutRisk = raw.replace(/^Risco\s+/i, "");
  const key = withoutRisk.toLocaleLowerCase("pt-BR");
  if (key === "critica" || key === "crítica") return "Crítica";
  if (key === "alta") return "Alta";
  if (key === "media" || key === "média") return "Média";
  if (key === "baixo") return "Baixo";
  if (key === "irrelevante") return "Irrelevante";
  if (key === "monitoramento") return "Monitoramento";
  return withoutRisk.charAt(0).toLocaleUpperCase("pt-BR") + withoutRisk.slice(1);
}

function formatCnpj(value: unknown): string {
  const digits = clean(value, "").replace(/\D/g, "");
  if (digits.length !== 14) return clean(value);
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function organizationAddress(cliente: any): string {
  const base = clean(cliente?.endereco, "");
  const normalized = base.toLocaleLowerCase("pt-BR").replace(/\W/g, "");
  const number = clean(cliente?.numero, "");
  const complement = clean(cliente?.complemento, "");
  const street = [base,
    number && !normalized.includes(number.toLocaleLowerCase("pt-BR").replace(/\W/g, "")) ? number : null,
    complement && !normalized.includes(complement.toLocaleLowerCase("pt-BR").replace(/\W/g, "")) ? complement : null,
  ].filter(Boolean).join(", ");
  const city = [cliente?.bairro, cliente?.cidade, cliente?.uf].filter(Boolean).join(" · ");
  return [street, city, cliente?.cep ? `CEP ${clean(cliente.cep)}` : null].filter(Boolean).join(" — ");
}

function usable(value: unknown): boolean {
  const text = clean(value, "").toLocaleLowerCase("pt-BR");
  return !!text && !["não informado", "nao informado", "não aplicável", "nao aplicavel", "n/a", "—"].includes(text);
}

function sampleLabel(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "Amostra não classificada";
  if (n <= 4) return "Amostra muito pequena - interpretar com cautela";
  if (n <= 9) return "Amostra de pequeno porte";
  return "Amostra regular para a metodologia interna";
}

function normalizedLimitations(value: unknown, responseCount: unknown): string {
  const text = clean(value, "Fotografia do período avaliado; interpretar em conjunto com observação do trabalho, escuta das equipes e demais dados de SST.");
  return text.replace(/amostra\s+reduzida/gi, sampleLabel(responseCount));
}

function assessmentLabel(assessment: any): string {
  const code = clean(assessment?.codigo, "");
  if (/^IMP-/i.test(code)) return "Dados históricos importados";
  return [code, clean(assessment?.titulo, "")].filter(Boolean).join(" · ") || "Avaliação registrada";
}

function priorityRank(value: unknown): number {
  const key = clean(value, "").toLocaleLowerCase("pt-BR");
  if (key.includes("crít") || key.includes("crit")) return 4;
  if (key.includes("alta")) return 3;
  if (key.includes("méd") || key.includes("med")) return 2;
  return 1;
}

function HeaderFooter({ code, revision, preview, logoSrc }: { code: string; revision: string; preview: boolean; logoSrc: string }) {
  return <>
    <View style={styles.header}>
      <Image src={logoSrc} style={styles.headerLogo} />
      <Text style={styles.headerMeta}>{code} · {revision}{"\n"}Modelo {REPORT_MODEL_VERSION}</Text>
    </View>
    <View style={styles.footer}>
      <Text>Documento técnico controlado · análise organizacional agregada</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} de ${totalPages}`} />
    </View>
    {preview && <Text style={styles.watermark}>PRÉVIA · SEM VALIDADE</Text>}
  </>;
}

function Meta({ label, value }: { label: string; value: unknown }) {
  return <View style={styles.coverMeta}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue}>{clean(value)}</Text>
  </View>;
}

function KeyValue({ label, value }: { label: string; value: unknown }) {
  return <View style={styles.keyValue}>
    <Text style={styles.key}>{label}</Text>
    <Text style={styles.value}>{clean(value)}</Text>
  </View>;
}

function Kpi({ value, label, last = false, color }: { value: unknown; label: string; last?: boolean; color?: string }) {
  return <View style={[styles.kpi, last ? styles.kpiLast : {}]}>
    <Text style={[styles.kpiValue, color ? { color } : {}]}>{clean(value, "—")}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>;
}

function FactorCard({ factor }: { factor: any }) {
  const score = Number(factor?.score_medio);
  const hasScore = Number.isFinite(score);
  const classification = factor?.classificacao || factor?.tratamento || factor?.prioridade;
  const color = riskColor(classification);
  const width = hasScore ? Math.max(2, Math.min(100, (score / 4) * 100)) : (factor?.significativo ? 70 : 25);
  return <View style={styles.factorCard} wrap={false}>
    <View style={styles.factorTop}>
      <Text style={styles.factorName}>{factorName(factor)}</Text>
      <Text style={[styles.pill, { backgroundColor: color }]}>{riskLabel(classification)}</Text>
    </View>
    <View style={styles.scoreRow}>
      <View style={styles.scoreTrack}><View style={[styles.scoreFill, { width: `${width}%`, backgroundColor: color }]} /></View>
      <Text style={styles.scoreText}>{hasScore ? `${score.toFixed(2)} / 4` : "leitura técnica"}</Text>
    </View>
    <View style={styles.factorMeta}>
      <Text style={styles.factorMetaText}>{factor?.significativo ? "Requer tratamento" : "Manter monitoramento"}</Text>
      <Text style={styles.factorMetaText}>Prioridade: {riskLabel(factor?.prioridade)}</Text>
    </View>
  </View>;
}

function evidenceText(evidence: unknown): string {
  return Array.isArray(evidence) && evidence.length ? evidence.map((item) => clean(item)).join("; ") : "Definir evidência de conclusão no acompanhamento do plano.";
}

function chunkByWeight<T>(items: T[], maxWeight: number, weightOf: (item: T) => number): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentWeight = 0;
  for (const item of items) {
    const weight = Math.min(maxWeight, Math.max(1, weightOf(item)));
    if (current.length && currentWeight + weight > maxWeight) {
      chunks.push(current);
      current = [];
      currentWeight = 0;
    }
    current.push(item);
    currentWeight += weight;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function FactorChart({ factors }: { factors: any[] }) {
  return <View style={styles.chart}>
    {factors.map((factor, index) => {
      const score = Number(factor?.score_medio);
      const segments = [
        [Number(factor?.percentual_irrelevante || 0), "#86C89A"],
        [Number(factor?.percentual_baixo || 0), REPORT_COLORS.green],
        [Number(factor?.percentual_medio || 0), REPORT_COLORS.amber],
        [Number(factor?.percentual_alto || 0), REPORT_COLORS.orange],
        [Number(factor?.percentual_critico || 0), REPORT_COLORS.red],
      ] as const;
      return <View key={index} style={[styles.chartRow, index === factors.length - 1 ? { marginBottom: 0 } : {}]} wrap={false}>
        <Text style={styles.chartLabel}>{factorName(factor)}</Text>
        <View style={styles.chartTrack}>{segments.map(([value, color], segmentIndex) => value > 0
          ? <View key={segmentIndex} style={[styles.chartSegment, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} />
          : null)}</View>
        <Text style={styles.chartValue}>{riskLabel(factor?.classificacao)} · {Number.isFinite(score) ? score.toFixed(2) : "—"}{factor?.significativo ? " · ação recomendada" : " · monitoramento"}</Text>
      </View>;
    })}
  </View>;
}

export function PsychosocialReportDocument({
  snapshot, codigoRafp, codigoRev, codigoValidacao, cliente, empresa, dataEmissao, preview = false, qrDataUrl,
}: any) {
  const assessment = snapshot?.avaliacao || {};
  const review = snapshot?.revisao || {};
  const responsible = review?.responsavel || {};
  const result = snapshot?.resultado || {};
  const factors: any[] = Array.isArray(snapshot?.fatores) ? snapshot.fatores : [];
  const actions: any[] = Array.isArray(snapshot?.plano?.itens) ? snapshot.plano.itens : [];
  const attentionQuestions: any[] = Array.isArray(snapshot?.agregado?.perguntas_atencao) ? snapshot.agregado.perguntas_atencao : [];
  const significant = factors.filter((factor) => factor?.significativo);
  const sortedFactors = [...factors].sort((a, b) => priorityRank(b?.prioridade) - priorityRank(a?.prioridade));
  const highest = [...significant].sort((a, b) => priorityRank(b?.prioridade) - priorityRank(a?.prioridade))[0];
  const methodology = assessment?.metodologia || snapshot?.agregado?.processamento?.metodologia || snapshot?.biblioteca || {};
  const methodologyLabel = methodology?.codigo ? `${methodology.codigo} v${clean(methodology.versao, "—")}` : "Metodologia registrada no Portal HSE";
  const principalLimit = Number(methodology?.criterio_principal_percentual ?? 50);
  const aggravationLimit = Number(methodology?.criterio_agravamento_percentual ?? 30);
  const criticalLimit = Number(methodology?.criterio_critico_percentual ?? 10);
  const principalCriterionLabel = methodology?.criterio_principal_operador === ">"
    ? `Mais de ${principalLimit}%`
    : `${principalLimit}% ou mais`;
  const aggravationCriterionLabel = methodology?.criterio_agravamento_operador === ">"
    ? `Mais de ${aggravationLimit}%`
    : `${aggravationLimit}% ou mais`;
  const criticalCriterionLabel = methodology?.criterio_critico_operador === ">"
    ? `Mais de ${criticalLimit}%`
    : `${criticalLimit}% ou mais`;
  const responsibleName = responsible?.nome_responsavel || responsible?.nome || "Responsável técnico não informado";
  const generalClass = result?.classificacao_indice_geral || (highest ? highest?.classificacao || highest?.tratamento : "Monitoramento");
  const generalColor = riskColor(generalClass);
  const responseCount = result?.total_participantes ?? result?.total_respostas ?? "—";
  const generalScore = Number(result?.indice_geral_descritivo);
  const detailFactors = significant;
  const detailChunks = chunkByWeight(detailFactors, 470, (factor: any) =>
    115 + Math.ceil(clean(factor?.observacao || factor?.justificativa || factor?.tratamento, "").length / 115) * 12
  );
  const detailPages = detailChunks.length ? detailChunks : [[]];
  const actionChunks = chunkByWeight(actions, 480, (action: any) =>
    125 + Math.ceil((clean(action?.acao, "").length + evidenceText(action?.evidencias).length) / 130) * 12
  );
  const actionPages = actionChunks.length ? actionChunks : [[]];
  const logoSrc = empresa?.logo_url || HSE_LOGO_GREEN_DATA_URL;
  const companyContacts = [empresa?.telefone, empresa?.email, empresa?.site].filter(Boolean).join("  ·  ");
  const registration = usable(responsible?.registro_profissional) ? clean(responsible.registro_profissional) : "";
  const address = organizationAddress(cliente);

  return <Document
    title={`Relatório ${codigoRafp} ${codigoRev}`}
    author="HSE Consulting"
    subject="Avaliação de Fatores Psicossociais"
    creator="Portal HSE"
    producer="Portal HSE"
  >
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverBand}>
        <View style={styles.coverShapeOne} />
        <View style={styles.coverShapeTwo} />
        <View style={styles.brandRow}>
          <Image src={logoSrc} style={styles.coverLogo} />
          <Text style={{ color: "#C8D8E8", fontSize: 8 }}>SAÚDE · SEGURANÇA · GESTÃO</Text>
        </View>
        <Text style={styles.coverKicker}>RELATÓRIO TÉCNICO</Text>
        <Text style={styles.coverTitle}>Avaliação de Fatores Psicossociais</Text>
      </View>
      <View style={styles.coverBody}>
        <Text style={styles.clientLabel}>ORGANIZAÇÃO AVALIADA</Text>
        <Text style={styles.clientName}>{clean(cliente?.nome)}</Text>
        {(usable(cliente?.razao_social) || usable(cliente?.cnpj_cpf) || address) && <View style={styles.organizationCard}>
          {usable(cliente?.razao_social) && <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Razão social: </Text>{clean(cliente?.razao_social)}</Text>}
          {usable(cliente?.cnpj_cpf) && <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>CNPJ: </Text>{formatCnpj(cliente?.cnpj_cpf)}</Text>}
          {address && <Text style={styles.organizationLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Endereço: </Text>{address}</Text>}
        </View>}
        <View style={styles.coverMetaGrid}>
          <Meta label="Relatório e revisão" value={`${codigoRafp} · ${codigoRev}`} />
          <Meta label={/^IMP-/i.test(clean(assessment?.codigo, "")) ? "Origem da avaliação" : "Avaliação"} value={assessmentLabel(assessment)} />
          <Meta label="Período analisado" value={`${date(assessment?.periodo?.inicio)} a ${date(assessment?.periodo?.fim)}`} />
          <Meta label="Emissão" value={date(dataEmissao)} />
          <Meta label="Metodologia" value={methodologyLabel} />
          <Meta label="Modelo do documento" value={`${REPORT_MODEL_CODE} v${REPORT_MODEL_VERSION}`} />
        </View>
        <View style={styles.approval}>
          <Text style={[styles.approvalDot, { fontSize: 7 }]}>OK</Text>
          <View style={styles.approvalText}>
            <Text style={{ color: REPORT_COLORS.green, fontFamily: "Helvetica-Bold", fontSize: 9 }}>APROVADO TECNICAMENTE</Text>
            <Text style={{ marginTop: 3, fontFamily: "Helvetica-Bold" }}>{clean(responsibleName)}</Text>
            <Text style={styles.note}>{[clean(responsible?.cargo, "Responsável técnico"), registration].filter(Boolean).join(" · ")}</Text>
          </View>
          {!preview && qrDataUrl && <Image src={qrDataUrl} style={styles.qr} />}
        </View>
        <Text style={[styles.note, { marginTop: 12 }]}>Validação: {clean(codigoValidacao)}. O QR Code confirma a autenticidade deste documento.</Text>
        {companyContacts && <Text style={[styles.contactText, { color: REPORT_COLORS.muted, marginTop: 8 }]}>{companyContacts}</Text>}
      </View>
      {preview && <Text style={styles.watermark}>PRÉVIA · SEM VALIDADE</Text>}
    </Page>

    <Page size="A4" style={styles.page}>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} logoSrc={logoSrc} />
      <Text style={styles.sectionKicker}>LEITURA RÁPIDA</Text>
      <Text style={styles.h1}>Resumo executivo</Text>
      <Text style={styles.intro}>Síntese dos resultados e das providências recomendadas para orientar a tomada de decisão da organização.</Text>
      <View style={[styles.decisionPanel, { borderLeftColor: highest ? riskColor(highest?.prioridade) : REPORT_COLORS.green }]}>
        <Text style={styles.decisionLabel}>DECISÃO TÉCNICA</Text>
        <Text style={styles.decisionTitle}>{significant.length
          ? `${significant.length} ${significant.length === 1 ? "fator significativo requer" : "fatores significativos requerem"} intervenção`
          : "Manter prevenção e monitoramento periódico"}</Text>
        <Text style={styles.decisionText}>{clean(review?.conclusao, significant.length
          ? "A análise identificou fatores que requerem medidas organizacionais e acompanhamento de eficácia."
          : "Os fatores avaliados permaneceram abaixo dos critérios de significância no período analisado.")}</Text>
        {Number.isFinite(generalScore) && <Text style={styles.secondaryIndex}>Índice geral descritivo: {generalScore.toFixed(2)} / 4 - informação complementar que, isoladamente, não determina a significância.</Text>}
      </View>
      <View style={styles.row}>
        <Kpi value={responseCount} label="participantes analisados" />
        <Kpi value={significant.length} label="fatores significativos" />
        <Kpi value={highest ? `Prioridade ${riskLabel(highest?.prioridade)}` : "Monitoramento"} label="encaminhamento" last color={highest ? riskColor(highest?.prioridade) : REPORT_COLORS.green} />
      </View>

      <Text style={styles.h2}>O que fazer agora</Text>
      {actions.length ? actions.slice(0, 3).map((action, index) => <View key={index} style={styles.bullet} wrap={false}>
        <Text style={styles.bulletNo}>{index + 1}</Text>
        <Text style={styles.bulletText}><Text style={{ fontFamily: "Helvetica-Bold" }}>{action?.prazo_dias ? `Até ${action.prazo_dias} dias - ` : "Prazo a definir - "}{clean(action?.titulo, `Medida ${index + 1}`)}.</Text> {action?.acao && clean(action.acao) !== clean(action.titulo) ? clean(action.acao) : "Implantar a medida e registrar sua eficácia."}</Text>
      </View>) : <Text style={styles.note}>Manter os controles existentes, acompanhar os indicadores e programar nova avaliação conforme o ciclo de acompanhamento dos fatores.</Text>}

      <Text style={styles.h2}>Faixas de classificação</Text>
      <View style={styles.legend}>
        {[["Irrelevante", "#86C89A"], ["Baixo", REPORT_COLORS.green], ["Médio", REPORT_COLORS.amber], ["Alto", REPORT_COLORS.orange], ["Crítico", REPORT_COLORS.red]].map(([label, color]) => <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text>
        </View>)}
      </View>

      <View style={[styles.infoPanel, { marginTop: 18, backgroundColor: REPORT_COLORS.panel }]}>
        <Text style={styles.h3}>Nota de interpretação</Text>
        <Text style={styles.note}>Os resultados representam condições organizacionais percebidas pelo grupo. Não constituem diagnóstico psicológico individual, não identificam respondentes e devem ser analisados junto às características reais do trabalho.</Text>
      </View>
    </Page>

    <Page size="A4" style={styles.page} wrap>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} logoSrc={logoSrc} />
      <Text style={styles.sectionKicker}>PANORAMA DOS FATORES</Text>
      <Text style={styles.h1}>Distribuição das respostas por fator</Text>
      <Text style={styles.intro}>Cada barra representa 100% das respostas válidas do fator. A concentração nas faixas média, alta e crítica explica a significância; o índice médio aparece apenas como informação complementar.</Text>
      {sortedFactors.length ? <FactorChart factors={sortedFactors} /> : <View style={styles.infoPanel}><Text>Nenhum resultado por fator foi disponibilizado no snapshot aprovado.</Text></View>}
      <View style={[styles.infoPanel, { marginTop: 12, backgroundColor: REPORT_COLORS.panel }]}>
        <Text style={styles.h3}>Leitura objetiva</Text>
        <Text>{significant.length
          ? `${significant.length} de ${factors.length} fatores atenderam a pelo menos um critério de significância e requerem intervenção conforme a prioridade técnica e o plano de ação.`
          : `Nenhum dos ${factors.length} fatores atendeu aos critérios de significância. O resultado orienta a manutenção das medidas preventivas e o acompanhamento periódico.`}</Text>
      </View>
      <View style={styles.legend}>
        {[["Irrelevante", "#86C89A"], ["Baixo", REPORT_COLORS.green], ["Médio", REPORT_COLORS.amber], ["Alto", REPORT_COLORS.orange], ["Crítico", REPORT_COLORS.red]].map(([label, color]) => <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text>
        </View>)}
      </View>
    </Page>

    {significant.length > 0 && detailPages.map((pageFactors, pageIndex) => <Page key={`detail-${pageIndex}`} size="A4" style={styles.page}>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} logoSrc={logoSrc} />
      <Text style={styles.sectionKicker}>ANÁLISE TÉCNICA</Text>
      <Text style={styles.h1}>{significant.length ? "Fatores que exigem atenção" : "Acompanhamento preventivo"}{pageIndex ? " · continuação" : ""}</Text>
      <Text style={styles.intro}>{significant.length ? "Análise dos fatores que atenderam aos critérios de significância, com a justificativa técnica aprovada." : "Como não houve fator significativo, esta seção registra a orientação preventiva e o ciclo de acompanhamento recomendado."}</Text>
      {pageFactors.length ? pageFactors.map((factor, index) => <View key={index} style={[styles.detailCard, { borderTopColor: riskColor(factor?.prioridade || factor?.classificacao) }]} wrap={false}>
          <View style={styles.factorTop}>
            <Text style={styles.factorName}>{factorName(factor)}</Text>
            <Text style={[styles.pill, { backgroundColor: riskColor(factor?.prioridade) }]}>Prioridade {riskLabel(factor?.prioridade)}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricItem}>Índice <Text style={styles.metricValue}>{Number(factor?.score_medio).toFixed(2)}</Text></Text>
            <Text style={styles.metricItem}>M+A+C <Text style={styles.metricValue}>{Number(factor?.percentual_medio_alto_critico || 0).toFixed(1)}%</Text></Text>
            <Text style={styles.metricItem}>A+C <Text style={styles.metricValue}>{Number(factor?.percentual_alto_critico || 0).toFixed(1)}%</Text></Text>
            <Text style={styles.metricItem}>Crítico <Text style={styles.metricValue}>{Number(factor?.percentual_critico || 0).toFixed(1)}%</Text></Text>
          </View>
          <Text style={[styles.h3, { marginTop: 6 }]}>Interpretação e direcionamento</Text>
          <Text>{clean(factor?.observacao || factor?.justificativa || factor?.tratamento, factor?.significativo ? "O fator requer medida de controle conforme o plano aprovado." : "Manter os controles e acompanhar a evolução do fator.")}</Text>
          {attentionQuestions.filter((question) => question?.fator_nome === factorName(factor)).slice(0, 2).map((question, questionIndex) => <Text key={questionIndex} style={[styles.note, { marginTop: 4 }]}><Text style={{ fontFamily: "Helvetica-Bold" }}>Q{question?.numero}: </Text>{clean(question?.enunciado || question?.texto, "Item de maior atenção no fator")}</Text>)}
        </View>) : <View style={styles.infoPanel}><Text>Não foram identificados fatores significativos nesta avaliação. Recomenda-se preservar os controles existentes, manter canais de escuta e repetir a avaliação no ciclo definido pela gestão de SST.</Text></View>}
      {pageIndex === detailPages.length - 1 && <View style={[styles.callout, { marginTop: 8 }]}>
        <Text style={styles.calloutTitle}>Decisão técnica</Text>
        <Text>{clean(review?.recomendacao_geral, significant.length ? "Tratar primeiro os fatores de maior prioridade, comunicar as medidas às equipes e verificar a eficácia dos controles." : "Manter os controles preventivos e acompanhar a evolução dos fatores no ciclo definido pela gestão de SST.")}</Text>
      </View>}
    </Page>)}

    {actionPages.map((pageActions, pageIndex) => <Page key={`actions-${pageIndex}`} size="A4" style={styles.page}>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} logoSrc={logoSrc} />
      <Text style={styles.sectionKicker}>DA ANÁLISE À EXECUÇÃO</Text>
      <Text style={styles.h1}>{significant.length ? "Plano de ação prioritário" : "Plano de monitoramento preventivo"}{pageIndex ? " · continuação" : ""}</Text>
      <Text style={styles.intro}>{pageIndex ? "Continuação das medidas aprovadas, com responsáveis, prazos e formas de comprovação." : significant.length ? "Medidas para intervenção nos fatores significativos. A organização deve registrar a implantação e verificar a eficácia." : "Medidas preventivas para preservar os resultados e acompanhar mudanças nas condições de trabalho."}</Text>
      {pageActions.length ? pageActions.map((action, index) => {
        const actionNumber = actionPages.slice(0, pageIndex).reduce((total, page) => total + page.length, 0) + index + 1;
        const description = clean(action?.acao, "Executar a ação conforme definida na revisão técnica.");
        const showDescription = description !== clean(action?.titulo, "");
        return <View key={index} style={styles.actionCard} wrap={false}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionNo}>{actionNumber}</Text>
            <Text style={styles.actionTitle}>{clean(action?.titulo, `Ação ${actionNumber}`)}</Text>
          </View>
          <View style={styles.actionBody}>
            {showDescription && <Text style={styles.actionDescription}>{description}</Text>}
            <View style={styles.actionGrid}>
              <View style={styles.actionField}><Text style={styles.actionLabel}>Responsável</Text><Text style={styles.actionValue}>{clean(action?.responsavel, "A definir pela organização")}</Text></View>
              <View style={styles.actionField}><Text style={styles.actionLabel}>Prazo recomendado</Text><Text style={styles.actionValue}>{action?.prazo_dias ? `Até ${action.prazo_dias} dias` : "Definir no cronograma"}</Text></View>
              <View style={styles.actionField}><Text style={styles.actionLabel}>Abrangência</Text><Text style={styles.actionValue}>{clean(action?.abrangencia || action?.grupo, "Organização")}</Text></View>
              <View style={styles.actionField}><Text style={styles.actionLabel}>Como comprovar</Text><Text style={styles.actionValue}>{evidenceText(action?.evidencias)}</Text></View>
            </View>
            {Array.isArray(action?.fatores) && action.fatores.length > 0 && <View style={styles.tagRow}>{action.fatores.map((code: string) => <Text key={code} style={styles.tag}>{FACTOR_LABELS[code] || clean(code)}</Text>)}</View>}
          </View>
        </View>;
      }) : <View style={styles.infoPanel}><Text>Nenhuma ação foi selecionada. Se não houver fatores significativos, registre os controles preventivos e o ciclo de monitoramento.</Text></View>}
    </Page>)}

    <Page size="A4" style={styles.page}>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} logoSrc={logoSrc} />
      <Text style={styles.sectionKicker}>BASE TÉCNICA E CONTROLE</Text>
      <Text style={styles.h1}>Como os resultados foram obtidos</Text>
      <Text style={styles.intro}>A metodologia transforma as respostas em indicadores coletivos, preserva a confidencialidade e combina cálculo estruturado com revisão profissional.</Text>
      <View style={styles.methodFlow}>
        {[
          ["1", "Respostas", "As alternativas recebem pesos de 0 a 4, considerando o sentido de cada pergunta."],
          ["2", "Consolidação", "Os pesos são agrupados por fator e apresentados como índice médio e percentuais."],
          ["3", "Significância", "Um fator é significativo quando atende a pelo menos um dos três critérios abaixo."],
          ["4", "Revisão técnica", "O profissional interpreta o contexto, define prioridades e aprova o plano de ação."],
        ].map(([no, title, text], index) => <View key={no} style={[styles.methodStep, index === 3 ? styles.methodStepLast : {}]} wrap={false}>
          <Text style={styles.methodNo}>{no}</Text><Text style={styles.methodTitle}>{title}</Text><Text style={styles.methodText}>{text}</Text>
        </View>)}
      </View>
      <Text style={styles.h3}>Quando um fator é considerado significativo</Text>
      <View style={styles.criteriaRow}>
        <View style={styles.criteriaCard}><Text style={styles.criteriaValue}>{principalCriterionLabel}</Text><Text style={styles.criteriaText}>das respostas do fator estão nas faixas média, alta ou crítica.</Text></View>
        <View style={styles.criteriaCard}><Text style={styles.criteriaValue}>{aggravationCriterionLabel}</Text><Text style={styles.criteriaText}>das respostas do fator estão nas faixas alta ou crítica.</Text></View>
        <View style={[styles.criteriaCard, { marginRight: 0 }]}><Text style={styles.criteriaValue}>{criticalCriterionLabel}</Text><Text style={styles.criteriaText}>das respostas do fator estão na faixa crítica.</Text></View>
      </View>
      <View style={[styles.infoPanel, { marginTop: 12 }]}>
        <Text style={styles.h3}>Escala e contexto da análise</Text>
        <Text style={{ marginBottom: 7 }}>Aplicou-se {methodologyLabel}. O índice varia de 0 a 4 e ajuda a comparar os fatores; sozinho, ele não define significância. A decisão considera os percentuais acima e a revisão técnica.</Text>
        <KeyValue label="Participantes analisados" value={responseCount} />
        <KeyValue label="Porte da amostra" value={sampleLabel(responseCount)} />
        <KeyValue label="Período" value={`${date(assessment?.periodo?.inicio)} a ${date(assessment?.periodo?.fim)}`} />
        <KeyValue label="Limitações" value={normalizedLimitations(review?.limitacoes, responseCount)} />
        {/^(IMP-)/i.test(clean(assessment?.codigo, "")) && <KeyValue label="Identificador de rastreabilidade" value={assessment?.codigo} />}
      </View>
      <View style={styles.signBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", color: REPORT_COLORS.green }}>APROVAÇÃO TÉCNICA REGISTRADA</Text>
        <Text style={{ marginTop: 5, fontFamily: "Helvetica-Bold" }}>{clean(responsibleName)}</Text>
        <Text>{[clean(responsible?.cargo, "Responsável técnico"), registration].filter(Boolean).join(" · ")}</Text>
        <Text style={[styles.note, { marginTop: 4 }]}>Aprovado em {dateTime(review?.aprovada_em)} · Validação {clean(codigoValidacao)}</Text>
      </View>
      <Text style={[styles.note, { marginTop: 7 }]}>Este documento registra uma avaliação de fatores psicossociais relacionados ao trabalho. Não substitui avaliação clínica individual, diagnóstico de saúde ou prontuário. O conteúdo emitido é versionado e sua autenticidade pode ser verificada pelo código constante na capa.</Text>
    </Page>
  </Document>;
}
