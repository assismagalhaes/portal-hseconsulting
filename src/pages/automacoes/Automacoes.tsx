import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AUTOMACAO_TIPO_LABEL, executarAutomacaoManual } from "@/lib/automacoes";
import { Play, Search, History, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface Auto {
  id: string; nome: string; descricao: string | null; tipo: string;
  ativa: boolean; agendamento_cron: string | null; ultima_execucao: string | null;
  prioridade_padrao: string;
}

export default function Automacoes() {
  const [list, setList] = useState<Auto[]>([]);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [running, setRunning] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("automacoes").select("*").order("tipo").order("nome");
    setList((data as Auto[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function toggle(a: Auto) {
    await supabase.from("automacoes").update({ ativa: !a.ativa }).eq("id", a.id);
    load();
  }

  async function exec(a: Auto) {
    setRunning(a.id);
    try {
      const r = await executarAutomacaoManual(a.id);
      toast.success(`Executada — ${r.afetados ?? 0} registros`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally { setRunning(null); }
  }

  const filtered = list.filter((a) =>
    (tipo === "todos" || a.tipo === tipo) &&
    (!busca || a.nome.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Automações"
        subtitle="Regras automáticas internas — notificações, tarefas, alertas e resumos"
        actions={(
          <>
            <Button asChild variant="outline"><Link to="/automacoes/dashboard"><BarChart3 className="h-4 w-4 mr-2" /> Painel</Link></Button>
            <Button asChild variant="outline"><Link to="/automacoes/execucoes"><History className="h-4 w-4 mr-2" /> Histórico</Link></Button>
          </>
        )}
      />
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar automação..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(AUTOMACAO_TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Última execução</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.nome}</div>
                    {a.descricao && <div className="text-xs text-muted-foreground">{a.descricao}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{AUTOMACAO_TIPO_LABEL[a.tipo] ?? a.tipo}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{a.agendamento_cron ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a.ultima_execucao ? new Date(a.ultima_execucao).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell><Switch checked={a.ativa} onCheckedChange={() => toggle(a)} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={running === a.id} onClick={() => exec(a)}>
                      <Play className="h-3 w-3 mr-1" /> Executar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma automação</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}