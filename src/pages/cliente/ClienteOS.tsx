import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ClienteOS() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    document.title = "Ordens de Serviço | Portal do Cliente";
    supabase.from("ordens_servico")
      .select("id, numero, titulo, objetivo, status, data_prevista_inicio, data_prevista_conclusao, cidade, endereco")
      .order("data_prevista_inicio", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);
  return (
    <div>
      <PageHeader title="Ordens de Serviço" subtitle="Visitas e atividades agendadas" />
      <div className="p-6 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma OS disponível.</div>}
        {items.map(o => (
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
    </div>
  );
}