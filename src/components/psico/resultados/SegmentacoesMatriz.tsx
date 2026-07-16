import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { getPsicoSegmentComparison } from "@/lib/psicoResultados";
import { CLASSIF_LABEL, CLASSIF_SHORT, PRIO_LABEL, RISK_COLOR, classifBadgeClass, prioBadgeClass, fmt, AvisoMetodologico } from "./shared";

type Tipo = "funcao" | "setor" | "unidade";

export default function SegmentacoesMatriz({ avaliacaoId }: { avaliacaoId: string }) {
  const [tipo, setTipo] = useState<Tipo>("funcao");

  const q = useQuery({
    queryKey: ["psico", "comparacao-segmentos", avaliacaoId, tipo],
    queryFn: () => getPsicoSegmentComparison(avaliacaoId, tipo),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comparação entre segmentos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Apenas segmentos que atendem ao mínimo metodológico aparecem. Não há ranking nem cruzamento função × setor.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
            <TabsList>
              <TabsTrigger value="funcao">Função</TabsTrigger>
              <TabsTrigger value="setor">Setor</TabsTrigger>
              <TabsTrigger value="unidade">Unidade</TabsTrigger>
            </TabsList>
          </Tabs>

          {q.isLoading && <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando…</div>}

          {q.data && q.data.ok === false && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Comparação indisponível</AlertTitle>
              <AlertDescription>{q.data.message}</AlertDescription>
            </Alert>
          )}

          {q.data && q.data.ok && <MatrizConteudo comp={q.data.data} />}
        </CardContent>
      </Card>
      <AvisoMetodologico />
    </div>
  );
}

function MatrizConteudo({ comp }: { comp: import("@/lib/psicoResultados").PsicoComparacao }) {
  const cell = useMemo(() => {
    const m = new Map<string, typeof comp.matriz[number]>();
    comp.matriz.forEach((c) => m.set(`${c.segmento_id}::${c.fator_id}`, c));
    return m;
  }, [comp.matriz]);

  if (comp.segmentos.length === 0) {
    return (
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertTitle>Sem segmentos elegíveis</AlertTitle>
        <AlertDescription>Nenhum segmento deste tipo atende ao mínimo metodológico exigido para exibição de resultado.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background border-b border-r py-2 px-3 text-left min-w-[240px]">Segmento</th>
              {comp.fatores.map((f) => (
                <th key={f.fator_id} className="border-b py-2 px-2 text-center min-w-[110px]">
                  <div className="text-[10px] font-mono text-muted-foreground">{f.codigo}</div>
                  <div className="text-[11px] font-medium leading-tight">{f.nome}</div>
                </th>
              ))}
              <th className="border-b py-2 px-2 text-center min-w-[110px]">Índice geral</th>
            </tr>
          </thead>
          <tbody>
            {comp.segmentos.map((s) => (
              <tr key={s.id}>
                <td className="sticky left-0 z-10 bg-background border-b border-r py-2 px-3 align-top">
                  <div className="font-medium">{s.rotulo}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{s.respondentes} respondente(s)</span>
                    {s.amostra_reduzida && <Badge variant="outline" className="text-[9px] py-0 h-4">Amostra reduzida</Badge>}
                  </div>
                  <div className="mt-1"><Badge className={prioBadgeClass(s.prioridade_maxima)}>{PRIO_LABEL[s.prioridade_maxima]}</Badge></div>
                </td>
                {comp.fatores.map((f) => {
                  const c = cell.get(`${s.id}::${f.fator_id}`);
                  if (!c) return <td key={f.fator_id} className="border-b py-2 px-2 text-center text-muted-foreground">—</td>;
                  return (
                    <td key={f.fator_id} className="border-b p-1.5 text-center align-top">
                      <div title={`${CLASSIF_LABEL[c.classificacao_media]} · A+C ${Number(c.percentual_alto_critico).toFixed(1)}% · Crítico ${Number(c.percentual_critico).toFixed(1)}%`}
                        className="rounded px-1.5 py-1 text-white"
                        style={{ background: RISK_COLOR[c.classificacao_media] }}>
                        <div className="font-mono font-semibold text-sm">{fmt(c.score_medio, 2)}</div>
                        <div className="text-[10px] opacity-95">{CLASSIF_SHORT[c.classificacao_media]}{c.significativo ? " · sig." : ""}</div>
                      </div>
                    </td>
                  );
                })}
                <td className="border-b p-1.5 text-center align-top">
                  <div className="rounded px-1.5 py-1 text-white" style={{ background: RISK_COLOR[s.classificacao_indice_geral] }}>
                    <div className="font-mono font-semibold text-sm">{fmt(s.indice_geral_descritivo, 2)}</div>
                    <div className="text-[10px] opacity-95">{CLASSIF_SHORT[s.classificacao_indice_geral]}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Cada célula mostra o score médio (0–4) e a classificação daquele fator no segmento correspondente. A marcação
        “sig.” indica fator significativo — atendeu a pelo menos um critério metodológico.
      </div>
    </div>
  );
}