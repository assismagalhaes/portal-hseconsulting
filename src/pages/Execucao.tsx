import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  brl, execucaoStatusLabel, execucaoStatusColor,
  prioridadeLabel, prioridadeColor, prazoStatus, formatDate,
} from "@/lib/format";
import { Search, ArrowRight, ClipboardList, PlayCircle, FileCheck2, CheckCircle2, AlertCircle, Timer } from "lucide-react";

type Row = {
  id: string;
  numero_interno: string;
  titulo: string;
  status: any;
  prioridade: any;
  categoria: string | null;
  cidade: string | null;
  quantidade: number;
  unidade: string | null;
  valor_contratado: number;
  data_prevista_conclusao: string | null;
  data_real_conclusao: string | null;
  data_aprovacao: string | null;
  client_id: string;
  proposal_id: string;
  responsavel_tecnico_id: string | null;
  clients?: { razao_social: string | null; nome_fantasia: string | null } | null;
  proposals?: { numero: string | null } | null;
  execucao_profissionais?: { nome: string | null } | null;
};

const STATUS_OPTS = Object.entries(execucaoStatusLabel);

export default function Execucao() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profs, setProfs] = useState<{ id: string; nome: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; razao_social: string | null; nome_fantasia: string | null }[]>([]);

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fClient, setFClient] = useState<string>("all");
  const [fResp, setFResp] = useState<string>("all");
  const [fPrio, setFPrio] = useState<string>("all");
  const [fCat, setFCat] = useState<string>("");
  const [fCidade, setFCidade] = useState<string>("");

  const load = async () => {
    const { data, error } = await supabase
      .from("execucao_servicos")
      .select("*, clients(razao_social, nome_fantasia), proposals(numero), execucao_profissionais!execucao_servicos_responsavel_tecnico_id_fkey(nome)")
      .order("created_at", { ascending: false });
    if (!error) setRows((data as any) || []);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("execucao_profissionais").select("id, nome").order("nome"),
      supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
    ]);
    setProfs((p as any) || []);
    setClients((c as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (q) {
      const hay = [r.numero_interno, r.titulo, r.clients?.razao_social, r.clients?.nome_fantasia, r.proposals?.numero, r.categoria, r.cidade]
        .map(s => (s || "").toLowerCase()).join(" ");
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (fStatus !== "all" && r.status !== fStatus) return false;
    if (fClient !== "all" && r.client_id !== fClient) return false;
    if (fResp !== "all" && r.responsavel_tecnico_id !== fResp) return false;
    if (fPrio !== "all" && r.prioridade !== fPrio) return false;
    if (fCat && !(r.categoria || "").toLowerCase().includes(fCat.toLowerCase())) return false;
    if (fCidade && !(r.cidade || "").toLowerCase().includes(fCidade.toLowerCase())) return false;
    return true;
  }), [rows, q, fStatus, fClient, fResp, fPrio, fCat, fCidade]);

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let atrasados = 0, somaDias = 0, contaConcluido = 0;
    const byStatus: Record<string, number> = {};
    rows.forEach(r => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.data_prevista_conclusao && r.status !== "concluido" && r.status !== "cancelado") {
        const alvo = new Date(r.data_prevista_conclusao + "T00:00:00");
        if (alvo.getTime() < today.getTime()) atrasados++;
      }
      if (r.status === "concluido" && r.data_aprovacao && r.data_real_conclusao) {
        const a = new Date(r.data_aprovacao + "T00:00:00").getTime();
        const b = new Date(r.data_real_conclusao + "T00:00:00").getTime();
        somaDias += Math.max(0, Math.round((b - a) / 86400000));
        contaConcluido++;
      }
    });
    return {
      aguardando: byStatus["aguardando_inicio"] || 0,
      andamento: (byStatus["em_execucao"] || 0) + (byStatus["agendado"] || 0) + (byStatus["planejamento"] || 0),
      revisao: (byStatus["em_revisao_tecnica"] || 0) + (byStatus["aguardando_aprovacao_cliente"] || 0),
      concluidos: byStatus["concluido"] || 0,
      atrasados,
      tempoMedio: contaConcluido ? Math.round(somaDias / contaConcluido) : null,
      byStatus,
    };
  }, [rows]);

  const maxBar = Math.max(1, ...Object.values(kpis.byStatus));

  return (
    <>
      <PageHeader title="Execução de Serviços" subtitle="Acompanhamento operacional das ordens geradas a partir das propostas aprovadas" />
      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={<ClipboardList className="h-5 w-5" />} label="Aguardando início" value={kpis.aguardando} />
          <Kpi icon={<PlayCircle className="h-5 w-5" />} label="Em andamento" value={kpis.andamento} />
          <Kpi icon={<FileCheck2 className="h-5 w-5" />} label="Em revisão" value={kpis.revisao} />
          <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Concluídos" value={kpis.concluidos} />
          <Kpi icon={<AlertCircle className="h-5 w-5 text-rose-500" />} label="Atrasados" value={kpis.atrasados} highlight={kpis.atrasados > 0} />
          <Kpi icon={<Timer className="h-5 w-5" />} label="Tempo médio" value={kpis.tempoMedio == null ? "—" : `${kpis.tempoMedio}d`} />
        </div>

        {/* gráfico por status */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">Distribuição por status</div>
            <div className="space-y-2">
              {STATUS_OPTS.map(([k, label]) => {
                const v = kpis.byStatus[k] || 0;
                return (
                  <div key={k} className="grid grid-cols-[12rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="text-muted-foreground truncate">{label}</span>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(v / maxBar) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono">{v}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* filtros */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <div className="relative col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_OPTS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fClient} onValueChange={setFClient}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fResp} onValueChange={setFResp}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fPrio} onValueChange={setFPrio}>
              <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(prioridadeLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Categoria" value={fCat} onChange={(e) => setFCat(e.target.value)} />
            <Input placeholder="Cidade" value={fCidade} onChange={(e) => setFCidade(e.target.value)} />
          </CardContent>
        </Card>

        {/* tabela */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Proposta</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const prazo = prazoStatus(r.data_prevista_conclusao, r.status);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.numero_interno}</TableCell>
                    <TableCell className="font-medium">{r.titulo}<div className="text-xs text-muted-foreground">{r.categoria || "—"}</div></TableCell>
                    <TableCell>{r.clients?.nome_fantasia || r.clients?.razao_social || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.proposals?.numero || "—"}</TableCell>
                    <TableCell>{r.execucao_profissionais?.nome || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Badge className={prioridadeColor[r.prioridade]} variant="secondary">{prioridadeLabel[r.prioridade]}</Badge></TableCell>
                    <TableCell><Badge className={execucaoStatusColor[r.status]} variant="secondary">{execucaoStatusLabel[r.status]}</Badge></TableCell>
                    <TableCell className={`text-xs ${prazo.cor}`}>{prazo.emoji} {prazo.label}<div className="text-muted-foreground">{formatDate(r.data_prevista_conclusao)}</div></TableCell>
                    <TableCell className="text-right font-medium">{brl(r.valor_contratado)}</TableCell>
                    <TableCell><Button asChild size="sm" variant="ghost"><Link to={`/execucao/${r.id}`}><ArrowRight className="h-4 w-4" /></Link></Button></TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma ordem de execução. Aprove uma proposta para gerar automaticamente.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, highlight }: { icon: any; label: string; value: any; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-rose-300" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
        <div className="text-2xl font-bold mt-1 font-display">{value}</div>
      </CardContent>
    </Card>
  );
}