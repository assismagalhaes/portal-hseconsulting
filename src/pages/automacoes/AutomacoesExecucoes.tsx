import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface Exec {
  id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  status: string;
  registros_afetados: number;
  notificacoes_criadas: number;
  tarefas_criadas: number;
  alertas_criados: number;
  detalhe: string | null;
  origem: string;
  automacao_id: string;
  automacoes?: { nome: string };
}

const STATUS_COLOR: Record<string, string> = {
  sucesso: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  parcial: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  erro: "bg-red-500/10 text-red-700 dark:text-red-300",
  ignorada: "bg-muted text-muted-foreground",
};

export default function AutomacoesExecucoes() {
  const [items, setItems] = useState<Exec[]>([]);
  useEffect(() => {
    supabase.from("automacoes_execucoes")
      .select("*, automacoes(nome)")
      .order("iniciado_em", { ascending: false })
      .limit(200)
      .then(({ data }) => setItems((data as unknown as Exec[]) ?? []));
  }, []);
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Histórico de Execuções" subtitle="Últimas 200 execuções de automações" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automação</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Afetados</TableHead>
                <TableHead>Notif.</TableHead>
                <TableHead>Tarefas</TableHead>
                <TableHead>Alertas</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.automacoes?.nome ?? "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(e.iniciado_em).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{e.duracao_ms ? `${e.duracao_ms} ms` : "—"}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[e.status] ?? ""}>{e.status}</Badge></TableCell>
                  <TableCell>{e.registros_afetados}</TableCell>
                  <TableCell>{e.notificacoes_criadas}</TableCell>
                  <TableCell>{e.tarefas_criadas}</TableCell>
                  <TableCell>{e.alertas_criados}</TableCell>
                  <TableCell className="text-xs">{e.origem}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem execuções registradas</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}