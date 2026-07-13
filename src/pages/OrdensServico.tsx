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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { osStatusLabel, osStatusColor, osPrioridadeLabel, osPrioridadeColor } from "@/lib/os";
import { formatDate, prazoStatus } from "@/lib/format";
import { ArrowRight, Plus, Search } from "lucide-react";

export default function OrdensServico() {
  const [rows, setRows] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [execs, setExecs] = useState<any[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fPrio, setFPrio] = useState("all");
  const [fResp, setFResp] = useState("all");
  const [fProjeto, setFProjeto] = useState("all");
  const [fCidade, setFCidade] = useState("");
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<any>({ execucao_id: "", projeto_id: "", titulo: "", prioridade: "media", data_prevista_inicio: "", data_prevista_conclusao: "" });

  const load = async () => {
    const [{ data }, { data: p }, { data: e }, { data: pj }] = await Promise.all([
      supabase.from("ordens_servico")
        .select("*, clients(razao_social, nome_fantasia), projetos(id, numero, titulo), execucao_profissionais!ordens_servico_responsavel_tecnico_id_fkey(nome)")
        .order("created_at", { ascending: false }),
      supabase.from("execucao_profissionais").select("id, nome").order("nome"),
      supabase.from("execucao_servicos").select("id, titulo, numero_interno, client_id, proposal_id, service_id, responsavel_comercial").order("created_at", { ascending: false }),
      supabase.from("projetos").select("id, numero, titulo, data_inicio, data_fim_prevista").order("created_at", { ascending: false }),
    ]);
    setRows((data as any) || []); setProfs((p as any) || []); setExecs((e as any) || []); setProjetos((pj as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (q) {
      const hay = [r.numero, r.titulo, r.cliente_nome, r.cidade, r.clients?.razao_social, r.clients?.nome_fantasia].map(s => (s || "").toLowerCase()).join(" ");
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (fStatus !== "all" && r.status !== fStatus) return false;
    if (fPrio !== "all" && r.prioridade !== fPrio) return false;
    if (fResp !== "all" && r.responsavel_tecnico_id !== fResp) return false;
    if (fProjeto !== "all" && r.projeto_id !== fProjeto) return false;
    if (fCidade && !(r.cidade || "").toLowerCase().includes(fCidade.toLowerCase())) return false;
    return true;
  }), [rows, q, fStatus, fPrio, fResp, fProjeto, fCidade]);

  const criar = async () => {
    if (!novo.execucao_id || !novo.titulo) return toast.error("Informe a execução e o título");
    const ex = execs.find(e => e.id === novo.execucao_id);
    const { data, error } = await supabase.from("ordens_servico").insert({
      execucao_id: novo.execucao_id,
      projeto_id: novo.projeto_id || null,
      titulo: novo.titulo,
      prioridade: novo.prioridade,
      data_prevista_inicio: novo.data_prevista_inicio || null,
      data_prevista_conclusao: novo.data_prevista_conclusao || null,
      client_id: ex?.client_id, proposal_id: ex?.proposal_id, service_id: ex?.service_id,
      responsavel_comercial: ex?.responsavel_comercial,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("OS criada");
    setOpen(false);
    window.location.href = `/ordens-servico/${data!.id}`;
  };

  return (
    <>
      <PageHeader title="Ordens de Serviço" subtitle="Atividades operacionais geradas a partir dos serviços em execução"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova OS</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Ordem de Serviço</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Serviço em execução</Label>
                  <Select value={novo.execucao_id} onValueChange={v => setNovo({ ...novo, execucao_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{execs.map(e => <SelectItem key={e.id} value={e.id}>{e.numero_interno} — {e.titulo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Projeto (opcional)</Label>
                  <Select value={novo.projeto_id || "none"} onValueChange={v => {
                    if (v === "none") {
                      setNovo({ ...novo, projeto_id: "" });
                    } else {
                      const p = projetos.find(pp => pp.id === v);
                      setNovo({
                        ...novo,
                        projeto_id: v,
                        data_prevista_inicio: novo.data_prevista_inicio || p?.data_inicio || "",
                        data_prevista_conclusao: novo.data_prevista_conclusao || p?.data_fim_prevista || "",
                      });
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Vincular a um projeto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem projeto</SelectItem>
                      {projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {novo.projeto_id && (
                    <p className="text-[11px] text-muted-foreground mt-1">Datas preenchidas automaticamente a partir do projeto (editáveis).</p>
                  )}
                </div>
                <div><Label>Título da OS</Label>
                  <Input value={novo.titulo} onChange={e => setNovo({ ...novo, titulo: e.target.value })} placeholder="Ex.: Visita técnica preliminar" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Previsão de início</Label>
                    <Input type="date" value={novo.data_prevista_inicio} onChange={e => setNovo({ ...novo, data_prevista_inicio: e.target.value })} />
                  </div>
                  <div><Label>Previsão de conclusão</Label>
                    <Input type="date" value={novo.data_prevista_conclusao} onChange={e => setNovo({ ...novo, data_prevista_conclusao: e.target.value })} />
                  </div>
                </div>
                <div><Label>Prioridade</Label>
                  <Select value={novo.prioridade} onValueChange={v => setNovo({ ...novo, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(osPrioridadeLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={criar}>Criar OS</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      <div className="p-6 space-y-4">
        <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="relative col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} /></div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(osStatusLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fPrio} onValueChange={setFPrio}>
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{Object.entries(osPrioridadeLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fResp} onValueChange={setFResp}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fProjeto} onValueChange={setFProjeto}>
            <SelectTrigger><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos projetos</SelectItem>{projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Cidade" value={fCidade} onChange={e => setFCidade(e.target.value)} className="md:col-span-5 lg:col-span-1" />
        </CardContent></Card>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nº</TableHead><TableHead>Título</TableHead><TableHead>Cliente</TableHead><TableHead>Projeto</TableHead>
              <TableHead>Cidade</TableHead><TableHead>Responsável</TableHead>
              <TableHead>Prioridade</TableHead><TableHead>Status</TableHead><TableHead>Prazo</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => {
                const prazo = prazoStatus(r.data_prevista_conclusao, r.status === "finalizada" ? "concluido" : r.status === "cancelada" ? "cancelado" : r.status);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                    <TableCell className="font-medium">{r.titulo}</TableCell>
                    <TableCell>{r.cliente_nome || r.clients?.nome_fantasia || r.clients?.razao_social || "—"}</TableCell>
                    <TableCell>{r.projetos ? <Link to={`/projetos/${r.projetos.id}`} className="text-primary hover:underline font-mono text-xs">{r.projetos.numero}</Link> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.cidade || "—"}</TableCell>
                    <TableCell>{r.execucao_profissionais?.nome || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Badge className={osPrioridadeColor[r.prioridade]} variant="secondary">{osPrioridadeLabel[r.prioridade]}</Badge></TableCell>
                    <TableCell><Badge className={osStatusColor[r.status]} variant="secondary">{osStatusLabel[r.status]}</Badge></TableCell>
                    <TableCell className={`text-xs ${prazo.cor}`}>{prazo.emoji} {prazo.label}<div className="text-muted-foreground">{formatDate(r.data_prevista_conclusao)}</div></TableCell>
                    <TableCell><Button asChild size="sm" variant="ghost"><Link to={`/ordens-servico/${r.id}`}><ArrowRight className="h-4 w-4" /></Link></Button></TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma OS encontrada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}