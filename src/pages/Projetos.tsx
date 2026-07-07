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
import { FolderKanban, Search, MapPin, User2, Calendar, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Projetos() {
  const { isTecnico } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [servicosByProjeto, setServicosByProjeto] = useState<Record<string, string[]>>({});
  const [respByProjeto, setRespByProjeto] = useState<Record<string, string>>({});
  const [valoresByProjeto, setValoresByProjeto] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [cliente, setCliente] = useState<string>("all");
  const [servicoFiltro, setServicoFiltro] = useState<string>("all");
  const [prazo, setPrazo] = useState<string>("all");

  useEffect(() => {
    document.title = "Projetos | Portal HSE Consulting";
    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, numero, titulo, status, percentual_progresso, data_inicio, data_fim_prevista, responsavel_execucao_id, created_at, clients(razao_social, nome_fantasia, cidade, uf), proposals(numero)")
        .order("created_at", { ascending: false });
      const list = data || [];
      setRows(list);

      const ids = list.map((r: any) => r.id);
      if (ids.length) {
        const { data: servs } = await supabase
          .from("projeto_servicos")
          .select("projeto_id, nome")
          .in("projeto_id", ids);
        const map: Record<string, string[]> = {};
        (servs || []).forEach((s: any) => {
          (map[s.projeto_id] ||= []).push(s.nome);
        });
        setServicosByProjeto(map);

        const respIds = Array.from(new Set(list.map((r: any) => r.responsavel_execucao_id).filter(Boolean)));
        if (respIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id, nome, email").in("id", respIds);
          const rmap: Record<string, string> = {};
          (profs || []).forEach((p: any) => { rmap[p.id] = p.nome || p.email; });
          setRespByProjeto(rmap);
        }

        if (!isTecnico) {
          const { data: vals } = await supabase.rpc("get_projetos_valores", { _ids: ids });
          const vmap: Record<string, number> = {};
          (vals || []).forEach((v: any) => { vmap[v.id] = Number(v.valor_contratado || 0); });
          setValoresByProjeto(vmap);
        }
      }
    })();
  }, [isTecnico]);

  const clientesUnicos = useMemo(() => {
    const s = new Map<string, string>();
    rows.forEach((r) => {
      const nome = r.clients?.nome_fantasia || r.clients?.razao_social;
      if (nome) s.set(nome, nome);
    });
    return Array.from(s.keys()).sort();
  }, [rows]);

  const servicosUnicos = useMemo(() => {
    const s = new Set<string>();
    Object.values(servicosByProjeto).forEach((arr) => arr.forEach((n) => s.add(n)));
    return Array.from(s).sort();
  }, [servicosByProjeto]);

  const diasRestantes = (prazoDate?: string | null) => {
    if (!prazoDate) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const p = new Date(prazoDate); p.setHours(0, 0, 0, 0);
    return Math.round((p.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      const cli = (r.clients?.nome_fantasia || r.clients?.razao_social || "").toLowerCase();
      if (cliente !== "all" && cli !== cliente.toLowerCase()) return false;
      const servs = servicosByProjeto[r.id] || [];
      if (servicoFiltro !== "all" && !servs.includes(servicoFiltro)) return false;
      if (prazo !== "all") {
        const dr = diasRestantes(r.data_fim_prevista);
        if (prazo === "atrasado" && !(dr !== null && dr < 0)) return false;
        if (prazo === "30d" && !(dr !== null && dr >= 0 && dr <= 30)) return false;
        if (prazo === "60d" && !(dr !== null && dr >= 0 && dr <= 60)) return false;
        if (prazo === "sem_prazo" && r.data_fim_prevista) return false;
      }
      if (!term) return true;
      const inServ = servs.some((s) => s.toLowerCase().includes(term));
      return (r.numero || "").toLowerCase().includes(term)
        || (r.titulo || "").toLowerCase().includes(term)
        || cli.includes(term)
        || inServ;
    });
  }, [rows, q, status, cliente, servicoFiltro, prazo, servicosByProjeto]);

  const kpis = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of rows) by[r.status] = (by[r.status] || 0) + 1;
    return by;
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Projetos"
        subtitle={isTecnico ? "Acompanhamento operacional — serviços, OS e documentação" : "Centro operacional pós-aprovação — contratos, serviços, OS e documentação"}
      />
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por número, título, cliente ou serviço..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(projetoStatusLabel).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cliente} onValueChange={setCliente}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos clientes</SelectItem>
              {clientesUnicos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={servicoFiltro} onValueChange={setServicoFiltro}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Serviço" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos serviços</SelectItem>
              {servicosUnicos.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prazo} onValueChange={setPrazo}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Prazo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer prazo</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
              <SelectItem value="30d">Próximos 30 dias</SelectItem>
              <SelectItem value="60d">Próximos 60 dias</SelectItem>
              <SelectItem value="sem_prazo">Sem prazo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card className="shadow-elegant"><CardContent className="p-12 text-center text-muted-foreground">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum projeto encontrado. Projetos são criados automaticamente quando uma proposta é aprovada.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => {
              const cli = r.clients?.nome_fantasia || r.clients?.razao_social || "—";
              const cidade = [r.clients?.cidade, r.clients?.uf].filter(Boolean).join(" - ");
              const servs = servicosByProjeto[r.id] || [];
              const dr = diasRestantes(r.data_fim_prevista);
              const drLabel = dr === null ? "—" : dr < 0 ? `${Math.abs(dr)} dias em atraso` : dr === 0 ? "vence hoje" : `${dr} dias restantes`;
              const drColor = dr === null ? "text-muted-foreground" : dr < 0 ? "text-rose-700" : dr <= 7 ? "text-amber-700" : "text-emerald-700";
              const resp = r.responsavel_execucao_id ? respByProjeto[r.responsavel_execucao_id] : null;
              return (
                <Link key={r.id} to={`/projetos/${r.id}`} className="block">
                  <Card className="shadow-elegant hover:shadow-lg transition-shadow h-full">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{r.numero}</span>
                            {r.proposals?.numero && <Badge variant="outline" className="text-[10px]">prop {r.proposals.numero}</Badge>}
                          </div>
                          <div className="font-semibold truncate mt-0.5">{r.titulo}</div>
                        </div>
                        <Badge className={projetoStatusColor[r.status] + " border-0 whitespace-nowrap"}>{projetoStatusLabel[r.status]}</Badge>
                      </div>

                      <div className="text-sm">
                        <div className="font-medium truncate">{cli}</div>
                        {cidade && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {cidade}
                          </div>
                        )}
                      </div>

                      {servs.length > 0 && (
                        <div className="flex items-start gap-1.5 text-xs">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="text-muted-foreground line-clamp-2">
                            <span className="font-medium text-foreground">Serviços: </span>
                            {servs.slice(0, 5).join(", ")}{servs.length > 5 ? ` +${servs.length - 5}` : ""}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User2 className="h-3.5 w-3.5" />
                          <span className="truncate">{resp || "Sem responsável"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(r.data_fim_prevista)}</span>
                        </div>
                      </div>

                      <div className={`text-xs font-medium ${drColor}`}>{drLabel}</div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>Progresso</span>
                          <span>{r.percentual_progresso || 0}%</span>
                        </div>
                        <Progress value={r.percentual_progresso || 0} className="h-2" />
                      </div>

                      {!isTecnico && valoresByProjeto[r.id] !== undefined && (
                        <div className="pt-1 border-t text-xs flex items-center justify-between">
                          <span className="text-muted-foreground">Valor contratado</span>
                          <span className="font-mono font-semibold">{brl(valoresByProjeto[r.id])}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}