import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Bell, CheckCircle2, ListTodo, Play, AlertTriangle, ArrowRight } from "lucide-react";
import { executarTodasAutomacoes } from "@/lib/automacoes";
import { toast } from "sonner";

export default function AutomacoesDashboard() {
  const [stats, setStats] = useState({
    ativas: 0, total: 0, execHoje: 0, errosHoje: 0,
    notifHoje: 0, tarefasHoje: 0, alertasHoje: 0,
    ultima: null as string | null, proxima: null as string | null,
  });
  const [running, setRunning] = useState(false);

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const iso = today.toISOString();
    const [a, e, errs, nots, tars, alts, ult, prox] = await Promise.all([
      supabase.from("automacoes").select("id,ativa"),
      supabase.from("automacoes_execucoes").select("id").gte("iniciado_em", iso),
      supabase.from("automacoes_execucoes").select("id").gte("iniciado_em", iso).eq("status", "erro"),
      supabase.from("notificacoes").select("id").gte("created_at", iso),
      supabase.from("tarefas").select("id").gte("created_at", iso),
      supabase.from("ia_alertas").select("id").gte("created_at", iso),
      supabase.from("automacoes").select("ultima_execucao").order("ultima_execucao", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      supabase.from("automacoes").select("proxima_execucao").order("proxima_execucao", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    ]);
    const all = (a.data ?? []) as { ativa: boolean }[];
    setStats({
      total: all.length,
      ativas: all.filter((x) => x.ativa).length,
      execHoje: e.data?.length ?? 0,
      errosHoje: errs.data?.length ?? 0,
      notifHoje: nots.data?.length ?? 0,
      tarefasHoje: tars.data?.length ?? 0,
      alertasHoje: alts.data?.length ?? 0,
      ultima: (ult.data?.ultima_execucao as string | null) ?? null,
      proxima: (prox.data?.proxima_execucao as string | null) ?? null,
    });
  }
  useEffect(() => { load(); }, []);

  async function runAll() {
    setRunning(true);
    try {
      await executarTodasAutomacoes();
      toast.success("Automações executadas");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao executar");
    } finally { setRunning(false); }
  }

  const cards = [
    { label: "Ativas", value: `${stats.ativas}/${stats.total}`, icon: Activity },
    { label: "Execuções hoje", value: stats.execHoje, icon: Play },
    { label: "Com erro hoje", value: stats.errosHoje, icon: AlertTriangle },
    { label: "Notificações hoje", value: stats.notifHoje, icon: Bell },
    { label: "Tarefas criadas", value: stats.tarefasHoje, icon: ListTodo },
    { label: "Alertas criados", value: stats.alertasHoje, icon: CheckCircle2 },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Saúde das Automações"
        subtitle="Painel de monitoramento e execução de rotinas internas"
        actions={(
          <>
            <Button onClick={runAll} disabled={running}>
              <Play className="h-4 w-4 mr-2" /> {running ? "Executando..." : "Executar agora"}
            </Button>
            <Button asChild variant="outline"><Link to="/automacoes">Ver automações</Link></Button>
          </>
        )}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mt-1">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Cronograma</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Última execução</div>
            <div className="font-medium">{stats.ultima ? new Date(stats.ultima).toLocaleString("pt-BR") : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Próxima execução prevista</div>
            <div className="font-medium">{stats.proxima ? new Date(stats.proxima).toLocaleString("pt-BR") : "—"}</div>
          </div>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-3 gap-3">
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-1"><Link to="/automacoes"><Activity className="h-5 w-5" /><span>Automações <ArrowRight className="inline h-3 w-3" /></span></Link></Button>
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-1"><Link to="/notificacoes"><Bell className="h-5 w-5" /><span>Notificações</span></Link></Button>
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-1"><Link to="/tarefas"><ListTodo className="h-5 w-5" /><span>Tarefas</span></Link></Button>
      </div>
    </div>
  );
}