import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowRight } from "lucide-react";
import { LEAD_STATUS, ORIGENS, SCORES, calcularScore } from "@/lib/crm";
import { formatCnpjCpf, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const empty = {
  empresa:"", cnpj_cpf:"", contato_nome:"", contato_cargo:"", telefone:"", whatsapp:"", email:"",
  cidade:"", estado:"", segmento:"", qtd_funcionarios: 0, origem: "", responsavel_id: null,
  status: "novo", observacoes: "",
  necessidade:"", urgencia:"", orcamento_disponivel:"", autoridade_decisao:"", prazo_contratacao:"",
  servicos_interesse: [] as string[], concorrentes:"", score: null,
};

export default function CrmLeads() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("__all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { document.title = "Leads | CRM HSE"; load(); }, []);
  async function load() {
    const { data } = await supabase.from("crm_leads").select("*").order("created_at",{ascending:false});
    setList(data || []);
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(l:any) { setEditing(l); setForm({ ...empty, ...l, servicos_interesse: l.servicos_interesse || [] }); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, qtd_funcionarios: Number(form.qtd_funcionarios)||0, score: calcularScore(form) };
    if (!payload.origem) delete payload.origem;
    if (!payload.responsavel_id) delete payload.responsavel_id;
    const { error } = editing
      ? await supabase.from("crm_leads").update(payload).eq("id", editing.id)
      : await supabase.from("crm_leads").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Lead atualizado" : "Lead criado");
    setOpen(false); load();
  }

  async function converter(id: string) {
    if (!confirm("Converter este lead em cliente?")) return;
    const { error } = await supabase.rpc("crm_converter_lead", { _lead_id: id });
    if (error) return toast.error(error.message);
    toast.success("Lead convertido em cliente");
    load();
  }

  const filtered = list.filter(l => {
    if (fStatus !== "__all" && l.status !== fStatus) return false;
    const s = q.toLowerCase();
    return !s || [l.empresa, l.contato_nome, l.cnpj_cpf, l.cidade, l.email].some(v => (v||"").toLowerCase().includes(s));
  });

  return (
    <div>
      <PageHeader title="Leads" subtitle="Captura e qualificação de novos contatos comerciais"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2"/>Novo lead</Button>} />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Buscar por empresa, contato, CNPJ…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-md" />
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os status</SelectItem>
              {LEAD_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Empresa / Contato</th>
                <th className="text-left px-4 py-2">Origem</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Score</th>
                <th className="text-left px-4 py-2">Cidade</th>
                <th className="text-left px-4 py-2">Criado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const scoreObj = SCORES.find(s => s.value === l.score);
                const stObj = LEAD_STATUS.find(s => s.value === l.status);
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.empresa}</div>
                      <div className="text-xs text-muted-foreground">{l.contato_nome} {l.contato_cargo && `· ${l.contato_cargo}`}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{ORIGENS.find(o=>o.value===l.origem)?.label || "—"}</td>
                    <td className="px-4 py-3"><span className="inline-block px-2 py-0.5 rounded bg-muted text-xs">{stObj?.label}</span></td>
                    <td className="px-4 py-3">{scoreObj ? <span className={`inline-block px-2 py-0.5 rounded text-xs ${scoreObj.color}`}>{scoreObj.label}</span> : "—"}</td>
                    <td className="px-4 py-3 text-xs">{[l.cidade, l.estado].filter(Boolean).join("/") || "—"}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {l.status !== "convertido" && !l.cliente_id && (
                        <Button variant="ghost" size="sm" onClick={()=>converter(l.id)} title="Converter em cliente">
                          <ArrowRight className="h-3 w-3 mr-1"/>Converter
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={()=>openEdit(l)}>Editar</Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum lead.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2">
              <F label="Empresa" required className="sm:col-span-2" value={form.empresa} onChange={v=>setForm({...form,empresa:v})}/>
              <F label="CNPJ / CPF" value={form.cnpj_cpf} onChange={v=>setForm({...form,cnpj_cpf:formatCnpjCpf(v)})}/>
              <F label="Segmento" value={form.segmento} onChange={v=>setForm({...form,segmento:v})}/>
              <F label="Contato" value={form.contato_nome} onChange={v=>setForm({...form,contato_nome:v})}/>
              <F label="Cargo" value={form.contato_cargo} onChange={v=>setForm({...form,contato_cargo:v})}/>
              <F label="Telefone" value={form.telefone} onChange={v=>setForm({...form,telefone:v})}/>
              <F label="WhatsApp" value={form.whatsapp} onChange={v=>setForm({...form,whatsapp:v})}/>
              <F label="E-mail" type="email" value={form.email} onChange={v=>setForm({...form,email:v})}/>
              <F label="Qtd. funcionários" type="number" value={String(form.qtd_funcionarios||0)} onChange={v=>setForm({...form,qtd_funcionarios:v})}/>
              <F label="Cidade" value={form.cidade} onChange={v=>setForm({...form,cidade:v})}/>
              <F label="UF" value={form.estado} onChange={v=>setForm({...form,estado:v.toUpperCase().slice(0,2)})}/>
              <Sel label="Origem" value={form.origem} onChange={(v:string)=>setForm({...form,origem:v})} opts={ORIGENS}/>
              <Sel label="Status" value={form.status} onChange={(v:string)=>setForm({...form,status:v})} opts={LEAD_STATUS}/>
            </section>

            <fieldset className="border rounded p-3">
              <legend className="text-xs uppercase text-muted-foreground px-2">Qualificação (BANT)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Necessidade identificada" value={form.necessidade} onChange={v=>setForm({...form,necessidade:v})}/>
                <F label="Urgência" value={form.urgencia} onChange={v=>setForm({...form,urgencia:v})}/>
                <F label="Orçamento disponível" value={form.orcamento_disponivel} onChange={v=>setForm({...form,orcamento_disponivel:v})}/>
                <F label="Autoridade de decisão" value={form.autoridade_decisao} onChange={v=>setForm({...form,autoridade_decisao:v})}/>
                <F label="Prazo de contratação" value={form.prazo_contratacao} onChange={v=>setForm({...form,prazo_contratacao:v})}/>
                <F label="Concorrentes" value={form.concorrentes} onChange={v=>setForm({...form,concorrentes:v})}/>
                <F label="Serviços de interesse (separar por vírgula)" className="sm:col-span-2"
                   value={(form.servicos_interesse||[]).join(", ")}
                   onChange={v=>setForm({...form,servicos_interesse:v.split(",").map((s:string)=>s.trim()).filter(Boolean)})}/>
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes||""} onChange={e=>setForm({...form,observacoes:e.target.value})}/>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, value, onChange, type="text", required, className }: any) {
  return (
    <div className={`space-y-1.5 ${className||""}`}>
      <Label>{label}{required && <span className="text-rose-600"> *</span>}</Label>
      <Input type={type} value={value||""} required={required} onChange={(e:any)=>onChange(e.target.value)} />
    </div>
  );
}
function Sel({ label, value, onChange, opts }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Selecione…"/></SelectTrigger>
        <SelectContent>{opts.map((o:any)=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
