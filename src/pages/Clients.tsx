import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { formatCnpjCpf } from "@/lib/format";
import { toast } from "sonner";

const empty = { razao_social:"", nome_fantasia:"", cnpj_cpf:"", email:"", telefone:"", cidade:"", uf:"", solicitante:"", qtd_funcionarios:0, observacoes:"" };

export default function Clients() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { document.title = "Clientes | Portal HSE Consulting"; load(); }, []);
  async function load() {
    const { data } = await supabase.from("clients").select("*").order("created_at",{ascending:false});
    setList(data || []);
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(c:any) { setEditing(c); setForm({ ...empty, ...c }); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, qtd_funcionarios: Number(form.qtd_funcionarios) || 0 };
    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cliente atualizado" : "Cliente criado");
    setOpen(false); load();
  }

  const filtered = list.filter(c => {
    const s = q.toLowerCase();
    return !s || [c.razao_social, c.nome_fantasia, c.cnpj_cpf, c.cidade].some(v => (v||"").toLowerCase().includes(s));
  });

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Carteira de empresas atendidas pela HSE Consulting"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo cliente</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
                <Field label="Razão social" className="sm:col-span-2" required value={form.razao_social} onChange={v=>setForm({...form,razao_social:v})} />
                <Field label="Nome fantasia" value={form.nome_fantasia} onChange={v=>setForm({...form,nome_fantasia:v})} />
                <Field label="CNPJ / CPF" value={form.cnpj_cpf} onChange={v=>setForm({...form,cnpj_cpf:formatCnpjCpf(v)})} />
                <Field label="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} />
                <Field label="Telefone" value={form.telefone} onChange={v=>setForm({...form,telefone:v})} />
                <Field label="Cidade" value={form.cidade} onChange={v=>setForm({...form,cidade:v})} />
                <Field label="UF" value={form.uf} onChange={v=>setForm({...form,uf:v.toUpperCase().slice(0,2)})} />
                <Field label="Solicitante" value={form.solicitante} onChange={v=>setForm({...form,solicitante:v})} />
                <Field label="Qtd. funcionários" type="number" value={String(form.qtd_funcionarios)} onChange={v=>setForm({...form,qtd_funcionarios:v})} />
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={form.observacoes||""} onChange={e=>setForm({...form,observacoes:e.target.value})} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="p-6 space-y-4">
        <Input placeholder="Buscar por razão social, CNPJ, cidade…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-md" />
        <Card className="overflow-hidden shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Razão Social</th><th className="text-left px-4 py-2">CNPJ/CPF</th><th className="text-left px-4 py-2">Cidade</th><th className="text-left px-4 py-2">Funcionários</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="font-medium">{c.razao_social}</div><div className="text-xs text-muted-foreground">{c.nome_fantasia}</div></td>
                  <td className="px-4 py-3 font-mono text-xs">{c.cnpj_cpf || "—"}</td>
                  <td className="px-4 py-3">{[c.cidade, c.uf].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-4 py-3">{c.qtd_funcionarios || 0}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={()=>openEdit(c)}>Editar</Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum cliente.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", required, className }: any) {
  return (
    <div className={`space-y-1.5 ${className||""}`}>
      <Label>{label}{required && <span className="text-danger"> *</span>}</Label>
      <Input type={type} value={value} required={required} onChange={(e:any)=>onChange(e.target.value)} />
    </div>
  );
}