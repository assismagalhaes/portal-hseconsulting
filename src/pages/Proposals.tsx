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
import { brl, proposalStatusLabel } from "@/lib/format";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-primary/15 text-primary",
  negociacao: "bg-warning/15 text-warning",
  aprovada: "bg-success/15 text-success",
  recusada: "bg-danger/15 text-danger",
  expirada: "bg-muted text-muted-foreground",
};

export default function Proposals() {
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [newClientId, setNewClientId] = useState<string>("");
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
    if (!newClientId) return toast.error("Selecione um cliente");
    setCreating(true);
    const numero = `P-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { data, error } = await supabase.from("proposals").insert({
      numero, client_id: newClientId, status: "rascunho",
    }).select("id").single();
    setCreating(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    nav(`/propostas/${data!.id}`);
  }

  const filtered = list.filter(p => {
    if (filter !== "todos" && p.status !== filter) return false;
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
                  <Label>Cliente</Label>
                  <Select value={newClientId} onValueChange={setNewClientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clients.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado. <Link to="/clientes" className="text-primary underline">Cadastrar agora</Link>.</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
                  <Button onClick={createProposal} disabled={creating || !newClientId}>Criar e abrir</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        } />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Buscar número ou cliente…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-sm" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(proposalStatusLabel).map(([k,v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="overflow-hidden shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Número</th><th className="text-left px-4 py-2">Cliente</th><th className="text-left px-4 py-2">Status</th><th className="text-right px-4 py-2">Valor</th><th className="text-left px-4 py-2">Criada</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={()=>nav(`/propostas/${p.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs">{p.numero}</td>
                  <td className="px-4 py-3 font-medium">{p.clients?.nome_fantasia || p.clients?.razao_social || "—"}</td>
                  <td className="px-4 py-3"><Badge className={statusColor[p.status] + " border-0"}>{proposalStatusLabel[p.status]}</Badge></td>
                  <td className="px-4 py-3 text-right font-mono">{brl(p.valor_total)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma proposta.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}