import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { brl, formatDate } from "@/lib/format";
import { FIN_TIPO_CUSTO } from "@/lib/financeiro";
import { Plus, Download, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const novo = () => ({ tipo: "outros", descricao: "", valor: 0, data: new Date().toISOString().slice(0,10), proposal_id: "", execucao_id: "", os_id: "", client_id: "", centro_custo_id: "", observacoes: "" });

export default function Custos() {
  const [rows, setRows] = useState<any[]>([]);
  const [props, setProps] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [cc, setCc] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(novo());
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");

  const load = async () => {
    const [r, p, c, k] = await Promise.all([
      supabase.from("financeiro_custos").select("*").order("data", { ascending: false }),
      supabase.from("proposals").select("id, numero, titulo"),
      supabase.from("clients").select("id, razao_social, nome_fantasia"),
      supabase.from("financeiro_centros_custo").select("*").eq("ativo", true),
    ]);
    setRows(r.data||[]); setProps(p.data||[]); setClients(c.data||[]); setCc(k.data||[]);
  };
  useEffect(() => { document.title = "Custos | Financeiro"; load(); }, []);

  const salvar = async () => {
    const payload: any = { ...form };
    ["proposal_id","execucao_id","os_id","client_id","centro_custo_id"].forEach(k => { if (!payload[k]) payload[k] = null; });
    const { error } = await supabase.from("financeiro_custos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Custo lançado"); setOpen(false); setForm(novo()); load();
  };
  const remover = async (id: string) => { if (!confirm("Excluir custo?")) return; await supabase.from("financeiro_custos").delete().eq("id", id); load(); };

  const filtered = rows.filter(r => {
    const t = q.toLowerCase();
    const matchQ = !t || (r.descricao||"").toLowerCase().includes(t);
    const matchT = tipo === "todos" || r.tipo === tipo;
    return matchQ && matchT;
  });
  const total = filtered.reduce((s,r)=>s+Number(r.valor||0),0);

  const csv = () => {
    const head = ["Data","Tipo","Descrição","Valor","Observações"];
    const lines = filtered.map(r => [formatDate(r.data), FIN_TIPO_CUSTO[r.tipo]||r.tipo, r.descricao, String(r.valor), r.observacoes||""]);
    const blob = new Blob(["\ufeff"+[head, ...lines].map(l => l.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `custos-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div>
      <PageHeader title="Custos Realizados" subtitle="Lançamento e acompanhamento de despesas operacionais"
        actions={<div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={csv}><Download className="h-4 w-4 mr-1"/>CSV</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Novo custo</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Lançar custo realizado</DialogTitle></DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={v=>setForm({...form, tipo: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(FIN_TIPO_CUSTO).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data</Label><Input type="date" value={form.data} onChange={e=>setForm({...form, data: e.target.value})}/></div>
                <div className="md:col-span-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})}/></div>
                <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e=>setForm({...form, valor: Number(e.target.value)})}/></div>
                <div><Label>Centro de Custo</Label>
                  <Select value={form.centro_custo_id || "none"} onValueChange={v=>setForm({...form, centro_custo_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {cc.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Proposta</Label>
                  <Select value={form.proposal_id || "none"} onValueChange={v=>setForm({...form, proposal_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {props.map(p => <SelectItem key={p.id} value={p.id}>{p.numero || p.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Cliente</Label>
                  <Select value={form.client_id || "none"} onValueChange={v=>setForm({...form, client_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e=>setForm({...form, observacoes: e.target.value})}/></div>
              </div>
              <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>} />
      <div className="p-6 space-y-4">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-9" placeholder="Buscar descrição…" value={q} onChange={e=>setQ(e.target.value)}/></div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[200px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos os tipos</SelectItem>{Object.entries(FIN_TIPO_CUSTO).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto text-sm">Total: <span className="font-display font-bold">{brl(total)}</span></div>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="text-left px-4 py-2">Data</th><th className="text-left px-4 py-2">Tipo</th><th className="text-left px-4 py-2">Descrição</th><th className="text-right px-4 py-2">Valor</th><th className="text-left px-4 py-2"></th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2">{formatDate(r.data)}</td>
                  <td className="px-4 py-2">{FIN_TIPO_CUSTO[r.tipo] || r.tipo}</td>
                  <td className="px-4 py-2">{r.descricao}<div className="text-xs text-muted-foreground">{r.observacoes}</div></td>
                  <td className="px-4 py-2 text-right font-mono">{brl(r.valor)}</td>
                  <td className="px-4 py-2 text-right"><Button size="icon" variant="ghost" onClick={()=>remover(r.id)}><Trash2 className="h-3 w-3"/></Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum custo lançado.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}