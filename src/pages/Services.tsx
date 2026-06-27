import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

const empty = { nome:"", categoria:"", unidade_padrao:"serviço", descricao_comercial:"", escopo_tecnico:"", valor_referencia:0 };

export default function Services() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { document.title = "Serviços | Portal HSE Consulting"; load(); }, []);
  async function load() {
    const { data } = await supabase.from("services").select("*").order("nome");
    setList(data || []);
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(s:any) { setEditing(s); setForm({ ...empty, ...s }); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, valor_referencia: Number(form.valor_referencia) || 0 };
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Serviço atualizado" : "Serviço criado");
    setOpen(false); load();
  }

  const filtered = list.filter(s => !q || s.nome.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Catálogo de Serviços" subtitle="Templates reutilizáveis para montar propostas mais rápido"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo serviço</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="space-y-1.5"><Label>Nome *</Label>
                  <Input required value={form.nome} onChange={e=>setForm({...form, nome:e.target.value})} /></div>
                <div className="space-y-1.5"><Label>Categoria</Label>
                  <Input placeholder="Ex.: PGR, PCMSO, Laudo, Treinamento…" value={form.categoria||""} onChange={e=>setForm({...form, categoria:e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Unidade padrão</Label>
                    <Input value={form.unidade_padrao} onChange={e=>setForm({...form, unidade_padrao:e.target.value})} /></div>
                  <div className="space-y-1.5"><Label>Valor de referência</Label>
                    <Input type="number" step="0.01" value={form.valor_referencia} onChange={e=>setForm({...form, valor_referencia:e.target.value})} /></div>
                </div>
                <div className="space-y-1.5"><Label>Descrição comercial (vai para o cliente)</Label>
                  <Textarea rows={3} value={form.descricao_comercial||""} onChange={e=>setForm({...form, descricao_comercial:e.target.value})} /></div>
                <div className="space-y-1.5"><Label>Escopo técnico (uso interno)</Label>
                  <Textarea rows={4} value={form.escopo_tecnico||""} onChange={e=>setForm({...form, escopo_tecnico:e.target.value})} /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="p-6 space-y-4">
        <Input placeholder="Buscar serviço…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-md" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <Card key={s.id} className="p-4 shadow-elegant hover:shadow-glow transition-shadow cursor-pointer" onClick={()=>openEdit(s)}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-semibold">{s.nome}</h3>
                <span className="text-xs text-muted-foreground">{s.unidade_padrao || "—"}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{s.descricao_comercial || "Sem descrição comercial."}</p>
              <div className="mt-3 text-sm font-mono text-primary">{brl(s.valor_referencia)}</div>
            </Card>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-10">Nenhum serviço cadastrado.</div>}
        </div>
      </div>
    </div>
  );
}