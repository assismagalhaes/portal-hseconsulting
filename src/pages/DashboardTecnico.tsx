import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { projetoStatusColor, projetoStatusLabel } from "@/lib/projetos";
import { formatDate } from "@/lib/format";
import { FolderKanban, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function DashboardTecnico() {
  const [projetos, setProjetos] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Painel Técnico | Portal HSE Consulting";
    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, numero, titulo, status, percentual_progresso, data_inicio, data_fim_prevista, updated_at, clients(razao_social, nome_fantasia)")
        .order("updated_at", { ascending: false });
      setProjetos(data || []);
    })();
  }, []);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);

  const kpis = useMemo(() => {
    let andamento = 0, concluidos = 0, proximos = 0, atrasados = 0;
    for (const p of projetos) {
      if (p.status === "concluido") concluidos++;
      else if (p.status === "atrasado") atrasados++;
      else if (["planejamento", "em_execucao", "em_revisao"].includes(p.status)) andamento++;
      const fim = p.data_fim_prevista ? new Date(p.data_fim_prevista) : null;
      if (fim && p.status !== "concluido" && fim >= hoje && fim <= em30) proximos++;
    }
    return { andamento, concluidos, proximos, atrasados };
  }, [projetos]);

  const recentes = projetos.slice(0, 8);
  const proximosPrazo = projetos
    .filter((p) => p.data_fim_prevista && p.status !== "concluido")
    .sort((a, b) => (a.data_fim_prevista || "").localeCompare(b.data_fim_prevista || ""))
    .slice(0, 6);

  const cards = [
    { label: "Em andamento", value: kpis.andamento, icon: Clock, color: "text-primary" },
    { label: "Concluídos", value: kpis.concluidos, icon: CheckCircle2, color: "text-success" },
    { label: "Próximos do prazo (30d)", value: kpis.proximos, icon: FolderKanban, color: "text-warning" },
    { label: "Atrasados", value: kpis.atrasados, icon: AlertTriangle, color: "text-danger" },
  ];

  return (
    <div>
      <PageHeader title="Meus Projetos" subtitle="Acompanhamento operacional — sem informações comerciais ou financeiras" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label} className="shadow-elegant">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-md p-2 bg-muted"><Icon className={`h-5 w-5 ${c.color}`} /></div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
                    <div className="font-display text-2xl font-bold">{c.value}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-elegant">
            <CardHeader><CardTitle className="text-base">Últimos projetos atualizados</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {recentes.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projetos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                          <span className="font-medium truncate text-sm">{p.titulo}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.clients?.nome_fantasia || p.clients?.razao_social || "—"}
                        </div>
                      </div>
                      <div className="w-28">
                        <Progress value={p.percentual_progresso || 0} className="h-1.5" />
                        <div className="text-[10px] text-muted-foreground mt-1 text-right">{p.percentual_progresso || 0}%</div>
                      </div>
                      <Badge className={projetoStatusColor[p.status] + " border-0 whitespace-nowrap"}>{projetoStatusLabel[p.status]}</Badge>
                    </Link>
                  </li>
                ))}
                {!recentes.length && <li className="p-8 text-center text-sm text-muted-foreground">Nenhum projeto disponível.</li>}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader><CardTitle className="text-base">Próximos prazos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {proximosPrazo.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projetos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{p.titulo}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.clients?.nome_fantasia || p.clients?.razao_social || "—"}</div>
                      </div>
                      <div className="text-xs text-right">
                        <div className="text-muted-foreground">Prazo</div>
                        <div className="font-medium">{formatDate(p.data_fim_prevista)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
                {!proximosPrazo.length && <li className="p-8 text-center text-sm text-muted-foreground">Sem prazos próximos.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}