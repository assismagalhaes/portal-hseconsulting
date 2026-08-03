import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarPlus, CheckCircle2, Clock } from "lucide-react";
import { ETAPAS, etapaColor, etapaLabel, TEMPERATURAS } from "@/lib/crm";
import { FUP_TIPOS, FUP_STATUS } from "@/lib/crm";
import { prioridadeLabel, prioridadeColor, brl, formatDate } from "@/lib/format";
import { toast } from "sonner";

const PRIORIDADES = [
  { value: "baixa", label: "Baixa" },{ value: "normal", label: "Normal" },{ value: "alta", label: "Alta" },{ value: "urgente", label: "Urgente" },
];

const empty = {
  titulo:"", lead_id: null, client_id: null, proposal_id: null, service_id: null, servico_interesse:"",
  valor_estimado: 0, probabilidade: 50, data_prevista_fechamento: null,
  responsavel_id: null, etapa: "novo_lead", prioridade: "normal", temperatura: "morno",
  observacoes:"", motivo_perda:"", motivo_perda_obs:"",
};

export default function CrmOportunidades() {
  const [list, setList] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [fEtapa, setFEtapa] = useState("__all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { document.title = "Oportunidades | CRM HSE"; reload(); }, []);
  async function reload() {
    const [o, l, c, m, f] = await Promise.all([
      supabase.from("crm_oportunidades").select("*").order("created_at",{ascending:false}),
      supabase.from("crm_leads").select("id, empresa"),
      supabase.from("clients").select("id, razao_social, nome_fantasia"),
      supabase.from("crm_motivos_perda").select("*").eq("ativo", true).order("ordem"),
      supabase.from("crm_followups").select("*").order("data",{ascending:false}),
    ]);
    setList(o.data||[]); setLeads(l.data||[]); setClients(c.data||[]); setMotivos(m.data||[]); setFollowups(f.data||[]);
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(o:any) { setEditing(o); setForm({ ...empty, ...o }); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.etapa === "perdido" && !form.motivo_perda) {
      return toast.error("Selecione o motivo da perda");
    }
    const payload: any = {
      ...form,
      valor_estimado: Number(form.valor_estimado)||0,
      probabilidade: Math.min(100, Math.max(0, Number(form.probabilidade)||0)),
    };
    if (!payload.lead_id) payload.lead_id = null;
    if (!payload.client_id) payload.client_id = null;
    if (!payload.proposal_id) payload.proposal_id = null;
    if (!payload.data_prevista_fechamento) payload.data_prevista_fechamento = null;

    const { error } = editing
      ? await supabase.from("crm_oportunidades").update(payload).eq("id", editing.id)
      : await supabase.from("crm_oportunidades").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Oportunidade atualizada" : "Oportunidade criada");
    setOpen(false); reload();
  }

  const filtered = list.filter(o => {
    if (fEtapa !== "__all" && o.etapa !== fEtapa) return false;
    return !q || o.titulo?.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <PageHeader title="Oportunidades" subtitle="Negociações em andamento"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2"/>Nova oportunidade</Button>} />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Buscar por título…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-md"/>
          <Select value={fEtapa} onValueChange={setFEtapa}>
            <SelectTrigger className="w-56"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as etapas</SelectItem>
              {ETAPAS.map(e=><SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Título</th>
                <th className="text-left px-4 py-2">Etapa</th>
                <th className="text-left px-4 py-2">Temperatura</th>
                <th className="text-left px-4 py-2">Prioridade</th>
                <th className="text-right px-4 py-2">Valor</th>
                <th className="text-right px-4 py-2">Prob.</th>
                <th className="text-right px-4 py-2">Ponderado</th>
                <th className="text-left px-4 py-2">Previsão</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const temp = TEMPERATURAS.find(t=>t.value===o.temperatura);
                return (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.titulo}</td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs ${etapaColor[o.etapa]}`}>{etapaLabel[o.etapa]}</span></td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs ${temp?.color}`}>{temp?.label}</span></td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs ${prioridadeColor[o.prioridade]}`}>{prioridadeLabel[o.prioridade]}</span></td>
                    <td className="px-4 py-3 text-right font-mono">{brl(o.valor_estimado)}</td>
                    <td className="px-4 py-3 text-right">{o.probabilidade}%</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">{brl(Number(o.valor_estimado||0)*Number(o.probabilidade||0)/100)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(o.data_prevista_fechamento)}</td>
                    <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={()=>openEdit(o)}>Editar</Button></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhuma oportunidade.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <F className="sm:col-span-2" label="Título" required value={form.titulo} onChange={(v:string)=>setForm({...form,titulo:v})}/>
            <Sel label="Lead" value={form.lead_id} onChange={(v:string)=>setForm({...form,lead_id:v})} opts={leads.map(l=>({value:l.id,label:l.empresa}))} allowEmpty/>
            <Sel label="Cliente" value={form.client_id} onChange={(v:string)=>setForm({...form,client_id:v})} opts={clients.map(c=>({value:c.id,label:c.razao_social}))} allowEmpty/>
            <F label="Serviço de interesse" value={form.servico_interesse} onChange={(v:string)=>setForm({...form,servico_interesse:v})}/>
            <F label="Valor estimado (R$)" type="number" value={String(form.valor_estimado||0)} onChange={(v:string)=>setForm({...form,valor_estimado:v})}/>
            <F label="Probabilidade (%)" type="number" value={String(form.probabilidade||0)} onChange={(v:string)=>setForm({...form,probabilidade:v})}/>
            <F label="Previsão de fechamento" type="date" value={form.data_prevista_fechamento||""} onChange={(v:string)=>setForm({...form,data_prevista_fechamento:v||null})}/>
            <Sel label="Etapa" value={form.etapa} onChange={(v:string)=>setForm({...form,etapa:v})} opts={ETAPAS.map(e=>({value:e.value,label:e.label}))}/>
            <Sel label="Temperatura" value={form.temperatura} onChange={(v:string)=>setForm({...form,temperatura:v})} opts={TEMPERATURAS.map(t=>({value:t.value,label:t.label}))}/>
            <Sel label="Prioridade" value={form.prioridade} onChange={(v:string)=>setForm({...form,prioridade:v})} opts={PRIORIDADES}/>
            {form.etapa === "perdido" && (
              <>
                <Sel label="Motivo da perda" value={form.motivo_perda} onChange={(v:string)=>setForm({...form,motivo_perda:v})} opts={motivos.map(m=>({value:m.nome,label:m.nome}))}/>
                <F className="sm:col-span-1" label="Observação da perda" value={form.motivo_perda_obs} onChange={(v:string)=>setForm({...form,motivo_perda_obs:v})}/>
              </>
            )}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes||""} onChange={e=>setForm({...form,observacoes:e.target.value})}/>
            </div>
            {editing && (
              <div className="sm:col-span-2 space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Histórico de follow-ups</Label>
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/crm/followups?novo=1&oportunidade=${editing.id}`}>
                      <CalendarPlus className="h-3.5 w-3.5 mr-1"/>Novo follow-up
                    </Link>
                  </Button>
                </div>
                {(() => {
                  const items = followups.filter(f => f.oportunidade_id === editing.id).slice(0,10);
                  if (!items.length) return <p className="text-xs text-muted-foreground py-3">Nenhum follow-up registrado.</p>;
                  return (
                    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {items.map(f => {
                        const tipo = FUP_TIPOS.find(t=>t.value===f.tipo)?.label || f.tipo;
                        const st = FUP_STATUS.find(s=>s.value===f.status);
                        const Icon = f.status === "realizado" ? CheckCircle2 : Clock;
                        return (
                          <li key={f.id} className="rounded-md border p-2 text-xs bg-muted/30">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground"/>
                              <span className="font-medium">{formatDate(f.data)}{f.hora && ` · ${String(f.hora).slice(0,5)}`}</span>
                              <span className="px-1.5 py-0.5 rounded bg-muted">{tipo}</span>
                              <span className={`px-1.5 py-0.5 rounded ${st?.color}`}>{st?.label}</span>
                            </div>
                            {f.resumo && <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{f.resumo}</div>}
                            {f.proxima_acao && <div className="italic text-muted-foreground mt-0.5">→ {f.proxima_acao}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            )}
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

function F({ label, value, onChange, type="text", required, className }: any) {
  return (
    <div className={`space-y-1.5 ${className||""}`}>
      <Label>{label}{required && <span className="text-rose-600"> *</span>}</Label>
      <Input type={type} value={value??""} required={required} onChange={(e:any)=>onChange(e.target.value)} />
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
