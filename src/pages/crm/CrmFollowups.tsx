import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, CheckCircle2, CalendarClock, ListTodo, Search, LayoutList, KanbanSquare, Filter, CalendarPlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FUP_TIPOS, FUP_STATUS } from "@/lib/crm";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const empty = {
  lead_id: null, client_id: null, oportunidade_id: null, proposal_id: null,
  tipo: "ligacao", data: new Date().toISOString().slice(0,10), hora: "",
  responsavel_id: null, resumo: "", proxima_acao: "",
  proximo_followup_data: null, proximo_followup_hora: "",
  status: "pendente",
};

function todayISO() { return new Date().toISOString().slice(0,10); }
function addDaysISO(days: number) { const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

type Bucket = "atrasados" | "hoje" | "semana" | "futuro" | "concluidos";
function bucketOf(f: any): Bucket {
  const hoje = todayISO();
  if (f.status === "realizado") return "concluidos";
  if (f.status === "cancelado") return "concluidos";
  if (f.data < hoje) return "atrasados";
  if (f.data === hoje) return "hoje";
  if (f.data <= addDaysISO(7)) return "semana";
  return "futuro";
}

export default function CrmFollowups() {
  const [sp, setSp] = useSearchParams();
  const [list, setList] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [oports, setOports] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [fStatus, setFStatus] = useState("__all");
  const [fTipo, setFTipo] = useState("__all");
  const [fResp, setFResp] = useState("__all");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [busca, setBusca] = useState("");
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [concluirOpen, setConcluirOpen] = useState<any>(null);
  const [concluirForm, setConcluirForm] = useState<any>({ resumo: "", proxima_acao: "", proximo_followup_data: "", proximo_followup_hora: "", tipo_proximo: "ligacao" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [reagOpen, setReagOpen] = useState<any>(null);
  const [reagForm, setReagForm] = useState<any>({ data: "", hora: "", motivo: "" });

  useEffect(() => { document.title = "Follow-ups | CRM HSE"; reload(); }, []);

  useEffect(() => {
    if (sp.get("novo") === "1") {
      const prefill: any = { ...empty };
      const op = sp.get("oportunidade"); if (op) prefill.oportunidade_id = op;
      const ld = sp.get("lead"); if (ld) prefill.lead_id = ld;
      const cl = sp.get("cliente"); if (cl) prefill.client_id = cl;
      setEditing(null); setForm(prefill); setOpen(true);
      const next = new URLSearchParams(sp);
      ["novo","oportunidade","lead","cliente"].forEach(k=>next.delete(k));
      setSp(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    const [f, l, c, o, p] = await Promise.all([
      supabase.from("crm_followups").select("*"),
      supabase.from("crm_leads").select("id, empresa"),
      supabase.from("clients").select("id, razao_social"),
      supabase.from("crm_oportunidades").select("id, titulo"),
      supabase.from("profiles").select("id, nome, email"),
    ]);
    setList(f.data||[]); setLeads(l.data||[]); setClients(c.data||[]); setOports(o.data||[]); setProfiles(p.data||[]);
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(f:any) { setEditing(f); setForm({ ...empty, ...f }); setOpen(true); }

  async function notifyResponsavel(payload: any, followupId?: string) {
    if (!payload.responsavel_id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && payload.responsavel_id === user.id) return;
    const vinc =
      oports.find(o=>o.id===payload.oportunidade_id)?.titulo
      || clients.find(c=>c.id===payload.client_id)?.razao_social
      || leads.find(l=>l.id===payload.lead_id)?.empresa
      || "";
    const tipoLabel = FUP_TIPOS.find(t=>t.value===payload.tipo)?.label || payload.tipo;
    await supabase.from("notificacoes").insert({
      user_id: payload.responsavel_id,
      modulo: "crm",
      tipo: "followup_agendado",
      titulo: `Follow-up agendado: ${tipoLabel}${vinc ? " · " + vinc : ""}`,
      mensagem: `${formatDate(payload.data)}${payload.hora ? " às " + String(payload.hora).slice(0,5) : ""}${payload.proxima_acao ? " — " + payload.proxima_acao : ""}`,
      prioridade: payload.data <= todayISO() ? "alta" : "normal",
      status: "nao_lida",
      link: "/crm/followups",
      entidade_tipo: "crm_followup",
      entidade_id: followupId ?? null,
      origem: "manual",
      metadata: {},
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!form.lead_id && !form.client_id && !form.oportunidade_id) {
      setFormErr("Vincule o follow-up a pelo menos um Lead, Cliente ou Oportunidade.");
      return;
    }
    const payload: any = { ...form };
    ["lead_id","client_id","oportunidade_id","proposal_id"].forEach(k => { if (!payload[k]) payload[k]=null; });
    if (!payload.hora) payload.hora = null;
    if (!payload.proximo_followup_hora) payload.proximo_followup_hora = null;
    if (!payload.proximo_followup_data) payload.proximo_followup_data = null;
    if (!editing) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) payload.created_by = user.id;
    }
    if (editing) {
      const { error } = await supabase.from("crm_followups").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("crm_followups").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      if (payload.status === "pendente") await notifyResponsavel(payload, data?.id);
    }
    toast.success("Follow-up salvo"); setOpen(false); reload();
  }

  function openConcluir(f: any) {
    setConcluirOpen(f);
    setConcluirForm({
      resumo: f.resumo || "",
      proxima_acao: "",
      proximo_followup_data: "",
      proximo_followup_hora: "",
      tipo_proximo: f.tipo || "ligacao",
    });
  }
  async function confirmarConcluir(e: React.FormEvent) {
    e.preventDefault();
    const f = concluirOpen;
    if (!f) return;
    const { data: { user } } = await supabase.auth.getUser();
    const upd: any = { status: "realizado", resumo: concluirForm.resumo || f.resumo };
    const { error: e1 } = await supabase.from("crm_followups").update(upd).eq("id", f.id);
    if (e1) return toast.error(e1.message);
    if (concluirForm.proximo_followup_data) {
      const novo: any = {
        lead_id: f.lead_id, client_id: f.client_id,
        oportunidade_id: f.oportunidade_id, proposal_id: f.proposal_id,
        tipo: concluirForm.tipo_proximo,
        data: concluirForm.proximo_followup_data,
        hora: concluirForm.proximo_followup_hora || null,
        responsavel_id: f.responsavel_id,
        proxima_acao: concluirForm.proxima_acao || null,
        status: "pendente",
        created_by: user?.id || null,
      };
      const { error: e2 } = await supabase.from("crm_followups").insert(novo);
      if (e2) return toast.error(e2.message);
    }
    toast.success("Follow-up concluído");
    setConcluirOpen(null); reload();
  }

  const hoje = todayISO();
  const respNome = (id: string) => {
    const p = profiles.find(x => x.id === id);
    return p?.nome || p?.email || "—";
  };
  const vinculadoLabel = (f: any) =>
    oports.find(o=>o.id===f.oportunidade_id)?.titulo
    || clients.find(c=>c.id===f.client_id)?.razao_social
    || leads.find(l=>l.id===f.lead_id)?.empresa
    || "—";

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return list
      .filter(f => fStatus === "__all" || f.status === fStatus)
      .filter(f => fTipo === "__all" || f.tipo === fTipo)
      .filter(f => fResp === "__all" || f.responsavel_id === fResp)
      .filter(f => !fDe || f.data >= fDe)
      .filter(f => !fAte || f.data <= fAte)
      .filter(f => !q
        || (f.resumo || "").toLowerCase().includes(q)
        || (f.proxima_acao || "").toLowerCase().includes(q)
        || vinculadoLabel(f).toLowerCase().includes(q))
      .sort((a,b) => {
        // Pendentes primeiro (atrasados no topo), depois futuros, depois realizados
        const rank = (x: any) => {
          if (x.status !== "pendente") return 3;
          if (x.data < hoje) return 0;
          if (x.data === hoje) return 1;
          return 2;
        };
        const rA = rank(a), rB = rank(b);
        if (rA !== rB) return rA - rB;
        return (a.data || "").localeCompare(b.data || "");
      });
  }, [list, fStatus, fTipo, fResp, fDe, fAte, busca, oports, clients, leads, hoje]);

  const kpis = useMemo(() => {
    const pend = list.filter(f => f.status === "pendente");
    return {
      atrasados: pend.filter(f => f.data < hoje).length,
      hoje: pend.filter(f => f.data === hoje).length,
      semana7: pend.filter(f => f.data > hoje && f.data <= addDaysISO(7)).length,
      semProx: list.filter(f => f.status === "realizado" && !f.proxima_acao && (f.data || "") >= addDaysISO(-30)).length,
    };
  }, [list, hoje]);

  const groups = useMemo(() => {
    const g: Record<Bucket, any[]> = { atrasados: [], hoje: [], semana: [], futuro: [], concluidos: [] };
    for (const f of filtered) g[bucketOf(f)].push(f);
    return g;
  }, [filtered]);

  function resetFiltros() {
    setFStatus("__all"); setFTipo("__all"); setFResp("__all"); setFDe(""); setFAte(""); setBusca("");
  }

  return (
    <div>
      <PageHeader title="Follow-ups" subtitle="Contatos comerciais registrados e agendados"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2"/>Novo follow-up</Button>}/>
      <div className="p-6 space-y-4">
        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={AlertTriangle} label="Atrasados" value={kpis.atrasados} tone="danger" onClick={() => { resetFiltros(); setFStatus("pendente"); setFAte(addDaysISO(-1)); }} />
          <KpiCard icon={CalendarClock} label="Hoje" value={kpis.hoje} tone="warning" onClick={() => { resetFiltros(); setFStatus("pendente"); setFDe(hoje); setFAte(hoje); }} />
          <KpiCard icon={ListTodo} label="Próximos 7 dias" value={kpis.semana7} tone="info" onClick={() => { resetFiltros(); setFStatus("pendente"); setFDe(addDaysISO(1)); setFAte(addDaysISO(7)); }} />
          <KpiCard icon={Filter} label="Sem próxima ação (30d)" value={kpis.semProx} tone="muted" onClick={() => { resetFiltros(); setFStatus("realizado"); }} />
        </div>

        {/* Filtros + view switcher */}
        <Card className="p-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px] space-y-1">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Resumo, empresa, ação…" className="pl-7 h-9" />
            </div>
          </div>
          <MiniSel label="Status" value={fStatus} onChange={setFStatus} opts={[{value:"__all",label:"Todos"},...FUP_STATUS.map(s=>({value:s.value,label:s.label}))]} />
          <MiniSel label="Tipo" value={fTipo} onChange={setFTipo} opts={[{value:"__all",label:"Todos"},...FUP_TIPOS.map(t=>({value:t.value,label:t.label}))]} />
          <MiniSel label="Responsável" value={fResp} onChange={setFResp} opts={[{value:"__all",label:"Todos"},...profiles.map(p=>({value:p.id,label:p.nome||p.email}))]} />
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={fDe} onChange={e=>setFDe(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={fAte} onChange={e=>setFAte(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <Button variant="ghost" size="sm" onClick={resetFiltros}>Limpar</Button>
          <div className="ml-auto">
            <Tabs value={view} onValueChange={(v)=>setView(v as any)}>
              <TabsList>
                <TabsTrigger value="lista"><LayoutList className="h-4 w-4 mr-1"/>Lista</TabsTrigger>
                <TabsTrigger value="kanban"><KanbanSquare className="h-4 w-4 mr-1"/>Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Card>

        {view === "lista" ? (
        <Card className="overflow-hidden shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Data</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-left px-4 py-2">Vinculado a</th>
                <th className="text-left px-4 py-2">Responsável</th>
                <th className="text-left px-4 py-2">Resumo</th>
                <th className="text-left px-4 py-2">Próxima ação</th>
                <th className="text-left px-4 py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(["atrasados","hoje","semana","futuro","concluidos"] as Bucket[]).map(b => {
                const items = groups[b];
                if (!items.length) return null;
                return (
                  <>
                    <tr key={`h-${b}`} className="bg-muted/40">
                      <td colSpan={8} className="px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {b === "atrasados" && "Atrasados"}
                        {b === "hoje" && "Hoje"}
                        {b === "semana" && "Próximos 7 dias"}
                        {b === "futuro" && "Depois"}
                        {b === "concluidos" && "Concluídos / Cancelados"}
                        <span className="ml-2 text-muted-foreground/70 normal-case">({items.length})</span>
                      </td>
                    </tr>
                    {items.map(f => {
                      const status = FUP_STATUS.find(s=>s.value===f.status);
                      const tipo = FUP_TIPOS.find(t=>t.value===f.tipo);
                      const vencido = b === "atrasados";
                      return (
                        <tr key={f.id} className={cn("border-t hover:bg-muted/30", vencido && "bg-amber-50/60 dark:bg-amber-900/10")}>
                          <td className="px-4 py-3">{formatDate(f.data)} {f.hora && <span className="text-xs text-muted-foreground">{f.hora.slice(0,5)}</span>}</td>
                          <td className="px-4 py-3 text-xs">{tipo?.label}</td>
                          <td className="px-4 py-3 text-xs">{vinculadoLabel(f)}</td>
                          <td className="px-4 py-3 text-xs">{f.responsavel_id ? respNome(f.responsavel_id) : "—"}</td>
                          <td className="px-4 py-3 text-xs max-w-xs truncate" title={f.resumo}>{f.resumo || "—"}</td>
                          <td className="px-4 py-3 text-xs">{f.proxima_acao || "—"} {f.proximo_followup_data && <span className="text-muted-foreground">({formatDate(f.proximo_followup_data)})</span>}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-block px-2 py-0.5 rounded text-xs", status?.color)}>{status?.label}</span>
                            {vencido && <AlertTriangle className="h-3 w-3 inline ml-1 text-amber-600"/>}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {f.status === "pendente" && (
                              <Button variant="ghost" size="sm" onClick={()=>openConcluir(f)} className="text-emerald-700 hover:text-emerald-800">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1"/>Concluir
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={()=>openEdit(f)}>Editar</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum follow-up.</td></tr>}
            </tbody>
          </table>
        </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            {(["atrasados","hoje","semana","futuro"] as Bucket[]).map(b => (
              <Card key={b} className="p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center justify-between">
                  <span>
                    {b === "atrasados" && "Atrasados"}
                    {b === "hoje" && "Hoje"}
                    {b === "semana" && "Próximos 7 dias"}
                    {b === "futuro" && "Depois"}
                  </span>
                  <span className="text-muted-foreground/70">{groups[b].length}</span>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {groups[b].length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Vazio</p>}
                  {groups[b].map(f => {
                    const tipo = FUP_TIPOS.find(t=>t.value===f.tipo);
                    return (
                      <div key={f.id} className={cn("rounded-md border p-2 text-xs space-y-1 bg-card hover:shadow-sm", b==="atrasados" && "border-amber-300")}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{formatDate(f.data)}{f.hora && <> · {f.hora.slice(0,5)}</>}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{tipo?.label}</span>
                        </div>
                        <div className="font-semibold text-sm truncate" title={vinculadoLabel(f)}>{vinculadoLabel(f)}</div>
                        {f.resumo && <div className="text-muted-foreground line-clamp-2">{f.resumo}</div>}
                        {f.proxima_acao && <div className="text-[11px] text-muted-foreground italic truncate">→ {f.proxima_acao}</div>}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-muted-foreground">{f.responsavel_id ? respNome(f.responsavel_id) : ""}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-emerald-700" onClick={()=>openConcluir(f)}><CheckCircle2 className="h-3 w-3"/></Button>
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={()=>openEdit(f)}>Editar</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
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
            <Sel label="Responsável" value={form.responsavel_id} onChange={(v:string)=>setForm({...form,responsavel_id:v})} opts={profiles.map(p=>({value:p.id,label:p.nome||p.email}))} allowEmpty/>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Resumo do contato</Label>
              <Textarea rows={3} value={form.resumo||""} onChange={e=>setForm({...form,resumo:e.target.value})}/>
            </div>
            <F className="sm:col-span-2" label="Próxima ação" value={form.proxima_acao} onChange={(v:string)=>setForm({...form,proxima_acao:v})}/>
            <F label="Data do próximo follow-up" type="date" value={form.proximo_followup_data||""} onChange={(v:string)=>setForm({...form,proximo_followup_data:v||null})}/>
            <F label="Hora" type="time" value={form.proximo_followup_hora||""} onChange={(v:string)=>setForm({...form,proximo_followup_hora:v})}/>
            {formErr && <div className="sm:col-span-2 text-sm text-destructive">{formErr}</div>}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo Concluir em 1 clique */}
      <Dialog open={!!concluirOpen} onOpenChange={(v)=>!v && setConcluirOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Concluir follow-up</DialogTitle></DialogHeader>
          {concluirOpen && (
            <form onSubmit={confirmarConcluir} className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {vinculadoLabel(concluirOpen)} · {formatDate(concluirOpen.data)}
              </div>
              <div className="space-y-1.5">
                <Label>Resumo do contato</Label>
                <Textarea rows={3} value={concluirForm.resumo} onChange={e=>setConcluirForm({...concluirForm,resumo:e.target.value})} />
              </div>
              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agendar próximo contato (opcional)</div>
                <F label="Próxima ação" value={concluirForm.proxima_acao} onChange={(v:string)=>setConcluirForm({...concluirForm,proxima_acao:v})}/>
                <div className="grid grid-cols-3 gap-2">
                  <F label="Data" type="date" value={concluirForm.proximo_followup_data} onChange={(v:string)=>setConcluirForm({...concluirForm,proximo_followup_data:v})}/>
                  <F label="Hora" type="time" value={concluirForm.proximo_followup_hora} onChange={(v:string)=>setConcluirForm({...concluirForm,proximo_followup_hora:v})}/>
                  <Sel label="Tipo" value={concluirForm.tipo_proximo} onChange={(v:string)=>setConcluirForm({...concluirForm,tipo_proximo:v})} opts={FUP_TIPOS}/>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={()=>setConcluirOpen(null)}>Cancelar</Button>
                <Button type="submit"><CheckCircle2 className="h-4 w-4 mr-2"/>Concluir</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, onClick }: any) {
  const tones: Record<string,string> = {
    danger: "border-l-4 border-rose-500",
    warning: "border-l-4 border-amber-500",
    info: "border-l-4 border-sky-500",
    muted: "border-l-4 border-slate-400",
  };
  return (
    <button type="button" onClick={onClick} className={cn("text-left", "block w-full")}>
      <Card className={cn("p-4 hover:shadow-md transition-shadow", tones[tone])}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </Card>
    </button>
  );
}

function MiniSel({ label, value, onChange, opts }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-[140px]"><SelectValue/></SelectTrigger>
        <SelectContent>
          {opts.map((o:any)=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
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
