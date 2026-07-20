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

export const REPORT_MODEL_CODE = "HSE-PSICO-REL-1.0";
export const REPORT_MODEL_VERSION = "1.1.0";

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
  coverBand: { height: 205, backgroundColor: REPORT_COLORS.navy, paddingHorizontal: 48, paddingTop: 38 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandMark: { fontFamily: "Helvetica-Bold", fontSize: 24, color: REPORT_COLORS.teal, letterSpacing: -1 },
  brandName: { fontSize: 8, color: "#C8D8E8", letterSpacing: 1.2 },
  coverKicker: { marginTop: 43, fontSize: 9, color: "#7FE0CF", fontFamily: "Helvetica-Bold", letterSpacing: 1.8 },
  coverTitle: { marginTop: 8, width: 430, fontSize: 29, lineHeight: 1.08, color: REPORT_COLORS.white, fontFamily: "Helvetica-Bold" },
  coverBody: { paddingHorizontal: 48, paddingTop: 30 },
  clientLabel: { color: REPORT_COLORS.muted, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  clientName: { marginTop: 4, fontSize: 20, color: REPORT_COLORS.navy, fontFamily: "Helvetica-Bold" },
  coverMetaGrid: { marginTop: 24, flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: REPORT_COLORS.line, paddingTop: 15 },
  coverMeta: { width: "50%", marginBottom: 15, paddingRight: 16 },
  metaLabel: { fontSize: 7.5, color: REPORT_COLORS.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.7 },
  metaValue: { marginTop: 3, fontSize: 10.2, color: REPORT_COLORS.ink },
  approval: { marginTop: 8, padding: 13, borderRadius: 6, backgroundColor: REPORT_COLORS.paleGreen, flexDirection: "row", alignItems: "center" },
  approvalDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: REPORT_COLORS.green, color: REPORT_COLORS.white, textAlign: "center", paddingTop: 6, fontFamily: "Helvetica-Bold" },
  approvalText: { flex: 1, marginLeft: 10 },
  qr: { width: 60, height: 60, marginLeft: 12 },
  header: { position: "absolute", top: 24, left: 42, right: 42, height: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.line },
  headerBrand: { fontFamily: "Helvetica-Bold", color: REPORT_COLORS.navy, fontSize: 9 },
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
  factorMeta: { flexDirection: "row", marginTop: 6 },
  factorMetaText: { fontSize: 7.8, color: REPORT_COLORS.muted, marginRight: 14 },
  detailCard: { borderLeftWidth: 4, borderLeftColor: REPORT_COLORS.amber, backgroundColor: REPORT_COLORS.panel, padding: 11, marginBottom: 9, borderRadius: 5 },
  actionCard: { borderWidth: 1, borderColor: REPORT_COLORS.line, borderRadius: 7, marginBottom: 10, overflow: "hidden" },
  actionHeader: { backgroundColor: REPORT_COLORS.navy, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  actionNo: { width: 22, height: 22, borderRadius: 11, backgroundColor: REPORT_COLORS.teal, color: REPORT_COLORS.white, textAlign: "center", paddingTop: 4, fontFamily: "Helvetica-Bold", fontSize: 8 },
  actionTitle: { flex: 1, marginLeft: 8, color: REPORT_COLORS.white, fontFamily: "Helvetica-Bold", fontSize: 10 },
  actionBody: { padding: 11 },
  actionDescription: { fontSize: 9.2, marginBottom: 8 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: REPORT_COLORS.panel, padding: 8, borderRadius: 5 },
  actionField: { width: "50%", paddingRight: 9, marginBottom: 7 },
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
  return raw.replace(/^Risco\s+/i, "");
}

function priorityRank(value: unknown): number {
  const key = clean(value, "").toLocaleLowerCase("pt-BR");
  if (key.includes("crít") || key.includes("crit")) return 4;
  if (key.includes("alta")) return 3;
  if (key.includes("méd") || key.includes("med")) return 2;
  return 1;
}

function HeaderFooter({ code, revision, preview }: { code: string; revision: string; preview: boolean }) {
  return <>
    <View style={styles.header}>
      <Text style={styles.headerBrand}>HSE CONSULTING  |  FATORES PSICOSSOCIAIS</Text>
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
  const width = hasScore ? Math.max(4, Math.min(100, ((score - 1) / 4) * 100)) : (factor?.significativo ? 70 : 25);
  return <View style={styles.factorCard} wrap={false}>
    <View style={styles.factorTop}>
      <Text style={styles.factorName}>{factorName(factor)}</Text>
      <Text style={[styles.pill, { backgroundColor: color }]}>{riskLabel(classification)}</Text>
    </View>
    <View style={styles.scoreRow}>
      <View style={styles.scoreTrack}><View style={[styles.scoreFill, { width: `${width}%`, backgroundColor: color }]} /></View>
      <Text style={styles.scoreText}>{hasScore ? `${score.toFixed(2)} / 5` : "leitura técnica"}</Text>
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

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export function PsychosocialReportDocument({
  snapshot, codigoRafp, codigoRev, codigoValidacao, cliente, dataEmissao, preview = false, qrDataUrl,
}: any) {
  const assessment = snapshot?.avaliacao || {};
  const review = snapshot?.revisao || {};
  const responsible = review?.responsavel || {};
  const result = snapshot?.resultado || {};
  const factors: any[] = Array.isArray(snapshot?.fatores) ? snapshot.fatores : [];
  const actions: any[] = Array.isArray(snapshot?.plano?.itens) ? snapshot.plano.itens : [];
  const significant = factors.filter((factor) => factor?.significativo);
  const sortedFactors = [...factors].sort((a, b) => priorityRank(b?.prioridade) - priorityRank(a?.prioridade));
  const highest = sortedFactors[0];
  const methodology = assessment?.metodologia || snapshot?.agregado?.processamento?.metodologia || snapshot?.biblioteca || {};
  const methodologyLabel = methodology?.codigo ? `${methodology.codigo} v${clean(methodology.versao, "—")}` : "Metodologia registrada no Portal HSE";
  const responsibleName = responsible?.nome_responsavel || responsible?.nome || "Responsável técnico não informado";
  const generalClass = result?.classificacao_indice_geral || (highest ? highest?.classificacao || highest?.tratamento : "Monitoramento");
  const generalColor = riskColor(generalClass);
  const responseCount = result?.total_participantes ?? result?.total_respostas ?? "—";
  const generalScore = Number(result?.indice_geral_descritivo);
  const detailFactors = significant.length ? significant : sortedFactors;
  const detailChunks = chunkItems(detailFactors, 3);
  const detailPages = detailChunks.length ? detailChunks : [[]];
  const actionChunks = chunkItems(actions, 2);
  const actionPages = actionChunks.length ? actionChunks : [[]];

  return <Document
    title={`Relatório ${codigoRafp} ${codigoRev}`}
    author="HSE Consulting"
    subject="Avaliação de Fatores Psicossociais"
    creator="Portal HSE"
    producer="Portal HSE"
  >
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverBand}>
        <View style={styles.brandRow}>
          <View><Text style={styles.brandMark}>HSE</Text><Text style={styles.brandName}>CONSULTING</Text></View>
          <Text style={{ color: "#C8D8E8", fontSize: 8 }}>SAÚDE · SEGURANÇA · GESTÃO</Text>
        </View>
        <Text style={styles.coverKicker}>RELATÓRIO TÉCNICO</Text>
        <Text style={styles.coverTitle}>Avaliação de Fatores Psicossociais</Text>
      </View>
      <View style={styles.coverBody}>
        <Text style={styles.clientLabel}>ORGANIZAÇÃO AVALIADA</Text>
        <Text style={styles.clientName}>{clean(cliente?.nome)}</Text>
        <View style={styles.coverMetaGrid}>
          <Meta label="Relatório e revisão" value={`${codigoRafp} · ${codigoRev}`} />
          <Meta label="Avaliação" value={`${clean(assessment?.codigo, "—")} · ${clean(assessment?.titulo, "")}`} />
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
            <Text style={styles.note}>{clean(responsible?.cargo, "Responsável técnico")} · {clean(responsible?.registro_profissional, "Registro não informado")}</Text>
          </View>
          {!preview && qrDataUrl && <Image src={qrDataUrl} style={styles.qr} />}
        </View>
        <Text style={[styles.note, { marginTop: 12 }]}>Validação: {clean(codigoValidacao)}. O QR Code confirma a autenticidade deste documento.</Text>
      </View>
      {preview && <Text style={styles.watermark}>PRÉVIA · SEM VALIDADE</Text>}
    </Page>

    <Page size="A4" style={styles.page}>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} />
      <Text style={styles.sectionKicker}>LEITURA RÁPIDA</Text>
      <Text style={styles.h1}>Resumo executivo</Text>
      <Text style={styles.intro}>Esta página concentra o que a liderança precisa compreender e encaminhar primeiro. Os detalhes técnicos e as evidências aparecem nas páginas seguintes.</Text>
      <View style={styles.row}>
        <Kpi value={responseCount} label="participantes analisados" />
        <Kpi value={Number.isFinite(generalScore) ? generalScore.toFixed(2) : riskLabel(generalClass)} label={Number.isFinite(generalScore) ? "índice geral (1 a 5)" : "classificação geral"} color={generalColor} />
        <Kpi value={significant.length} label="fatores que requerem ação" />
        <Kpi value={highest ? riskLabel(highest?.prioridade) : "Monitorar"} label="maior prioridade" last color={highest ? riskColor(highest?.prioridade) : REPORT_COLORS.green} />
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>O que encontramos</Text>
        <Text>{clean(review?.conclusao, significant.length
          ? `A análise identificou ${significant.length} fator(es) que requer(em) tratamento organizacional.`
          : "Não foram identificados fatores significativos. Recomenda-se manter monitoramento e ações preventivas.")}</Text>
      </View>

      <Text style={styles.h2}>O que fazer agora</Text>
      {actions.length ? actions.slice(0, 3).map((action, index) => <View key={index} style={styles.bullet} wrap={false}>
        <Text style={styles.bulletNo}>{index + 1}</Text>
        <Text style={styles.bulletText}><Text style={{ fontFamily: "Helvetica-Bold" }}>{clean(action?.titulo, `Ação ${index + 1}`)}.</Text> {action?.acao && clean(action.acao) !== clean(action.titulo) ? clean(action.acao) : "Executar conforme o plano aprovado e registrar a evidência."}</Text>
      </View>) : <Text style={styles.note}>Manter os controles existentes, acompanhar os indicadores e programar nova avaliação conforme o ciclo de gestão de riscos.</Text>}

      <Text style={styles.h2}>Como interpretar as cores</Text>
      <View style={styles.legend}>
        {[["Baixo", REPORT_COLORS.green], ["Médio", REPORT_COLORS.amber], ["Alto", REPORT_COLORS.orange], ["Crítico", REPORT_COLORS.red]].map(([label, color]) => <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text>
        </View>)}
      </View>

      <View style={[styles.infoPanel, { marginTop: 18, backgroundColor: REPORT_COLORS.panel }]}>
        <Text style={styles.h3}>Nota de interpretação</Text>
        <Text style={styles.note}>Os resultados representam condições organizacionais percebidas pelo grupo. Não constituem diagnóstico psicológico individual, não identificam respondentes e devem ser analisados junto às características reais do trabalho.</Text>
      </View>
    </Page>

    <Page size="A4" style={styles.page} wrap>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} />
      <Text style={styles.sectionKicker}>PANORAMA DOS RISCOS</Text>
      <Text style={styles.h1}>Resultados por fator</Text>
      <Text style={styles.intro}>Cada cartão apresenta a classificação consolidada e a decisão técnica. A prioridade orienta a ordem de tratamento; o índice, quando disponível, resume a escala de 1 a 5.</Text>
      {sortedFactors.length ? sortedFactors.map((factor, index) => <FactorCard key={index} factor={factor} />) : <View style={styles.infoPanel}><Text>Nenhum resultado por fator foi disponibilizado no snapshot aprovado.</Text></View>}
    </Page>

    {detailPages.map((pageFactors, pageIndex) => <Page key={`detail-${pageIndex}`} size="A4" style={styles.page}>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} />
      <Text style={styles.sectionKicker}>ANÁLISE TÉCNICA</Text>
      <Text style={styles.h1}>{significant.length ? "Fatores que exigem atenção" : "Fatores sob monitoramento"}{pageIndex ? " · continuação" : ""}</Text>
      <Text style={styles.intro}>{significant.length ? "A seguir estão os fatores classificados para tratamento, com a justificativa registrada na revisão técnica." : "Nenhum fator foi marcado como significativo. As observações abaixo apoiam a prevenção e o acompanhamento contínuo."}</Text>
      {pageFactors.length ? pageFactors.map((factor, index) => <View key={index} style={[styles.detailCard, { borderLeftColor: riskColor(factor?.prioridade || factor?.classificacao) }]} wrap={false}>
          <View style={styles.factorTop}>
            <Text style={styles.factorName}>{factorName(factor)}</Text>
            <Text style={[styles.pill, { backgroundColor: riskColor(factor?.prioridade) }]}>Prioridade {riskLabel(factor?.prioridade)}</Text>
          </View>
          {factor?.fator_descricao && <Text style={[styles.note, { marginTop: 5 }]}>{clean(factor.fator_descricao)}</Text>}
          <Text style={[styles.h3, { marginTop: 7 }]}>Leitura técnica</Text>
          <Text>{clean(factor?.observacao || factor?.justificativa || factor?.tratamento, factor?.significativo ? "O fator requer medida de controle conforme o plano aprovado." : "Manter os controles e acompanhar a evolução do fator.")}</Text>
          {factor?.observacao && factor?.justificativa && clean(factor.observacao) !== clean(factor.justificativa) && <Text style={[styles.note, { marginTop: 5 }]}><Text style={{ fontFamily: "Helvetica-Bold" }}>Justificativa: </Text>{clean(factor.justificativa)}</Text>}
        </View>) : <View style={styles.infoPanel}><Text>Não há fatores detalhados no snapshot aprovado.</Text></View>}
      {pageIndex === detailPages.length - 1 && <View style={[styles.callout, { marginTop: 8 }]}>
        <Text style={styles.calloutTitle}>Decisão técnica</Text>
        <Text>{clean(review?.recomendacao_geral, significant.length ? "Tratar primeiro os fatores de maior prioridade, comunicar as medidas às equipes e verificar a eficácia dos controles." : "Manter os controles preventivos e acompanhar a evolução dos fatores no ciclo de gestão de riscos.")}</Text>
      </View>}
    </Page>)}

    {actionPages.map((pageActions, pageIndex) => <Page key={`actions-${pageIndex}`} size="A4" style={styles.page}>
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} />
      <Text style={styles.sectionKicker}>DA ANÁLISE À EXECUÇÃO</Text>
      <Text style={styles.h1}>Plano de ação{pageIndex ? " · continuação" : ""}</Text>
      <Text style={styles.intro}>{pageIndex ? "Continuação das medidas selecionadas, com responsabilidades, prazos e evidências esperadas." : "As ações abaixo foram selecionadas na revisão técnica. A organização deve confirmar responsáveis e registrar evidências de implantação e eficácia."}</Text>
      {pageActions.length ? pageActions.map((action, index) => {
        const actionNumber = pageIndex * 2 + index + 1;
        const description = clean(action?.acao, "Executar a ação conforme definida na revisão técnica.");
        const showDescription = description !== clean(action?.titulo, "");
        return <View key={index} style={styles.actionCard} wrap={false}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionNo}>{actionNumber}</Text>
            <Text style={styles.actionTitle}>{clean(action?.titulo, `Ação ${actionNumber}`)}</Text>
            <Text style={[styles.pill, { backgroundColor: riskColor(action?.prioridade) }]}>{riskLabel(action?.prioridade)}</Text>
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
      <HeaderFooter code={codigoRafp} revision={codigoRev} preview={preview} />
      <Text style={styles.sectionKicker}>BASE TÉCNICA E CONTROLE</Text>
      <Text style={styles.h1}>Metodologia, limites e aprovação</Text>
      <View style={styles.infoPanel}>
        <Text style={styles.h3}>Escopo da avaliação</Text>
        <Text>{clean(review?.contexto, "Avaliação organizacional de fatores psicossociais relacionados ao trabalho, com resultados consolidados e revisão técnica.")}</Text>
      </View>
      <View style={styles.infoPanel}>
        <Text style={styles.h3}>Método e amostra</Text>
        <Text style={{ marginBottom: 7 }}>Aplicou-se {methodologyLabel}. Os dados foram processados de forma agregada e o resultado foi submetido à revisão técnica antes da emissão.</Text>
        <KeyValue label="Participantes analisados" value={responseCount} />
        <KeyValue label="Amostra reduzida" value={review?.amostra_reduzida ? "Sim — interpretar com cautela" : "Não sinalizada pelo processamento"} />
        <KeyValue label="Período" value={`${date(assessment?.periodo?.inicio)} a ${date(assessment?.periodo?.fim)}`} />
      </View>
      <View style={styles.infoPanel}>
        <Text style={styles.h3}>Limitações declaradas</Text>
        <Text>{clean(review?.limitacoes, "Os resultados são uma fotografia do período avaliado e devem ser combinados com observação do trabalho, escuta das equipes e demais dados de SST.")}</Text>
      </View>
      {review?.recomendacao_geral && <View style={[styles.callout, { marginTop: 0 }]}>
        <Text style={styles.calloutTitle}>Recomendação geral</Text><Text>{clean(review.recomendacao_geral)}</Text>
      </View>}
      <View style={styles.signBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", color: REPORT_COLORS.green }}>APROVAÇÃO TÉCNICA REGISTRADA</Text>
        <Text style={{ marginTop: 5, fontFamily: "Helvetica-Bold" }}>{clean(responsibleName)}</Text>
        <Text>{clean(responsible?.cargo, "Responsável técnico")} · {clean(responsible?.registro_profissional, "Registro não informado")}</Text>
        <Text style={[styles.note, { marginTop: 4 }]}>Aprovado em {dateTime(review?.aprovada_em)} · Validação {clean(codigoValidacao)}</Text>
      </View>
      <Text style={[styles.note, { marginTop: 13 }]}>Este documento registra uma avaliação de riscos psicossociais relacionados ao trabalho. Não substitui avaliação clínica individual, diagnóstico de saúde ou prontuário. O conteúdo emitido é versionado e sua autenticidade pode ser verificada pelo código constante na capa.</Text>
    </Page>
  </Document>;
}
