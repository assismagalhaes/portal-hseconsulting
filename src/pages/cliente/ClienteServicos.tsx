import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export default function ClienteServicos() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    document.title = "Serviços | Portal do Cliente";
    supabase.from("execucao_servicos")
      .select("id, titulo, status, data_prevista_conclusao, data_prevista_inicio, resumo_cliente")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
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
      </div>
    </div>
  );
}