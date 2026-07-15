import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, HelpCircle, Info, Loader2, Users, Percent, ClipboardCheck, Gauge, ShieldAlert, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
  CartesianGrid, LabelList, Cell, ReferenceLine, Legend,
} from "recharts";
import {
  getPsicoDashboardResults, getPsicoExecutiveInterpretation,
  PsicoDashboard, PsicoInterpretacao,
} from "@/lib/psicoResultados";
import {
  CLASSIF_LABEL, CLASSIF_SHORT, PRIO_LABEL, PRIO_ORDER, TIPO_ESCOPO_LABEL,
  RISK_COLOR, classifBadgeClass, prioBadgeClass, fmt, fmtPct, fmtDateTime, fmtDate,
  AVISO_METODOLOGICO,
} from "./shared";

type EscopoListItem = { id: string; tipo: "global"|"funcao"|"setor"|"unidade"; rotulo: string; respondentes: number; amostra_reduzida: boolean };

export default function VisaoExecutiva({
  avaliacaoId,
  escopoId,
  onChangeEscopo,
  escoposDisponiveis,
}: {
  avaliacaoId: string;
  escopoId: string | null;
  onChangeEscopo: (id: string) => void;
  escoposDisponiveis: EscopoListItem[];
}) {
  const dashQ = useQuery({
    queryKey: ["psico", "dashboard-resultados", avaliacaoId, escopoId],
    queryFn: () => getPsicoDashboardResults(avaliacaoId, escopoId),
    staleTime: 5 * 60 * 1000,
  });

  const interpQ = useQuery({
    queryKey: ["psico", "interpretacao-executiva", avaliacaoId, escopoId],
    queryFn: () => getPsicoExecutiveInterpretation(avaliacaoId, escopoId),
    staleTime: 5 * 60 * 1000,
  });

  if (dashQ.isLoading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando resultados…</CardContent></Card>;
  }
  if (!dashQ.data || dashQ.data.ok === false) {
    const msg = dashQ.data && dashQ.data.ok === false ? dashQ.data.message : "Não foi possível carregar o resultado consolidado desta avaliação.";
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Resultado indisponível</AlertTitle>
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    );
  }

  const dash = dashQ.data.data;
  const interp = interpQ.data && interpQ.data.ok ? interpQ.data.data : null;

  return (
    <div className="space-y-6">
      <HeaderCabecalho dash={dash} escoposDisponiveis={escoposDisponiveis} escopoId={escopoId ?? dash.escopo.id} onChangeEscopo={onChangeEscopo} />

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertTitle>Nota metodológica</AlertTitle>
        <AlertDescription>
          Os resultados são consolidados com base na quantidade de respostas válidas às perguntas de cada fator. Não há classificação individual de trabalhadores.
        </AlertDescription>
      </Alert>

      <CardsPrincipais dash={dash} />

      {dash.escopo.amostra_reduzida && (
        <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-900/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Amostra reduzida</AlertTitle>
          <AlertDescription>
            Os resultados globais devem ser interpretados com cautela. Não são apresentadas segmentações por função, setor ou unidade.
          </AlertDescription>
        </Alert>
      )}

      {dash.fatores.every((f) => !f.significativo) && (
        <Alert className="border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10">
          <Info className="h-4 w-4 text-emerald-700" />
          <AlertTitle>Nenhum fator significativo</AlertTitle>
          <AlertDescription>
            Nenhum dos fatores avaliados atendeu aos critérios de significância. Os resultados permanecem disponíveis para monitoramento preventivo.
          </AlertDescription>
        </Alert>
      )}
      {dash.fatores.length > 0 && dash.fatores.every((f) => f.significativo) && (
        <Alert className="border-rose-400 bg-rose-50 dark:bg-rose-900/10">
          <ShieldAlert className="h-4 w-4 text-rose-700" />
          <AlertTitle>Todos os fatores significativos</AlertTitle>
          <AlertDescription>
            Todos os fatores avaliados atenderam a pelo menos um critério de significância. Recomenda-se revisão técnica cuidadosa do contexto organizacional.
          </AlertDescription>
        </Alert>
      )}
      {dash.resumo.prioridade_maxima === "critica" && (
        <Alert className="border-rose-500 bg-rose-50 dark:bg-rose-950/20">
          <ShieldAlert className="h-4 w-4 text-rose-700" />
          <AlertTitle>Prioridade crítica identificada</AlertTitle>
          <AlertDescription>
            Há fator com prioridade crítica em razão do critério crítico automático.
          </AlertDescription>
        </Alert>
      )}

      <QuadroPrioridades dash={dash} />

      <GraficoDistribuicao dash={dash} />

      <GraficoScore dash={dash} />

      <PainelCriterios dash={dash} />

      <InterpretacaoExecutiva interp={interp} loading={interpQ.isLoading} />
    </div>
  );
}

/* --------------------------------------------------------------- */
function HeaderCabecalho({ dash, escoposDisponiveis, escopoId, onChangeEscopo }:{
  dash: PsicoDashboard;
  escoposDisponiveis: EscopoListItem[];
  escopoId: string;
  onChangeEscopo: (id:string)=>void;
}) {
  const hasSeg = escoposDisponiveis.some((e) => e.tipo !== "global");
  return (
    <Card>
      <CardContent className="p-5 grid gap-4 lg:grid-cols-[1fr_auto] items-start">
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{dash.avaliacao.codigo}</div>
          <div className="text-xl font-semibold leading-tight">{dash.avaliacao.titulo}</div>
          <div className="text-sm text-muted-foreground">
            {dash.avaliacao.cliente || "—"}
            {dash.avaliacao.unidade ? ` · ${dash.avaliacao.unidade}` : ""}
          </div>
          <div className="pt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-muted-foreground">
            <Meta label="Período" value={`${fmtDate(dash.avaliacao.data_inicio_prevista)} → ${fmtDate(dash.avaliacao.data_fim_prevista)}`} />
            <Meta label="Processado em" value={fmtDateTime(dash.processamento.processado_em)} />
            <Meta label="Questionário" value={`${dash.processamento.questionario.codigo ?? "—"} v${dash.processamento.questionario.versao ?? "—"}`} />
            <Meta label="Motor" value={`${dash.processamento.versao_motor} · #${dash.processamento.hash_abreviado}`} />
          </div>
        </div>
        {hasSeg && (
          <div className="lg:w-[320px] w-full space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Escopo de análise</div>
            <Select value={escopoId} onValueChange={onChangeEscopo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {escoposDisponiveis.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.tipo === "global"
                      ? `Resultado geral · ${e.respondentes} respondente(s)`
                      : `${TIPO_ESCOPO_LABEL[e.tipo]}: ${e.rotulo} · ${e.respondentes} respondente(s)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Apenas segmentos com o mínimo metodológico aparecem aqui.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="text-sm text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}

/* --------------------------------------------------------------- */
function CardsPrincipais({ dash }: { dash: PsicoDashboard }) {
  const p = dash.participacao;
  const respostas = dash.resumo.total_respostas_validas;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard icon={<Users className="h-4 w-4" />} label="Respondentes" value={String(p.respondentes)} help={`Mínimo aplicado: ${dash.escopo.minimo_aplicado}`} />
      <StatCard icon={<Percent className="h-4 w-4" />} label="Participação" value={p.percentual !== null ? fmtPct(p.percentual, 1) : "—"} help={p.previstos ? `${p.respondentes} de ${p.ativos_abertura ?? p.previstos} ativos` : undefined} />
      <StatCard icon={<ClipboardCheck className="h-4 w-4" />} label="Respostas válidas" value={String(respostas)} help="Analisadas neste escopo" />
      <StatCard
        icon={<Gauge className="h-4 w-4" />}
        label="Índice geral descritivo"
        value={fmt(dash.resumo.indice_geral_descritivo, 2)}
        rightBadge={<Badge className={classifBadgeClass(dash.resumo.classificacao_indice_geral)}>{CLASSIF_LABEL[dash.resumo.classificacao_indice_geral]}</Badge>}
        tooltip="Resumo matemático das respostas válidas. Não é utilizado como critério de significância dos fatores."
      />
      <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Fatores significativos" value={`${dash.resumo.fatores_significativos} / ${dash.fatores.length}`} help="Atenderam a pelo menos um critério" />
      <StatCard icon={<ShieldAlert className="h-4 w-4" />} label="Maior prioridade" value=""
        rightBadge={<Badge className={prioBadgeClass(dash.resumo.prioridade_maxima)}>{PRIO_LABEL[dash.resumo.prioridade_maxima]}</Badge>}
        help="Baseada nos critérios 50% / 30% / 10%" />
    </div>
  );
}

function StatCard({ icon, label, value, help, rightBadge, tooltip }: { icon?: React.ReactNode; label: string; value: string; help?: string; rightBadge?: React.ReactNode; tooltip?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            {icon}{label}
            {tooltip && (
              <TooltipProvider>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button aria-label={`Ajuda sobre ${label}`} className="inline-flex text-muted-foreground/70 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            )}
          </div>
          {rightBadge}
        </div>
        {value && <div className="mt-2 text-2xl font-semibold font-mono">{value}</div>}
        {help && <div className="text-[11px] text-muted-foreground mt-1">{help}</div>}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- */
function QuadroPrioridades({ dash }: { dash: PsicoDashboard }) {
  const grupos = useMemo(() => {
    const g: Record<string, typeof dash.fatores> = { critica: [], alta: [], media: [], monitoramento: [] };
    // Ordenar dentro do grupo
    const sorted = [...dash.fatores].sort((a, b) => {
      if (a.prioridade !== b.prioridade) return PRIO_ORDER[a.prioridade] - PRIO_ORDER[b.prioridade];
      if (a.significativo !== b.significativo) return a.significativo ? -1 : 1;
      if (a.percentual_critico !== b.percentual_critico) return b.percentual_critico - a.percentual_critico;
      if (a.percentual_alto_critico !== b.percentual_alto_critico) return b.percentual_alto_critico - a.percentual_alto_critico;
      return a.ordem - b.ordem;
    });
    sorted.forEach((f) => g[f.prioridade].push(f));
    return g;
  }, [dash.fatores]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quadro de prioridades</CardTitle>
        <p className="text-xs text-muted-foreground">Agrupamento pelos critérios metodológicos armazenados no processamento.</p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(["critica","alta","media","monitoramento"] as const).map((p) => (
          <div key={p} className="rounded-lg border bg-card overflow-hidden">
            <div className={`px-3 py-2 text-xs font-semibold flex items-center justify-between ${p==="critica" ? "bg-rose-800 text-white" : p==="alta" ? "bg-orange-600 text-white" : p==="media" ? "bg-amber-400 text-black" : "bg-slate-500 text-white"}`}>
              <span>{PRIO_LABEL[p]}</span>
              <span className="font-mono">{grupos[p].length}</span>
            </div>
            <div className="p-2 space-y-1.5 min-h-[60px]">
              {grupos[p].length === 0 ? (
                <div className="text-[11px] text-muted-foreground text-center py-2">—</div>
              ) : grupos[p].map((f) => (
                <div key={f.id} className="text-xs border rounded px-2 py-1.5 bg-background">
                  <div className="font-medium leading-tight break-words">{f.fator_nome}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{CLASSIF_LABEL[f.classificacao_media]}</span>
                    {f.significativo && <Badge variant="outline" className="text-[9px] py-0 h-4 border-rose-500 text-rose-700">Sig.</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- */
function GraficoDistribuicao({ dash }: { dash: PsicoDashboard }) {
  const chartData = useMemo(() => dash.fatores.map((f) => ({
    id: f.fator_id,
    nome: f.fator_nome,
    significativo: f.significativo,
    prioridade: PRIO_LABEL[f.prioridade],
    irrelevante: Number(f.percentual_irrelevante),
    baixo: Number(f.percentual_baixo),
    medio: Number(f.percentual_medio),
    alto: Number(f.percentual_alto),
    critico: Number(f.percentual_critico),
  })), [dash.fatores]);

  const height = Math.max(260, chartData.length * 46 + 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuição das respostas por nível de risco</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada barra soma 100% das respostas válidas ao fator. As barras seguem a ordem oficial dos fatores.
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }} stackOffset="expand" barCategoryGap={10}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} ticks={[0,20,40,60,80,100]} />
            <YAxis type="category" dataKey="nome" width={210} tick={{ fontSize: 12 }} interval={0} />
            <RTooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item: any = payload[0].payload;
                return (
                  <div className="rounded border bg-background p-2 text-xs shadow-md">
                    <div className="font-medium mb-1">{item.nome}</div>
                    {payload.map((p: any) => (
                      <div key={p.dataKey} className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                        <span className="capitalize">{p.dataKey}</span>
                        <span className="ml-auto font-mono">{Number(p.value).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="irrelevante" stackId="a" name="Irrelevante" fill={RISK_COLOR.irrelevante} />
            <Bar dataKey="baixo"       stackId="a" name="Baixo"       fill={RISK_COLOR.baixo} />
            <Bar dataKey="medio"       stackId="a" name="Médio"       fill={RISK_COLOR.medio} />
            <Bar dataKey="alto"        stackId="a" name="Alto"        fill={RISK_COLOR.alto} />
            <Bar dataKey="critico"     stackId="a" name="Crítico"     fill={RISK_COLOR.critico} />
          </BarChart>
        </ResponsiveContainer>

        {/* Tabela equivalente acessível */}
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver tabela equivalente (acessibilidade)</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 pr-2">Fator</th>
                  {(["irrelevante","baixo","medio","alto","critico"] as const).map((k) => (
                    <th key={k} className="py-1 pr-2 text-right">{CLASSIF_SHORT[k as any]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1 pr-2">{r.nome}</td>
                    <td className="py-1 pr-2 text-right font-mono">{r.irrelevante.toFixed(2)}%</td>
                    <td className="py-1 pr-2 text-right font-mono">{r.baixo.toFixed(2)}%</td>
                    <td className="py-1 pr-2 text-right font-mono">{r.medio.toFixed(2)}%</td>
                    <td className="py-1 pr-2 text-right font-mono">{r.alto.toFixed(2)}%</td>
                    <td className="py-1 pr-2 text-right font-mono">{r.critico.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- */
function GraficoScore({ dash }: { dash: PsicoDashboard }) {
  const chartData = useMemo(() => dash.fatores.map((f) => ({
    nome: f.fator_nome,
    score: Number(f.score_medio),
    classificacao: f.classificacao_media,
    prioridade: f.prioridade,
  })), [dash.fatores]);

  const height = Math.max(260, chartData.length * 42 + 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score médio por fator</CardTitle>
        <p className="text-xs text-muted-foreground">
          Escala de 0 a 4. A classificação média e a prioridade são indicadores independentes — um fator pode ter média baixa e prioridade crítica quando o critério crítico automático for acionado.
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
            <XAxis type="number" domain={[0, 4]} ticks={[0,0.8,1.6,2.4,3.2,4]} />
            <YAxis type="category" dataKey="nome" width={210} tick={{ fontSize: 12 }} interval={0} />
            <ReferenceLine x={0.8} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" />
            <ReferenceLine x={1.6} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" />
            <ReferenceLine x={2.4} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" />
            <ReferenceLine x={3.2} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" />
            <RTooltip
              formatter={(v: any, _n, p: any) => [Number(v).toFixed(2), CLASSIF_LABEL[p?.payload?.classificacao as keyof typeof CLASSIF_LABEL] ?? "Score"]}
              labelFormatter={(l: any) => l}
            />
            <Bar dataKey="score" barSize={22} radius={[0,6,6,0]}>
              {chartData.map((d, i) => <Cell key={i} fill={RISK_COLOR[d.classificacao]} />)}
              <LabelList dataKey="score" position="right" formatter={(v: any) => Number(v).toFixed(2)} style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- */
function PainelCriterios({ dash }: { dash: PsicoDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Critérios de significância</CardTitle>
        <p className="text-xs text-muted-foreground">
          Principal: Médio+Alto+Crítico &gt; 50% · Agravamento: Alto+Crítico ≥ 30% · Crítico automático: Crítico ≥ 10%.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {dash.fatores.map((f) => (
          <div key={f.id} className="rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="font-medium text-sm">{f.fator_nome}</div>
              <div className="flex items-center gap-2">
                {f.significativo
                  ? <Badge className="bg-rose-800 text-white hover:bg-rose-800">Fator significativo</Badge>
                  : <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">Não significativo</Badge>}
                <Badge className={prioBadgeClass(f.prioridade)}>{PRIO_LABEL[f.prioridade]}</Badge>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <CriterioBar label="Principal" limite="> 50%" valor={f.percentual_medio_alto_critico} limiar={50} acionado={f.criterio_principal} />
              <CriterioBar label="Agravamento" limite="≥ 30%" valor={f.percentual_alto_critico} limiar={30} acionado={f.criterio_agravamento} />
              <CriterioBar label="Crítico automático" limite="≥ 10%" valor={f.percentual_critico} limiar={10} acionado={f.criterio_critico_automatico} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CriterioBar({ label, limite, valor, limiar, acionado }: { label: string; limite: string; valor: number; limiar: number; acionado: boolean }) {
  const pct = Math.max(0, Math.min(100, Number(valor)));
  return (
    <div className={`rounded border px-2.5 py-2 ${acionado ? "border-rose-500/60 bg-rose-50 dark:bg-rose-950/20" : "bg-background"}`}>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`font-medium ${acionado ? "text-rose-700" : "text-muted-foreground"}`}>{acionado ? "Acionado" : "Não acionado"}</span>
      </div>
      <div className="relative">
        <Progress value={pct} className="h-2" />
        {/* marcador do limiar */}
        <div className="absolute top-0 -translate-x-1/2 w-px h-2 bg-foreground/70" style={{ left: `${limiar}%` }} aria-hidden />
      </div>
      <div className="flex items-center justify-between text-[11px] mt-1">
        <span className="font-mono">{fmtPct(valor, 2)}</span>
        <span className="text-muted-foreground">Limite {limite}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- */
function InterpretacaoExecutiva({ interp, loading }: { interp: PsicoInterpretacao | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Interpretação executiva</CardTitle>
        <p className="text-xs text-muted-foreground">
          Texto gerado por regras determinísticas a partir dos resultados persistidos. Não utiliza inteligência artificial e não corresponde a diagnóstico individual.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading && <div className="text-muted-foreground text-xs"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Gerando…</div>}
        {!loading && !interp && <div className="text-muted-foreground text-xs">Interpretação indisponível.</div>}
        {interp && (
          <>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Resumo geral</div>
              <p>{interp.resumo_geral}</p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Situação da amostra</div>
              <p>{interp.situacao_amostra}</p>
            </div>
            {interp.fatores_prioritarios.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Fatores prioritários</div>
                <ul className="space-y-1.5 list-disc pl-5">
                  {interp.fatores_prioritarios.map((x) => <li key={x.fator_id}>{x.texto}</li>)}
                </ul>
              </div>
            )}
            {interp.fatores_monitoramento.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Fatores em monitoramento</div>
                <ul className="space-y-1.5 list-disc pl-5 text-muted-foreground">
                  {interp.fatores_monitoramento.map((x) => <li key={x.fator_id}>{x.texto}</li>)}
                </ul>
              </div>
            )}
            {interp.limitacoes.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Limitações</div>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {interp.limitacoes.map((l) => <li key={l}>{l === "AMOSTRA_REDUZIDA" ? "Amostra reduzida — leitura indicativa." : l}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
        <p className="text-[11px] text-muted-foreground border-t pt-2">{AVISO_METODOLOGICO}</p>
      </CardContent>
    </Card>
  );
}
