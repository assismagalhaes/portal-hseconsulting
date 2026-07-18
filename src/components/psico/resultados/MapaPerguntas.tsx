import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { getPsicoDashboardResults, ClassificacaoRisco } from "@/lib/psicoResultados";
import { CLASSIF_LABEL, CLASSIF_SHORT, RISK_COLOR, classifBadgeClass, fmt, fmtPct, AvisoMetodologico } from "./shared";

type SortKey = "numero" | "score" | "desfav" | "ac" | "critico";

export default function MapaPerguntas({ avaliacaoId, escopoId }: { avaliacaoId: string; escopoId: string }) {
  const [filtroFator, setFiltroFator] = useState<string>("all");
  const [filtroClass, setFiltroClass] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<SortKey>("numero");
  const [asc, setAsc] = useState(true);
  const [colorMode, setColorMode] = useState<"classificacao" | "critico" | "desfav">("classificacao");

  const dashQ = useQuery({
    queryKey: ["psico", "dashboard-resultados", avaliacaoId, escopoId],
    queryFn: () => getPsicoDashboardResults(avaliacaoId, escopoId),
    staleTime: 5 * 60 * 1000,
  });

  const perguntasQ = useQuery({
    queryKey: ["psico", "resultados-perguntas", avaliacaoId, escopoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("psico_obter_resultados_perguntas" as any, {
        p_avaliacao_id: avaliacaoId, p_escopo_id: escopoId,
      } as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const enunciadosQ = useQuery({
    queryKey: ["psico", "enunciados", dashQ.data && dashQ.data.ok ? dashQ.data.data.processamento.questionario.codigo : null, dashQ.data && dashQ.data.ok ? dashQ.data.data.processamento.questionario.versao : null],
    enabled: !!dashQ.data && dashQ.data.ok,
    queryFn: async () => {
      if (!dashQ.data || dashQ.data.ok === false) return {} as Record<string, { texto: string; inversa: boolean }>;
      const codigo = dashQ.data.data.processamento.questionario.codigo;
      const versao = dashQ.data.data.processamento.questionario.versao;
      if (!codigo || !versao) return {};
      const { data: v } = await supabase.from("psico_questionarios_versoes").select("id").eq("codigo", codigo).eq("versao", versao as any).maybeSingle();
      if (!v?.id) return {};
      const { data } = await supabase.from("psico_perguntas").select("id,texto,sentido_pontuacao").eq("questionario_versao_id", v.id);
      const map: Record<string, { texto: string; inversa: boolean }> = {};
      (data || []).forEach((p: any) => { map[p.id] = { texto: p.texto, inversa: p.sentido_pontuacao === "invertida" }; });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  const fatoresMap = useMemo(() => {
    if (!dashQ.data || dashQ.data.ok === false) return new Map();
    return new Map(dashQ.data.data.fatores.map((f) => [f.fator_id, f]));
  }, [dashQ.data]);
  const rows = useMemo(() => {
    const enunciados = enunciadosQ.data || {};
    const raw = (perguntasQ.data || []).map((p: any) => {
      const fat = p.fator_id ? fatoresMap.get(p.fator_id) : null;
      const enun = enunciados[p.pergunta_id];
      return {
        pergunta_id: p.pergunta_id,
        numero: p.numero,
        fator_id: p.fator_id,
        fator_codigo: fat?.fator_codigo ?? "—",
        fator_nome: fat?.fator_nome ?? "—",
        classificacao: p.classificacao_media as ClassificacaoRisco,
        score: Number(p.score_medio),
        desfav: Number(p.percentual_desfavoravel),
        ac: Number(p.percentual_alto_critico),
        critico: Number(p.percentual_critico),
        total: Number(p.total_respostas_validas),
        enunciado: enun?.texto ?? "",
        inversa: !!enun?.inversa,
      };
    });
    let filtered = raw;
    if (filtroFator !== "all") filtered = filtered.filter((r) => r.fator_id === filtroFator);
    if (filtroClass !== "all") filtered = filtered.filter((r) => r.classificacao === filtroClass);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      filtered = filtered.filter((r) => r.enunciado.toLowerCase().includes(q) || String(r.numero).includes(q) || r.fator_nome.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => {
      const dir = asc ? 1 : -1;
      const v = sort === "numero" ? a.numero - b.numero
              : sort === "score" ? a.score - b.score
              : sort === "desfav" ? a.desfav - b.desfav
              : sort === "ac" ? a.ac - b.ac
              : a.critico - b.critico;
      return v * dir;
    });
    return filtered;
  }, [perguntasQ.data, enunciadosQ.data, fatoresMap, filtroFator, filtroClass, busca, sort, asc]);

  const loading = dashQ.isLoading || perguntasQ.isLoading;
  if (loading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando perguntas…</CardContent></Card>;
  if (!dashQ.data || dashQ.data.ok === false) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Mapa de perguntas indisponível</AlertTitle>
        <AlertDescription>{dashQ.data && dashQ.data.ok === false ? dashQ.data.message : "Não foi possível carregar."}</AlertDescription>
      </Alert>
    );
  }

  const dash = dashQ.data.data;

  const cellBg = (r: typeof rows[number]): string => {
    if (colorMode === "classificacao") return RISK_COLOR[r.classificacao];
    if (colorMode === "critico") {
      const v = r.critico;
      if (v >= 30) return RISK_COLOR.critico;
      if (v >= 15) return RISK_COLOR.alto;
      if (v >= 5) return RISK_COLOR.medio;
      if (v > 0) return RISK_COLOR.baixo;
      return RISK_COLOR.irrelevante;
    }
    const v = r.desfav;
    if (v >= 60) return RISK_COLOR.critico;
    if (v >= 40) return RISK_COLOR.alto;
    if (v >= 25) return RISK_COLOR.medio;
    if (v >= 10) return RISK_COLOR.baixo;
    return RISK_COLOR.irrelevante;
  };

  const toggleSort = (k: SortKey) => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(k === "numero"); } };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapa das perguntas</CardTitle>
          <p className="text-xs text-muted-foreground">
            {rows.length} perguntas exibidas · dados agregados sem qualquer identificação individual.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar por texto, número ou fator…" className="pl-7 h-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={filtroFator} onValueChange={setFiltroFator}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Fator" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fatores</SelectItem>
                {dash.fatores.map((f) => <SelectItem key={f.fator_id} value={f.fator_id}>{f.fator_nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroClass} onValueChange={setFiltroClass}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Classificação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as classificações</SelectItem>
                {(["critico","alto","medio","baixo","irrelevante"] as ClassificacaoRisco[]).map((c) => (
                  <SelectItem key={c} value={c}>{CLASSIF_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={colorMode} onValueChange={(v) => setColorMode(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classificacao">Colorir por classificação</SelectItem>
                <SelectItem value="critico">Colorir por % crítico</SelectItem>
                <SelectItem value="desfav">Colorir por % desfavorável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5" role="grid" aria-label="Heatmap de perguntas">
            {rows.map((r) => (
              <div key={r.pergunta_id}
                title={`Q${r.numero} — ${r.fator_nome}\n${r.enunciado || ""}\nScore ${fmt(r.score,2)} · ${CLASSIF_LABEL[r.classificacao]}\nDesfav ${fmtPct(r.desfav,1)} · A+C ${fmtPct(r.ac,1)} · Crítico ${fmtPct(r.critico,1)}`}
                style={{ background: cellBg(r) }}
                className="rounded flex flex-col items-center justify-center py-2 text-white shadow-sm cursor-help">
                <div className="text-[10px] uppercase tracking-wider opacity-90">Q</div>
                <div className="font-mono font-bold text-sm leading-none">{r.numero}</div>
                <div className="text-[10px] font-mono opacity-95 mt-0.5">{r.score.toFixed(2)}</div>
              </div>
            ))}
            {rows.length === 0 && <div className="col-span-full text-center text-xs text-muted-foreground py-6">Nenhuma pergunta encontrada com os filtros aplicados.</div>}
          </div>

          <LegendaCores mode={colorMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tabela técnica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left">
                <tr className="border-b text-muted-foreground">
                  <Th onClick={() => toggleSort("numero")} active={sort==="numero"} asc={asc}>#</Th>
                  <th className="py-2 pr-2">Fator</th>
                  <th className="py-2 pr-2">Enunciado</th>
                  <Th onClick={() => toggleSort("score")} active={sort==="score"} asc={asc} align="right">Score</Th>
                  <th className="py-2 pr-2">Classificação</th>
                  <Th onClick={() => toggleSort("desfav")} active={sort==="desfav"} asc={asc} align="right">% Desfav.</Th>
                  <Th onClick={() => toggleSort("ac")} active={sort==="ac"} asc={asc} align="right">% A+C</Th>
                  <Th onClick={() => toggleSort("critico")} active={sort==="critico"} asc={asc} align="right">% Crítico</Th>
                  <th className="py-2 pr-2 text-right">n</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.pergunta_id} className="border-b last:border-0 align-top hover:bg-accent/30">
                    <td className="py-1.5 pr-2 font-mono">{r.numero}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{r.fator_nome}</td>
                    <td className="py-1.5 pr-2 min-w-[260px]">{r.enunciado || <span className="text-muted-foreground">—</span>}{r.inversa && <span className="ml-1 text-[10px] uppercase text-muted-foreground">(inv)</span>}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{fmt(r.score, 2)}</td>
                    <td className="py-1.5 pr-2"><Badge className={classifBadgeClass(r.classificacao)}>{CLASSIF_SHORT[r.classificacao]}</Badge></td>
                    <td className="py-1.5 pr-2 text-right font-mono">{fmtPct(r.desfav, 1)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{fmtPct(r.ac, 1)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{fmtPct(r.critico, 1)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-muted-foreground">{r.total}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">—</td></tr>}
              </tbody>
            </table>
          </div>
          <AvisoMetodologico className="text-[11px] text-muted-foreground mt-3" />
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children, onClick, active, asc, align = "left" }: any) {
  return (
    <th className={`py-2 pr-2 ${align === "right" ? "text-right" : ""} cursor-pointer select-none`} onClick={onClick}>
      <span className={active ? "text-foreground font-medium" : ""}>{children}{active ? (asc ? " ↑" : " ↓") : ""}</span>
    </th>
  );
}

function LegendaCores({ mode }: { mode: "classificacao" | "critico" | "desfav" }) {
  const items = mode === "classificacao"
    ? (["irrelevante","baixo","medio","alto","critico"] as ClassificacaoRisco[]).map((k) => ({ label: CLASSIF_LABEL[k], color: RISK_COLOR[k] }))
    : mode === "critico"
    ? [
        { label: "0%", color: RISK_COLOR.irrelevante },
        { label: ">0–5%", color: RISK_COLOR.baixo },
        { label: "5–15%", color: RISK_COLOR.medio },
        { label: "15–30%", color: RISK_COLOR.alto },
        { label: "≥30%", color: RISK_COLOR.critico },
      ]
    : [
        { label: "<10%", color: RISK_COLOR.irrelevante },
        { label: "10–25%", color: RISK_COLOR.baixo },
        { label: "25–40%", color: RISK_COLOR.medio },
        { label: "40–60%", color: RISK_COLOR.alto },
        { label: "≥60%", color: RISK_COLOR.critico },
      ];
  return (
    <div className="flex flex-wrap gap-2 items-center text-[11px] pt-1">
      <span className="text-muted-foreground">Legenda:</span>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
