import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import VisaoExecutiva from "./VisaoExecutiva";
import FatoresDetalhados from "./FatoresDetalhados";
import MapaPerguntas from "./MapaPerguntas";
import SegmentacoesMatriz from "./SegmentacoesMatriz";
import MetodologiaPainel from "./MetodologiaPainel";
import { AVISO_METODOLOGICO } from "./shared";

type EscopoResumo = {
  id: string;
  tipo: "global" | "funcao" | "setor" | "unidade";
  rotulo: string;
  respondentes: number;
  amostra_reduzida: boolean;
};

/**
 * Dashboard consolidado dos resultados psicossociais.
 * Consome APENAS RPCs homologadas (nenhum cálculo local).
 */
export default function PsicoDashboardResultados({ avaliacaoId }: { avaliacaoId: string }) {
  const [escopoId, setEscopoId] = useState<string | null>(null);
  const [tab, setTab] = useState<"executiva" | "fatores" | "perguntas" | "segmentacoes" | "metodologia">("executiva");

  const escoposQ = useQuery({
    queryKey: ["psico", "escopos-resultado", avaliacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("psico_listar_escopos_resultado" as any, { p_avaliacao_id: avaliacaoId } as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const escoposLista: EscopoResumo[] = useMemo(() => {
    const raw = (escoposQ.data || []) as any[];
    return raw.map((e) => ({
      id: e.id, tipo: e.tipo, rotulo: e.rotulo,
      respondentes: Number(e.respondentes ?? 0),
      amostra_reduzida: !!e.amostra_reduzida,
    }));
  }, [escoposQ.data]);

  // Escopo padrão = global
  useEffect(() => {
    if (!escopoId && escoposLista.length > 0) {
      const g = escoposLista.find((e) => e.tipo === "global") ?? escoposLista[0];
      setEscopoId(g.id);
    }
  }, [escopoId, escoposLista]);

  if (escoposQ.isLoading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando escopos…</CardContent></Card>;
  }

  if (escoposLista.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Resultado indisponível</AlertTitle>
        <AlertDescription>Não foi possível carregar o resultado consolidado desta avaliação.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="executiva">Visão Executiva</TabsTrigger>
          <TabsTrigger value="fatores">Fatores</TabsTrigger>
          <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
          <TabsTrigger value="segmentacoes">Segmentações</TabsTrigger>
          <TabsTrigger value="metodologia">Metodologia</TabsTrigger>
        </TabsList>

        <TabsContent value="executiva" className="mt-4">
          {escopoId && (
            <VisaoExecutiva
              avaliacaoId={avaliacaoId}
              escopoId={escopoId}
              onChangeEscopo={setEscopoId}
              escoposDisponiveis={escoposLista}
            />
          )}
        </TabsContent>

        <TabsContent value="fatores" className="mt-4">
          {escopoId && <FatoresDetalhados avaliacaoId={avaliacaoId} escopoId={escopoId} />}
        </TabsContent>

        <TabsContent value="perguntas" className="mt-4">
          {escopoId && <MapaPerguntas avaliacaoId={avaliacaoId} escopoId={escopoId} />}
        </TabsContent>

        <TabsContent value="segmentacoes" className="mt-4">
          <SegmentacoesMatriz avaliacaoId={avaliacaoId} />
        </TabsContent>

        <TabsContent value="metodologia" className="mt-4">
          {escopoId && <MetodologiaPainel avaliacaoId={avaliacaoId} escopoId={escopoId} />}
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground border-t pt-2">{AVISO_METODOLOGICO}</p>
    </div>
  );
}


