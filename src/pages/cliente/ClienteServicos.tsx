import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export default function ClienteServicos() {
  const [items, setItems] = useState<any[]>([]);
  const [atividades, setAtividades] = useState<any[]>([]);
  useEffect(() => {
    document.title = "Serviços | Portal do Cliente";
    supabase.from("execucao_servicos")
      .select("id, titulo, status, data_prevista_conclusao, data_prevista_inicio, resumo_cliente")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
    supabase.from("ordens_servico")
      .select("id, numero, titulo, objetivo, status, data_prevista_inicio, data_prevista_conclusao, cidade, endereco")
      .order("data_prevista_inicio", { ascending: false })
      .then(({ data }) => setAtividades(data || []));
  }, []);
  return (
    <div>
      <PageHeader title="Serviços contratados" subtitle="Acompanhe o andamento dos serviços em execução" />
      <div className="p-6 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhum serviço em execução disponível.</div>}
        {items.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{s.titulo}</div>
                <Badge variant="outline">{s.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Início: {s.data_prevista_inicio || "—"} • Conclusão: {s.data_prevista_conclusao || "—"}
              </div>
              {s.resumo_cliente && <div className="text-sm">{s.resumo_cliente}</div>}
            </CardContent>
          </Card>
        ))}

        {atividades.length > 0 && (
          <div className="pt-6 space-y-3">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Atividades planejadas</div>
            {atividades.map(o => (
              <Card key={o.id}>
                <CardContent className="p-4 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{o.numero} — {o.titulo}</div>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>
                  {o.objetivo && <div className="text-sm">{o.objetivo}</div>}
                  <div className="text-xs text-muted-foreground">
                    {o.data_prevista_inicio || "—"} a {o.data_prevista_conclusao || "—"} • {o.cidade || ""} {o.endereco ? "— " + o.endereco : ""}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}