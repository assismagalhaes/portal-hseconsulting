import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function ClienteServicos() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    document.title = "Serviços | Portal do Cliente";
    supabase.from("execucao_servicos")
      .select("id, titulo, status, percentual_executado, data_prevista_conclusao, observacoes_publicas, proxima_etapa, responsavel_tecnico_id")
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
              <div className="text-xs text-muted-foreground">Previsão de conclusão: {s.data_prevista_conclusao || "—"}</div>
              <Progress value={s.percentual_executado || 0} />
              <div className="text-xs">{s.percentual_executado || 0}% concluído</div>
              {s.proxima_etapa && <div className="text-xs"><b>Próxima etapa:</b> {s.proxima_etapa}</div>}
              {s.observacoes_publicas && <div className="text-xs text-muted-foreground">{s.observacoes_publicas}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}