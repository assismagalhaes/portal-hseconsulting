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
import CnpjLookupField from "@/components/CnpjLookupField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const empty = { razao_social:"", nome_fantasia:"", cnpj_cpf:"", email:"", telefone:"", whatsapp:"", endereco:"", cidade:"", uf:"", solicitante:"", cargo:"", qtd_funcionarios:0, observacoes:"" };

export default function Clients() {
  const [list, setList] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { document.title = "Clientes | Portal HSE Consulting"; load(); }, []);
  async function load() {
    const [c, g] = await Promise.all([
      supabase.from("clients").select("*, client_groups(id,nome)").order("created_at",{ascending:false}),
      supabase.from("client_groups").select("id, nome").order("nome"),
    ]);
    setList(c.data || []);
    setGroups(g.data || []);
  }

  async function criarGrupo() {
    const nome = window.prompt("Nome do novo grupo econômico:");
    if (!nome) return;
    const { data, error } = await supabase.from("client_groups").insert({ nome }).select("id,nome").single();
    if (error) return toast.error(error.message);
    setGroups(g => [...g, data!].sort((a,b)=>a.nome.localeCompare(b.nome)));
    setForm((f:any)=>({ ...f, group_id: data!.id }));
    toast.success("Grupo criado");
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(c:any) { setEditing(c); setForm({ ...empty, ...c }); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, qtd_funcionarios: Number(form.qtd_funcionarios) || 0 };
    // remover campo virtual injetado pelo select embed
    delete (payload as any).client_groups;
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
                <CnpjLookupField
                  value={form.cnpj_cpf}
                  onChange={(v)=>setForm({...form, cnpj_cpf:v})}
                  formSnapshot={form}
                  onAutofill={(patch)=>setForm({...form, ...patch})}
                  onExistingClient={(c)=>{ setEditing(c); setForm({ ...empty, ...c }); toast.message("Cadastro existente carregado."); }}
                  ignoreClientId={editing?.id || null}
                  ultimaConsulta={form.ultima_consulta_cnpj}
                  label="CNPJ / CPF"
                />
                <Field label="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} />
                <Field label="Telefone" value={form.telefone} onChange={v=>setForm({...form,telefone:v})} />
                <Field label="WhatsApp" value={form.whatsapp} onChange={v=>setForm({...form,whatsapp:v})} />
                <Field label="Endereço" className="sm:col-span-2" value={form.endereco} onChange={v=>setForm({...form,endereco:v})} />
                <Field label="Bairro" value={form.bairro||""} onChange={v=>setForm({...form,bairro:v})} />
                <Field label="CEP" value={form.cep||""} onChange={v=>setForm({...form,cep:v})} />
                <Field label="Cidade" value={form.cidade} onChange={v=>setForm({...form,cidade:v})} />
                <Field label="UF" value={form.uf} onChange={v=>setForm({...form,uf:v.toUpperCase().slice(0,2)})} />
                <Field label="Solicitante" value={form.solicitante} onChange={v=>setForm({...form,solicitante:v})} />
                <Field label="Cargo" value={form.cargo} onChange={v=>setForm({...form,cargo:v})} />
                <Field label="Qtd. funcionários" type="number" value={String(form.qtd_funcionarios)} onChange={v=>setForm({...form,qtd_funcionarios:v})} />
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Grupo econômico (holding)</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={criarGrupo}>+ Criar novo</Button>
                  </div>
                  <Select value={form.group_id || "__none__"} onValueChange={(v)=>setForm({ ...form, group_id: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sem grupo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem grupo</SelectItem>
                      {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Vincule empresas do mesmo grupo econômico. Usa nos orçamentos multi-CNPJ e no acesso do portal por grupo.
                  </p>
                </div>
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