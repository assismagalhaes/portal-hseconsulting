import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { getPsicoDashboardResults, FatorResultado } from "@/lib/psicoResultados";
import {
  CLASSIF_LABEL, CLASSIF_SHORT, PRIO_LABEL, RISK_COLOR,
  classifBadgeClass, prioBadgeClass, fmt, fmtPct, AvisoMetodologico,
} from "./shared";

export default function FatoresDetalhados({ avaliacaoId, escopoId }: { avaliacaoId: string; escopoId: string }) {
  const dashQ = useQuery({
    queryKey: ["psico", "dashboard-resultados", avaliacaoId, escopoId],
    queryFn: () => getPsicoDashboardResults(avaliacaoId, escopoId),
    staleTime: 5 * 60 * 1000,
  });

  if (dashQ.isLoading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando fatores…</CardContent></Card>;
  if (!dashQ.data || dashQ.data.ok === false) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Fatores indisponíveis</AlertTitle>
        <AlertDescription>{dashQ.data && dashQ.data.ok === false ? dashQ.data.message : "Não foi possível carregar os fatores."}</AlertDescription>
      </Alert>
    );
  }

  const dash = dashQ.data.data;
  return (
    <div className="space-y-3">
      {dash.fatores.map((f) => (
        <FatorCard
          key={f.id}
          fator={f}
          perguntasAtencao={dash.perguntas_atencao.filter((p) => p.fator_id === f.fator_id).slice(0, 5)}
        />
      ))}
      <AvisoMetodologico />
    </div>
  );
}

function FatorCard({ fator: f, perguntasAtencao }: { fator: FatorResultado; perguntasAtencao: any[] }) {
  const [open, setOpen] = useState(false);
  const criterios: { label: string; ok: boolean }[] = [
    { label: "Principal (M+A+C > 50%)", ok: f.criterio_principal },
    { label: "Agravamento (A+C ≥ 30%)", ok: f.criterio_agravamento },
    { label: "Crítico automático (C ≥ 10%)", ok: f.criterio_critico_automatico },
  ];
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left px-4 py-3 hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-primary rounded-t-lg">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{f.ordem}</span>
                  <span className="font-semibold text-sm">{f.fator_nome}</span>
                </div>
                {f.fator_descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.fator_descricao}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-xs text-muted-foreground">Score</span>
                <span className="font-mono font-semibold">{fmt(f.score_medio, 2)}</span>
                <Badge className={classifBadgeClass(f.classificacao_media)}>{CLASSIF_LABEL[f.classificacao_media]}</Badge>
                <Badge className={prioBadgeClass(f.prioridade)}>{PRIO_LABEL[f.prioridade]}</Badge>
                {f.significativo
                  ? <Badge className="bg-rose-800 text-white hover:bg-rose-800">Significativo</Badge>
                  : <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">Não significativo</Badge>}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Distribuição das respostas ({f.total_respostas_validas} respostas válidas · {f.quantidade_perguntas} perguntas)</div>
              <DistBar fator={f} />
              <div className="mt-2 grid grid-cols-5 gap-1 text-[11px]">
                {(["irrelevante","baixo","medio","alto","critico"] as const).map((k) => (
                  <div key={k} className="text-center">
                    <div className="font-mono font-medium">{fmtPct((f as any)[`percentual_${k}`], 1)}</div>
                    <div className="text-muted-foreground">{CLASSIF_SHORT[k as any]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Critérios de significância</div>
              <div className="flex flex-wrap gap-2">
                {criterios.map((c) => (
                  <span key={c.label} className={`text-xs px-2 py-1 rounded border ${c.ok ? "border-rose-500/50 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-200" : "border-border bg-muted text-muted-foreground"}`}>
                    {c.ok ? "✓ " : "○ "}{c.label}
                  </span>
                ))}
              </div>
            </div>

            {perguntasAtencao.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Perguntas com maior atenção neste fator</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-1.5 pr-2">#</th>
                        <th className="py-1.5 pr-2">Enunciado</th>
                        <th className="py-1.5 pr-2 text-right">Score</th>
                        <th className="py-1.5 pr-2 text-right">Desfav.</th>
                        <th className="py-1.5 pr-2 text-right">A+C</th>
                        <th className="py-1.5 pr-2 text-right">Crítico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perguntasAtencao.map((p) => (
                        <tr key={p.pergunta_id} className="border-b last:border-0 align-top">
                          <td className="py-1.5 pr-2 font-mono">{p.numero}</td>
                          <td className="py-1.5 pr-2">{p.enunciado ?? "—"}{p.inversa && <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">(inversa)</span>}</td>
                          <td className="py-1.5 pr-2 text-right font-mono">{fmt(p.score_medio, 2)}</td>
                          <td className="py-1.5 pr-2 text-right font-mono">{fmtPct(p.percentual_desfavoravel, 1)}</td>
                          <td className="py-1.5 pr-2 text-right font-mono">{fmtPct(p.percentual_alto_critico, 1)}</td>
                          <td className="py-1.5 pr-2 text-right font-mono">{fmtPct(p.percentual_critico, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground border-t pt-2">
              Score em escala 0–4. Percentuais representam a distribuição das respostas válidas às {f.quantidade_perguntas} perguntas do fator — não classificam trabalhadores individualmente.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function DistBar({ fator: f }: { fator: FatorResultado }) {
  const segs = [
    { k: "irrelevante" as const, v: Number(f.percentual_irrelevante) },
    { k: "baixo" as const,       v: Number(f.percentual_baixo) },
    { k: "medio" as const,       v: Number(f.percentual_medio) },
    { k: "alto" as const,        v: Number(f.percentual_alto) },
    { k: "critico" as const,     v: Number(f.percentual_critico) },
  ];
  return (
    <div className="flex h-4 w-full rounded overflow-hidden border" role="img" aria-label={`Distribuição percentual — ${f.fator_nome}`}>
      {segs.map((s) => s.v > 0 && (
        <div key={s.k} style={{ width: `${s.v}%`, background: RISK_COLOR[s.k] }} title={`${CLASSIF_LABEL[s.k]}: ${s.v.toFixed(2)}%`} />
      ))}
    </div>
  );
}