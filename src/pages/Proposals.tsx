import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { brl, formatDate, proposalStatusLabel, proposalOrigemLabel, proposalOrigemColor } from "@/lib/format";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-primary/15 text-primary",
  negociacao: "bg-warning/15 text-warning",
  aprovada: "bg-success/15 text-success",
  recusada: "bg-danger/15 text-danger",
  cancelada: "bg-muted text-muted-foreground",
  expirada: "bg-muted text-muted-foreground",
};

export default function Proposals() {
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const [origem, setOrigem] = useState<string>("todas");
  const [dateBase, setDateBase] = useState<"emissao"|"envio"|"aprovacao"|"cadastro">("emissao");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [newClientId, setNewClientId] = useState<string>("");
  const [newOrigem, setNewOrigem] = useState<"nova_proposta"|"retroativa"|"importacao_manual"|"importacao_planilha">("nova_proposta");
  const [newDataEmissao, setNewDataEmissao] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [creating, setCreating] = useState(false);

  useEffect(() => { document.title = "Propostas | Portal HSE Consulting"; load(); }, []);
  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("proposals").select("*, clients(razao_social,nome_fantasia)").order("created_at",{ascending:false}),
      supabase.from("clients").select("id,razao_social,nome_fantasia").order("razao_social"),
    ]);
    setList(p.data || []);
    setClients(c.data || []);
  }

  async function createProposal() {
    setCreating(true);
    const numero = `P-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const obsRetro = (newOrigem === "retroativa" || newOrigem === "importacao_manual")
      ? "Proposta cadastrada retroativamente para alimentação inicial do sistema. Data de emissão baseada no documento comercial original."
      : null;
    const emissao = newDataEmissao || new Date().toISOString().slice(0,10);
    // Validade padrão: 30 dias após a emissão.
    const validade = new Date(emissao + "T00:00:00");
    validade.setDate(validade.getDate() + 30);
    const validadeStr = validade.toISOString().slice(0,10);
    const { data, error } = await supabase.from("proposals").insert({
      numero, client_id: newClientId || null, status: "rascunho",
      data_emissao: emissao,
      validade: validadeStr,
      origem_cadastro: newOrigem,
      observacao_retroativa: obsRetro,
    }).select("id").single();
    setCreating(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    nav(`/propostas/${data!.id}`);
  }

  const dateField: Record<string, string> = {
    emissao: "data_emissao",
    envio: "data_envio",
    aprovacao: "data_aprovacao",
    cadastro: "created_at",
  };
  const filtered = list.filter(p => {
    if (filter !== "todos" && p.status !== filter) return false;
    if (origem !== "todas" && p.origem_cadastro !== origem) return false;
    if (dateFrom || dateTo) {
      const raw = p[dateField[dateBase]];
      if (!raw) return false;
      const d = (raw as string).slice(0,10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
    }
    if (!q) return true;
    const s = q.toLowerCase();
    return [p.numero, p.clients?.razao_social, p.clients?.nome_fantasia].some(v => (v||"").toLowerCase().includes(s));
  });

  return (
    <div>
      <PageHeader title="Propostas" subtitle="Crie, acompanhe e gerencie o pipeline comercial"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova proposta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova proposta</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Cliente (opcional — pode cadastrar depois)</Label>
                  <Select value={newClientId} onValueChange={setNewClientId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente existente…" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Ou clique em criar e cadastre os dados do cliente direto no editor.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Origem do cadastro <span className="text-danger">*</span></Label>
                    <Select value={newOrigem} onValueChange={(v:any)=>setNewOrigem(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(proposalOrigemLabel).map(([k,v])=>(
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de emissão original <span className="text-danger">*</span></Label>
                    <Input type="date" value={newDataEmissao} onChange={e=>setNewDataEmissao(e.target.value)} />
                  </div>
                </div>
                {(newOrigem === "retroativa" || newOrigem === "importacao_manual") && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Cadastro retroativo: a data de emissão usada como referência principal nos relatórios comerciais. Não inflará indicadores do mês atual.
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
                  <Button onClick={createProposal} disabled={creating || !newDataEmissao}>Criar e abrir</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        } />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="Número ou cliente…" value={q} onChange={e=>setQ(e.target.value)} className="w-64" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(proposalStatusLabel).map(([k,v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {Object.entries(proposalOrigemLabel).map(([k,v])=>(
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Período por</Label>
            <Select value={dateBase} onValueChange={(v:any)=>setDateBase(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="emissao">Emissão</SelectItem>
                <SelectItem value="envio">Envio</SelectItem>
                <SelectItem value="aprovacao">Aprovação</SelectItem>
                <SelectItem value="cadastro">Cadastro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-40" />
          </div>
          {(dateFrom || dateTo || origem !== "todas" || filter !== "todos" || q) && (
            <Button variant="ghost" size="sm" onClick={()=>{setQ("");setFilter("todos");setOrigem("todas");setDateFrom("");setDateTo("");}}>
              Limpar
            </Button>
          )}
        </div>
        <Card className="overflow-hidden shadow-elegant">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Número</th>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Origem</th>
                <th className="text-left px-4 py-2">Emissão</th>
                <th className="text-left px-4 py-2">Envio</th>
                <th className="text-left px-4 py-2">Aprovação</th>
                <th className="text-left px-4 py-2">Cadastro</th>
                <th className="text-right px-4 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={()=>nav(`/propostas/${p.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs">{p.numero}</td>
                  <td className="px-4 py-3 font-medium">{p.clients?.nome_fantasia || p.clients?.razao_social || "—"}</td>
                  <td className="px-4 py-3"><Badge className={statusColor[p.status] + " border-0"}>{proposalStatusLabel[p.status]}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge className={(proposalOrigemColor[p.origem_cadastro]||"") + " border-0"} variant="secondary">
                      {proposalOrigemLabel[p.origem_cadastro] || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDate(p.data_emissao)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.data_envio)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.data_aprovacao)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right font-mono">{brl(p.valor_total)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhuma proposta.</td></tr>}
            </tbody>
          </table></div>
        </Card>
      </div>
    </div>
  );
}