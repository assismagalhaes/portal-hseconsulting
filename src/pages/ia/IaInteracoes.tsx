import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type I = { id: string; modulo: string; pergunta: string; resposta: string | null; created_at: string; model: string | null; tokens_input: number | null; tokens_output: number | null };

export default function IaInteracoes() {
  const [items, setItems] = useState<I[]>([]);
  useEffect(() => {
    supabase.from("ia_interacoes").select("id,modulo,pergunta,resposta,created_at,model,tokens_input,tokens_output").order("created_at", { ascending: false }).limit(100).then(({ data }) => setItems((data ?? []) as I[]));
  }, []);
  return (
    <div>
      <PageHeader title="Histórico de Interações da IA" subtitle="Auditoria de perguntas e respostas." />
      <div className="p-6 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma interação ainda.</div>}
        {items.map((i) => (
          <details key={i.id} className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer flex items-center gap-2">
              <Badge variant="outline">{i.modulo}</Badge>
              <span className="font-medium truncate flex-1">{i.pergunta}</span>
              <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString("pt-BR")}</span>
            </summary>
            <div className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">{i.resposta}</div>
            <div className="mt-2 text-[11px] text-muted-foreground">{i.model} · in {i.tokens_input ?? "?"} / out {i.tokens_output ?? "?"}</div>
          </details>
        ))}
      </div>
    </div>
  );
}