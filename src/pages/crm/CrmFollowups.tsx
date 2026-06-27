import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle } from "lucide-react";
import { FUP_TIPOS, FUP_STATUS } from "@/lib/crm";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const empty = {
  lead_id: null, client_id: null, oportunidade_id: null, proposal_id: null,
  tipo: "ligacao", data: new Date().toISOString().slice(0,10), hora: "",
  responsavel_id: null, resumo: "", proxima_acao: "",
  proximo_followup_data: null, proximo_followup_hora: "",
  status: "pendente",
};

export default function CrmFollowups() {
  const [list, setList] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [oports, setOports] = useState<any[]>([]);
  const [fStatus, setFStatus] = useState("__all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { document.title = "Follow-ups | CRM HSE"; reload(); }, []);
  async function reload() {
    const [f, l, c, o] = await Promise.all([
      supabase.from("crm_followups").select("*").order("data",{ascending:false}),
      supabase.from("crm_leads").select("id, empresa"),
      supabase.from("clients").select("id, razao_social"),
      supabase.from("crm_oportunidades").select("id, titulo"),
    ]);
    setList(f.data||[]); setLeads(l.data||[]); setClients(c.data||[]); setOports(o.data||[]);
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(f:any) { setEditing(f); setForm({ ...empty, ...f }); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    ["lead_id","client_id","oportunidade_id","proposal_id"].forEach(k => { if (!payload[k]) payload[k]=null; });
    if (!payload.hora) payload.hora = null;
    if (!payload.proximo_followup_hora) payload.proximo_followup_hora = null;
    if (!payload.proximo_followup_data) payload.proximo_followup_data = null;
    const { error } = editing
      ? await supabase.from("crm_followups").update(payload).eq("id", editing.id)
      : await supabase.from("crm_followups").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Follow-up salvo"); setOpen(false); reload();
  }

  const hoje = new Date().toISOString().slice(0,10);
  const filtered = list.filter(f => fStatus === "__all" || f.status === fStatus);

  return (
    <div>
      <PageHeader title="Follow-ups" subtitle="Contatos comerciais registrados e agendados"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2"/>Novo follow-up</Button>}/>
      <div className="p-6 space-y-4">
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-56"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os status</SelectItem>
            {FUP_STATUS.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Card className="overflow-hidden shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Data</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-left px-4 py-2">Vinculado a</th>
                <th className="text-left px-4 py-2">Resumo</th>
                <th className="text-left px-4 py-2">Próxima ação</th>
                <th className="text-left px-4 py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const status = FUP_STATUS.find(s=>s.value===f.status);
                const tipo = FUP_TIPOS.find(t=>t.value===f.tipo);
                const vencido = f.status === "pendente" && f.data && f.data < hoje;
                const ligacao = oports.find(o=>o.id===f.oportunidade_id)?.titulo
                  || clients.find(c=>c.id===f.client_id)?.razao_social
                  || leads.find(l=>l.id===f.lead_id)?.empresa
                  || "—";
                return (
                  <tr key={f.id} className={`border-t hover:bg-muted/30 ${vencido ? "bg-amber-50" : ""}`}>
                    <td className="px-4 py-3">{formatDate(f.data)} {f.hora && <span className="text-xs text-muted-foreground">{f.hora.slice(0,5)}</span>}</td>
                    <td className="px-4 py-3 text-xs">{tipo?.label}</td>
                    <td className="px-4 py-3 text-xs">{ligacao}</td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" title={f.resumo}>{f.resumo || "—"}</td>
                    <td className="px-4 py-3 text-xs">{f.proxima_acao || "—"} {f.proximo_followup_data && <span className="text-muted-foreground">({formatDate(f.proximo_followup_data)})</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${status?.color}`}>{status?.label}</span>
                      {vencido && <AlertTriangle className="h-3 w-3 inline ml-1 text-amber-600"/>}
                    </td>
                    <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={()=>openEdit(f)}>Editar</Button></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum follow-up.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} follow-up</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Sel label="Lead" value={form.lead_id} onChange={(v:string)=>setForm({...form,lead_id:v})} opts={leads.map(l=>({value:l.id,label:l.empresa}))} allowEmpty/>
            <Sel label="Cliente" value={form.client_id} onChange={(v:string)=>setForm({...form,client_id:v})} opts={clients.map(c=>({value:c.id,label:c.razao_social}))} allowEmpty/>
            <Sel label="Oportunidade" value={form.oportunidade_id} onChange={(v:string)=>setForm({...form,oportunidade_id:v})} opts={oports.map(o=>({value:o.id,label:o.titulo}))} allowEmpty/>
            <Sel label="Tipo" value={form.tipo} onChange={(v:string)=>setForm({...form,tipo:v})} opts={FUP_TIPOS}/>
            <F label="Data" type="date" value={form.data||""} onChange={(v:string)=>setForm({...form,data:v})}/>
            <F label="Hora" type="time" value={form.hora||""} onChange={(v:string)=>setForm({...form,hora:v})}/>
            <Sel label="Status" value={form.status} onChange={(v:string)=>setForm({...form,status:v})} opts={FUP_STATUS}/>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Resumo do contato</Label>
              <Textarea rows={3} value={form.resumo||""} onChange={e=>setForm({...form,resumo:e.target.value})}/>
            </div>
            <F className="sm:col-span-2" label="Próxima ação" value={form.proxima_acao} onChange={(v:string)=>setForm({...form,proxima_acao:v})}/>
            <F label="Data do próximo follow-up" type="date" value={form.proximo_followup_data||""} onChange={(v:string)=>setForm({...form,proximo_followup_data:v||null})}/>
            <F label="Hora" type="time" value={form.proximo_followup_hora||""} onChange={(v:string)=>setForm({...form,proximo_followup_hora:v})}/>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, value, onChange, type="text", className }: any) {
  return (
    <div className={`space-y-1.5 ${className||""}`}>
      <Label>{label}</Label>
      <Input type={type} value={value??""} onChange={(e:any)=>onChange(e.target.value)} />
    </div>
  );
}
function Sel({ label, value, onChange, opts, allowEmpty }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || "__none"} onValueChange={(v)=>onChange(v === "__none" ? null : v)}>
        <SelectTrigger><SelectValue placeholder="Selecione…"/></SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value="__none">— Nenhum —</SelectItem>}
          {opts.map((o:any)=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
