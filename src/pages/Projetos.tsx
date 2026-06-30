import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { brl, formatDate } from "@/lib/format";
import { projetoStatusColor, projetoStatusLabel } from "@/lib/projetos";
import { FolderKanban, Search } from "lucide-react";

export default function Projetos() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    document.title = "Projetos | Portal HSE Consulting";
    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, numero, titulo, status, valor_contratado, percentual_progresso, data_inicio, data_fim_prevista, created_at, clients(razao_social, nome_fantasia), proposals(numero)")
        .order("created_at", { ascending: false });
      setRows(data || []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      const cli = (r.clients?.nome_fantasia || r.clients?.razao_social || "").toLowerCase();
      return (r.numero || "").toLowerCase().includes(term) || (r.titulo || "").toLowerCase().includes(term) || cli.includes(term);
    });
  }, [rows, q, status]);

  const kpis = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of rows) by[r.status] = (by[r.status] || 0) + 1;
    return by;
  }, [rows]);

  return (
    <div>
      <PageHeader title="Projetos" subtitle="Centro operacional pós-aprovação — contratos, serviços, OS e documentação" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(["planejamento","em_execucao","em_revisao","atrasado","concluido","cancelado"] as const).map((s) => (
            <Card key={s} className="shadow-elegant">
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{projetoStatusLabel[s]}</div>
                <div className="font-display text-2xl font-bold mt-1">{kpis[s] || 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por número, título ou cliente..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(projetoStatusLabel).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-elegant">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
                Nenhum projeto encontrado. Projetos são criados automaticamente quando uma proposta é aprovada.
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((r) => (
                  <li key={r.id} className="hover:bg-muted/40">
                    <Link to={`/projetos/${r.id}`} className="flex items-center gap-4 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{r.numero}</span>
                          <span className="font-medium truncate">{r.titulo}</span>
                          {r.proposals?.numero && <Badge variant="outline" className="text-[10px]">prop {r.proposals.numero}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.clients?.nome_fantasia || r.clients?.razao_social || "—"}
                        </div>
                      </div>
                      <div className="w-40">
                        <Progress value={r.percentual_progresso || 0} className="h-2" />
                        <div className="text-[10px] text-muted-foreground mt-1 text-right">{r.percentual_progresso || 0}%</div>
                      </div>
                      <div className="text-xs text-muted-foreground w-28 text-right">
                        <div>Início: {formatDate(r.data_inicio)}</div>
                        <div>Fim: {formatDate(r.data_fim_prevista)}</div>
                      </div>
                      <div className="font-mono text-sm w-28 text-right">{brl(r.valor_contratado)}</div>
                      <Badge className={projetoStatusColor[r.status] + " border-0 whitespace-nowrap"}>{projetoStatusLabel[r.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}