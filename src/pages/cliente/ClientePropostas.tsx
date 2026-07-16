import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { brl } from "@/lib/format";
import { PROPOSTA_STATUS_CLIENTE, registrarLogCliente } from "@/lib/cliente";

export default function ClientePropostas() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    document.title = "Propostas | Portal do Cliente";
    supabase.from("proposals")
      .select("id, numero, titulo, status, data_emissao, validade, valor_total, condicao_pagamento")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);
  return (
    <div>
      <PageHeader title="Propostas" subtitle="Propostas comerciais disponíveis para sua empresa" />
      <div className="p-6 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma proposta disponível.</div>}
        {items.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{p.numero || "(sem número)"}</span>
                  <Badge variant="outline">{PROPOSTA_STATUS_CLIENTE[p.status] || p.status}</Badge>
                </div>
                <div className="text-sm mt-1">{p.titulo}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Emitida: {p.data_emissao || "—"} • Validade: {p.validade || "—"} • {p.condicao_pagamento || ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Valor total</div>
                  <div className="font-display text-lg font-bold">{brl(p.valor_total || 0)}</div>
                </div>
                <Button asChild variant="secondary" size="sm"
                  onClick={() => registrarLogCliente("proposta_visualizada", p.numero)}>
                  <Link to={`/proposta-exemplo?id=${p.id}`} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 mr-1" />PDF</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}