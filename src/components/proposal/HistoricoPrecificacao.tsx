import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { rateioRegraLabel } from "@/lib/groupPricing";

export default function HistoricoPrecificacao({ proposalId }: { proposalId: string }) {
  const [hist, setHist] = useState<any[]>([]);
  const [sims, setSims] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [h, s] = await Promise.all([
        supabase.from("historico_precificacao").select("*").eq("proposal_id", proposalId).order("created_at", { ascending: false }).limit(80),
        supabase.from("simulacoes_precificacao").select("*").eq("proposal_id", proposalId).order("created_at", { ascending: false }).limit(30),
      ]);
      setHist(h.data || []);
      setSims(s.data || []);
    })();
  }, [proposalId]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-display font-semibold">Simulações</h3>
        {sims.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma simulação registrada ainda.</p>}
        <ul className="space-y-2">
          {sims.map((s) => (
            <li key={s.id} className="border border-border rounded-md p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={s.tipo === "agrupada" ? "default" : "secondary"}>{s.tipo}</Badge>
                  <span>{rateioRegraLabel[s.regra_rateio as keyof typeof rateioRegraLabel] || s.regra_rateio}</span>
                  {s.aplicada && <Badge variant="outline" className="text-success border-success/30">aplicada</Badge>}
                </div>
                <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</span>
              </div>
              {s.totais?.receita_total != null && (
                <p className="mt-1 text-muted-foreground">
                  Receita {brl(s.totais.receita_total)} · Custo {brl(s.totais.custo_geral)} · Lucro {brl(s.totais.lucro_total)}
                </p>
              )}
              {s.observacoes && <p className="mt-1">{s.observacoes}</p>}
              {s.motivo && <p className="mt-1"><span className="text-muted-foreground">Motivo:</span> {s.motivo}</p>}
              {s.valor_hora_tecnica_aplicado != null && (
                <p className="mt-1 text-muted-foreground">Hora técnica aplicada: {brl(s.valor_hora_tecnica_aplicado)}/h</p>
              )}
            </li>
          ))}
        </ul>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-display font-semibold">Histórico de alterações de preço</h3>
        {hist.length === 0 && <p className="text-xs text-muted-foreground">Sem alterações ainda.</p>}
        <ul className="space-y-1.5 text-xs">
          {hist.map((h) => (
            <li key={h.id} className="flex items-center justify-between border-b border-border/50 py-1">
              <span>
                <Badge variant="outline" className="mr-2">{h.acao}</Badge>
                {h.detalhes?.regra && <span className="text-muted-foreground">{h.detalhes.regra}</span>}
                {h.motivo && <span className="text-muted-foreground ml-2">· {h.motivo}</span>}
              </span>
              <span className="font-mono">{brl(h.valor_anterior || 0)} → {brl(h.valor_novo || 0)}</span>
              <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      </CardContent></Card>
    </div>
  );
}