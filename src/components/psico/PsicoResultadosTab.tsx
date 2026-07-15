import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Play, RefreshCcw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

type Classificacao = "Risco Irrelevante" | "Risco Baixo" | "Risco Médio" | "Risco Alto" | "Risco Crítico";
type Prioridade = "Monitoramento" | "Média" | "Alta" | "Crítica";

function classBadge(c?: Classificacao | null) {
  switch (c) {
    case "Risco Crítico": return "bg-red-600 text-white";
    case "Risco Alto": return "bg-orange-500 text-white";
    case "Risco Médio": return "bg-amber-400 text-black";
    case "Risco Baixo": return "bg-lime-500 text-black";
    case "Risco Irrelevante": return "bg-emerald-500 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}
function classColorHex(c?: Classificacao | null) {
  switch (c) {
    case "Risco Crítico": return "hsl(0 70% 45%)";
    case "Risco Alto": return "hsl(24 90% 55%)";
    case "Risco Médio": return "hsl(42 95% 55%)";
    case "Risco Baixo": return "hsl(80 65% 50%)";
    case "Risco Irrelevante": return "hsl(150 60% 45%)";
    default: return "hsl(var(--muted-foreground))";
  }
}
function prioBadge(p?: Prioridade | null) {
  switch (p) {
    case "Crítica": return "bg-red-600 text-white";
    case "Alta": return "bg-orange-500 text-white";
    case "Média": return "bg-amber-400 text-black";
    case "Monitoramento": return "bg-slate-400 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function PsicoResultadosTab({ av, onReload }: { av: any; onReload: () => void }) {
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<any>(null);
  const [escopos, setEscopos] = useState<any[]>([]);
  const [escopoSel, setEscopoSel] = useState<string | null>(null);
  const [fatores, setFatores] = useState<any[]>([]);
  const [fatoresMap, setFatoresMap] = useState<Record<string, any>>({});
  const [perguntas, setPerguntas] = useState<any[]>([]);
  const [perguntasMap, setPerguntasMap] = useState<Record<string, any>>({});
  const [fatorFiltro, setFatorFiltro] = useState<string>("all");
  const [processing, setProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const podeProcessar = av?.status === "coleta_encerrada" || av?.status === "resultado_pronto";
  const jaProcessado = !!av?.processamento_resultado_ativo_id;

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [av?.id, av?.processamento_resultado_ativo_id, av?.status]);

  async function load() {
    if (!av?.id) return;
    setLoading(true);
    try {
      // Cache dos fatores/perguntas do questionário
      if (av.questionario_versao_id) {
        const [f, p] = await Promise.all([
          supabase.from("psico_fatores").select("id, codigo, nome, ordem").eq("questionario_versao_id", av.questionario_versao_id).order("ordem"),
          supabase.from("psico_perguntas").select("id, numero, texto, fator_id, sentido_pontuacao").eq("questionario_versao_id", av.questionario_versao_id).order("numero"),
        ]);
        const fm: Record<string, any> = {};
        (f.data || []).forEach((x: any) => { fm[x.id] = x; });
        setFatoresMap(fm);
        const pm: Record<string, any> = {};
        (p.data || []).forEach((x: any) => { pm[x.id] = x; });
        setPerguntasMap(pm);
      }

      if (podeProcessar) {
        const { data: v, error: ev } = await supabase.rpc("psico_validar_processamento_resultados", { p_avaliacao_id: av.id });
        if (ev) {
          setValidation(null);
          setValidationError("Não foi possível validar os dados para processamento.");
        } else {
          const parsed = Array.isArray(v) ? (v as any)[0] : v;
          setValidation(parsed);
          setValidationError(null);
        }
      } else {
        setValidation(null);
        setValidationError(null);
      }

      if (jaProcessado) {
        const [r, e] = await Promise.all([
          supabase.rpc("psico_obter_resultado_resumo", { p_avaliacao_id: av.id }),
          supabase.rpc("psico_listar_escopos_resultado", { p_avaliacao_id: av.id }),
        ]);
        setResumo(r.data);
        const list = (e.data || []) as any[];
        setEscopos(list);
        const global = list.find((x) => x.tipo === "global");
        setEscopoSel((prev) => prev && list.some((x) => x.id === prev) ? prev : (global?.id ?? list[0]?.id ?? null));
      } else {
        setResumo(null); setEscopos([]); setEscopoSel(null); setFatores([]); setPerguntas([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!av?.id || !escopoSel) { setFatores([]); setPerguntas([]); return; }
      const [f, p] = await Promise.all([
        supabase.rpc("psico_obter_resultados_fatores", { p_avaliacao_id: av.id, p_escopo_id: escopoSel }),
        supabase.rpc("psico_obter_resultados_perguntas", { p_avaliacao_id: av.id, p_escopo_id: escopoSel }),
      ]);
      setFatores((f.data || []) as any[]);
      setPerguntas((p.data || []) as any[]);
    })();
  }, [av?.id, escopoSel]);

  async function processar() {
    if (confirmText !== `PROCESSAR ${av.codigo}`) {
      toast.error(`Confirmação inválida. Digite: PROCESSAR ${av.codigo}`);
      return;
    }
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("psico_processar_resultados", {
        p_avaliacao_id: av.id,
        p_confirmacao: `PROCESSAR ${av.codigo}`,
      });
      if (error) throw error;
      const reutilizado = (data as any)?.reutilizado;
      toast.success(reutilizado ? "Resultado já estava processado (reutilizado)." : "Resultados processados com sucesso.");
      setDialogOpen(false); setConfirmText("");
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao processar resultados");
    } finally {
      setProcessing(false);
    }
  }

  const escopoAtual = useMemo(() => escopos.find((e) => e.id === escopoSel), [escopos, escopoSel]);

  const chartData = useMemo(() => fatores.map((f) => {
    const meta = fatoresMap[f.fator_id];
    return {
      nome: meta?.codigo || meta?.nome || "?",
      nomeFull: meta?.nome || meta?.codigo || "",
      score: Number(f.score_medio ?? 0),
      classificacao: f.classificacao_media,
      significativo: f.significativo,
    };
  }), [fatores, fatoresMap]);

  const perguntasFiltradas = useMemo(() => {
    if (fatorFiltro === "all") return perguntas;
    return perguntas.filter((p) => p.fator_id === fatorFiltro);
  }, [perguntas, fatorFiltro]);

  if (loading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando resultados…</CardContent></Card>;
  }

  // Nenhum resultado e status não permite
  if (!jaProcessado && !podeProcessar) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Os resultados serão apresentados após o encerramento e processamento da coleta.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Painel de processamento */}
      {podeProcessar && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Processamento de resultados</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Revalidar</Button>
              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={!validation?.pode_processar}>
                    <Play className="h-4 w-4 mr-1" /> {jaProcessado ? "Reprocessar" : "Processar resultados"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar processamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação executa o motor de cálculo (versão <b>{validation?.versao_motor}</b>) sobre as respostas anônimas.
                      O processamento é imutável após concluído. Para confirmar, digite <code>PROCESSAR {av.codigo}</code> abaixo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <Label>Confirmação *</Label>
                    <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={`PROCESSAR ${av.codigo}`} />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction disabled={processing} onClick={(e) => { e.preventDefault(); processar(); }}>
                      {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando…</> : "Confirmar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {validationError ? (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {validationError}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="text-xs uppercase text-muted-foreground">Convites respondidos</div><div className="text-lg font-semibold">{validation?.convites_respondidos ?? "—"}</div></div>
                <div><div className="text-xs uppercase text-muted-foreground">Respostas anônimas</div><div className="text-lg font-semibold">{validation?.total_respostas_anonimas ?? "—"}</div></div>
                <div><div className="text-xs uppercase text-muted-foreground">Respondentes</div><div className="text-lg font-semibold">{validation?.total_respondentes ?? "—"}</div></div>
                <div><div className="text-xs uppercase text-muted-foreground">Mínimo global</div><div className="text-lg font-semibold">{validation?.minimo_global ?? "—"}</div></div>
                <div><div className="text-xs uppercase text-muted-foreground">Itens registrados</div><div className="text-lg font-semibold">{validation?.total_itens ?? "—"}</div></div>
                <div><div className="text-xs uppercase text-muted-foreground">Itens esperados</div><div className="text-lg font-semibold">{validation?.itens_esperados ?? "—"}</div></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant={validation?.valido ? "default" : "destructive"}>
                {validation?.valido ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                {validation?.valido ? "Validação OK" : "Validação com erros"}
              </Badge>
              <Badge variant={validation?.amostra_suficiente ? "default" : "destructive"}>Amostra {validation?.amostra_suficiente ? "suficiente" : "insuficiente"}</Badge>
              {validation?.amostra_reduzida && <Badge className="bg-amber-500 text-black">Amostra reduzida (n&lt;5)</Badge>}
              {validation?.integridade_ok ? <Badge variant="secondary">Integridade OK</Badge> : <Badge variant="destructive">Integridade quebrada</Badge>}
              {validation?.mesmo_hash && <Badge variant="secondary">Já existe processamento com mesma entrada</Badge>}
            </div>
            {(validation?.erros || []).length > 0 && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3">
                <div className="text-xs font-semibold uppercase text-destructive mb-1">Erros</div>
                <ul className="list-disc pl-5 text-sm text-destructive">
                  {(validation.erros as string[]).map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            {(validation?.avisos || []).length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-3">
                <div className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300 mb-1">Avisos</div>
                <ul className="list-disc pl-5 text-sm">
                  {(validation.avisos as string[]).map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {jaProcessado && resumo && (
        <>
          {/* Resumo do processamento */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Resumo</CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  Motor {resumo.versao_motor} · hash {resumo.hash_prefix} · concluído em {formatDateTime(resumo.concluido_em)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <Stat label="Respondentes" value={resumo.total_respondentes} />
              <Stat label="Itens" value={resumo.total_itens} />
              <Stat label="Escopos" value={resumo.total_escopos} />
              <Stat label="Escopos suprimidos" value={resumo.escopos_suprimidos} />
              <Stat label="Elegíveis · Função" value={resumo.escopos_funcao_elegiveis} />
              <Stat label="Elegíveis · Setor" value={resumo.escopos_setor_elegiveis} />
              <Stat label="Elegíveis · Unidade" value={resumo.escopos_unidade_elegiveis} />
              {resumo.global && (
                <div className="sm:col-span-2 lg:col-span-1 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Índice global</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{Number(resumo.global.indice_geral_descritivo).toFixed(2)}</span>
                    <Badge className={classBadge(resumo.global.classificacao_indice_geral)}>{resumo.global.classificacao_indice_geral}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {resumo.global.fatores_significativos} fator(es) significativo(s) · prioridade máx.: {resumo.global.prioridade_maxima}
                    {resumo.global.amostra_reduzida && " · amostra reduzida"}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seletor de escopo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Escopo analisado</CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  Selecione um recorte para inspecionar os resultados. Recortes por função, setor e unidade só aparecem quando há respondentes suficientes em cada segmento.
                </div>
              </div>
              <div className="w-full max-w-xs">
                <Select value={escopoSel ?? undefined} onValueChange={(v) => setEscopoSel(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar escopo" /></SelectTrigger>
                  <SelectContent>
                    {escopos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.tipo === "global" ? "Global" : `${e.tipo}: ${e.rotulo}`} · n={e.respondentes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            {escopoAtual && (
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <Stat label="Tipo" value={escopoAtual.tipo} />
                <Stat label="Respondentes" value={escopoAtual.respondentes} />
                <Stat label="Mínimo aplicado" value={escopoAtual.minimo_aplicado} />
                <Stat label="Itens" value={escopoAtual.total_itens} />
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Índice descritivo</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{Number(escopoAtual.indice_geral_descritivo).toFixed(2)}</span>
                    <Badge className={classBadge(escopoAtual.classificacao_indice_geral)}>{escopoAtual.classificacao_indice_geral}</Badge>
                  </div>
                </div>
                <Stat label="Fatores significativos" value={escopoAtual.fatores_significativos} />
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Prioridade máxima</div>
                  <Badge className={prioBadge(escopoAtual.prioridade_maxima)}>{escopoAtual.prioridade_maxima}</Badge>
                </div>
                {escopoAtual.amostra_reduzida && (
                  <div className="sm:col-span-2 lg:col-span-1"><Badge className="bg-amber-500 text-black">Amostra reduzida</Badge></div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Gráfico de fatores */}
          <Card>
            <CardHeader><CardTitle className="text-base">Score médio por fator</CardTitle></CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">Sem dados para este escopo.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="nome" />
                    <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} />
                    <Tooltip
                      formatter={(v: any, _n, p: any) => [Number(v).toFixed(2), p?.payload?.classificacao]}
                      labelFormatter={(l: any, p: any) => p?.[0]?.payload?.nomeFull || l}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={classColorHex(d.classificacao as Classificacao)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Fatores — cards com distribuição de risco */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fatores</CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                Distribuição percentual das respostas em cada faixa de risco, classificação final e critérios de significância acionados.
              </div>
            </CardHeader>
            <CardContent>
              {fatores.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">Sem fatores neste escopo.</div>
              ) : (
                <div className="grid gap-3">
                  {fatores.map((f) => {
                    const meta = fatoresMap[f.fator_id];
                    const criterios = [
                      f.criterio_principal && "Principal",
                      f.criterio_agravamento && "Agravamento",
                      f.criterio_critico_automatico && "Crítico automático",
                    ].filter(Boolean) as string[];
                    return <FatorCard key={f.id} f={f} meta={meta} criterios={criterios} />;
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Perguntas */}
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Perguntas</CardTitle>
                <div className="text-xs text-muted-foreground">Filtrar por fator</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFatorFiltro("all")}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${fatorFiltro === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                >
                  Todos ({perguntas.length})
                </button>
                {fatores.map((f) => {
                  const m = fatoresMap[f.fator_id];
                  const count = perguntas.filter((p) => p.fator_id === f.fator_id).length;
                  const active = fatorFiltro === f.fator_id;
                  return (
                    <button
                      key={f.fator_id}
                      onClick={() => setFatorFiltro(f.fator_id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 ${active ? "border-primary" : "hover:bg-muted"}`}
                      style={active ? { background: classColorHex(f.classificacao_media), color: "#fff", borderColor: "transparent" } : undefined}
                      title={m?.nome}
                    >
                      <span className="font-medium">{m?.codigo || m?.nome}</span>
                      <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-2 w-10">#</th>
                    <th className="py-2 pr-2">Pergunta</th>
                    <th className="py-2 pr-2">Score</th>
                    <th className="py-2 pr-2">% Desf.</th>
                    <th className="py-2 pr-2">Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {perguntasFiltradas.map((p) => {
                    const meta = perguntasMap[p.pergunta_id];
                    return (
                      <tr key={p.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-2 font-mono">{p.numero}</td>
                        <td className="py-2 pr-2">
                          <div>{meta?.texto || "—"}</div>
                          {meta?.sentido_pontuacao === "inverso" && <Badge variant="secondary" className="mt-1 text-[10px]">Invertida</Badge>}
                        </td>
                        <td className="py-2 pr-2 font-mono">{Number(p.score_medio).toFixed(2)}</td>
                        <td className="py-2 pr-2 font-mono">{Number(p.percentual_desfavoravel).toFixed(1)}%</td>
                        <td className="py-2 pr-2"><Badge className={classBadge(p.classificacao_media)}>{p.classificacao_media}</Badge></td>
                      </tr>
                    );
                  })}
                  {perguntasFiltradas.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem perguntas para este filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {jaProcessado === false && !podeProcessar && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Encerre a coleta para habilitar o processamento dos resultados.</CardContent></Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 font-medium">{value ?? "—"}</div>
    </div>
  );
}

const RISCO_FAIXAS: Array<{ key: string; label: string; short: string; classif: Classificacao }> = [
  { key: "percentual_irrelevante", label: "Irrelevante", short: "Irrel.", classif: "Risco Irrelevante" },
  { key: "percentual_baixo", label: "Baixo", short: "Baixo", classif: "Risco Baixo" },
  { key: "percentual_medio", label: "Médio", short: "Médio", classif: "Risco Médio" },
  { key: "percentual_alto", label: "Alto", short: "Alto", classif: "Risco Alto" },
  { key: "percentual_critico", label: "Crítico", short: "Crít.", classif: "Risco Crítico" },
];

function FatorCard({ f, meta, criterios }: { f: any; meta: any; criterios: string[] }) {
  const cor = classColorHex(f.classificacao_media);
  const faixas = RISCO_FAIXAS.map((r) => ({ ...r, pct: Number(f[r.key] ?? 0) }));
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3 border-b" style={{ borderLeft: `4px solid ${cor}` }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{meta?.codigo || "—"}</span>
            <span className="font-semibold">{meta?.nome || f.fator_id}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {f.quantidade_perguntas} pergunta(s) · {f.total_respostas_validas} resposta(s) válida(s)
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score médio</div>
            <div className="font-mono text-lg leading-none mt-0.5">{Number(f.score_medio).toFixed(2)}</div>
          </div>
          <Badge className={classBadge(f.classificacao_media)}>{f.classificacao_media}</Badge>
          <Badge className={prioBadge(f.prioridade)}>{f.prioridade}</Badge>
          {f.significativo && <Badge variant="secondary" className="border border-primary/40 text-primary">Significativo</Badge>}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Distribuição das respostas por faixa de risco</div>
            <div className="text-[11px] text-muted-foreground">Total 100%</div>
          </div>
          <div className="flex w-full h-3 rounded overflow-hidden bg-muted">
            {faixas.map((r) => r.pct > 0 && (
              <div key={r.key} title={`${r.label}: ${r.pct.toFixed(1)}%`} style={{ width: `${r.pct}%`, background: classColorHex(r.classif) }} />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {faixas.map((r) => (
              <div key={r.key} className="text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: classColorHex(r.classif) }} />
                  {r.short}
                </div>
                <div className="font-mono text-sm mt-0.5">{r.pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t">
          <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Critérios acionados:</span>
          {criterios.length === 0 ? (
            <span className="text-muted-foreground">Nenhum</span>
          ) : criterios.map((c) => (
            <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
          ))}
          <span className="ml-auto text-muted-foreground">
            Médio+Alto+Crít.: <span className="font-mono text-foreground">{Number(f.percentual_medio_alto_critico ?? 0).toFixed(1)}%</span>
            {" · "}Alto+Crít.: <span className="font-mono text-foreground">{Number(f.percentual_alto_critico ?? 0).toFixed(1)}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}