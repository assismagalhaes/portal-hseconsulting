import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PercentInput } from "@/components/ui/percent-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Printer, QrCode, Upload, MapPin, ClipboardCheck, Camera, FileText as FileIcon, History, Users as UsersIcon, ListTree, Truck, Eye, CheckCircle2 } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { osStatusLabel, osStatusColor, osPrioridadeLabel, osPrioridadeColor, osRecursoTipoLabel, osVisitaSituacaoLabel, osDocCategoriaLabel, osEvidenciaTipoLabel } from "@/lib/os";

export default function OrdemServicoEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [os, setOs] = useState<any>(null);
  const [profs, setProfs] = useState<any[]>([]);
  const [projResp, setProjResp] = useState<any>(null);
  const [equipe, setEquipe] = useState<any[]>([]);
  const [recursos, setRecursos] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [logistica, setLogistica] = useState<any>(null);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  const reload = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("*, clients(*), execucao_servicos(numero_interno, titulo), services(nome), projetos(id, numero, titulo, responsavel_execucao_id, data_fim_real, projeto_servicos(nome)), execucao_profissionais!ordens_servico_responsavel_tecnico_id_fkey(*)")
      .eq("id", id).maybeSingle();
    if (error) return toast.error(error.message);
    setOs(data);
    if (data?.projetos?.responsavel_execucao_id) {
      const respId = data.projetos.responsavel_execucao_id;
      const { data: pr } = await supabase.from("profiles")
        .select("id, nome, email, cargo, area, registro_profissional, telefone")
        .eq("id", respId).maybeSingle();
      if (pr) {
        setProjResp(pr);
      } else {
        const { data: pro } = await supabase.from("execucao_profissionais")
          .select("id, nome, email, cargo, area, registro_profissional, telefone")
          .eq("id", respId).maybeSingle();
        setProjResp(pro || null);
      }
    } else {
      setProjResp(null);
    }
    const [pp, eq, rec, ck, vi, lo, dc, ev, tl] = await Promise.all([
      supabase.from("execucao_profissionais").select("*").order("nome"),
      supabase.from("os_equipe").select("*, execucao_profissionais(*)").eq("os_id", id),
      supabase.from("os_recursos").select("*").eq("os_id", id).order("tipo"),
      supabase.from("os_checklist").select("*").eq("os_id", id).order("ordem").order("created_at"),
      supabase.from("os_visitas").select("*, execucao_profissionais(nome)").eq("os_id", id).order("data").order("hora_inicio"),
      supabase.from("os_logistica").select("*").eq("os_id", id).maybeSingle(),
      supabase.from("os_documentos").select("*").eq("os_id", id).order("created_at", { ascending: false }),
      supabase.from("os_evidencias").select("*").eq("os_id", id).order("created_at", { ascending: false }),
      supabase.from("os_timeline").select("*").eq("os_id", id).order("created_at", { ascending: false }),
    ]);
    setProfs((pp.data as any) || []); setEquipe((eq.data as any) || []);
    setRecursos((rec.data as any) || []); setChecklist((ck.data as any) || []);
    setVisitas((vi.data as any) || []); setLogistica(lo.data || null);
    setDocumentos((dc.data as any) || []); setEvidencias((ev.data as any) || []);
    setTimeline((tl.data as any) || []);
  };
  useEffect(() => { reload(); }, [id]);

  const save = async (patch: any) => {
    const { error } = await supabase.from("ordens_servico").update(patch).eq("id", os.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado"); reload();
  };

  const checklistProgress = useMemo(() => {
    if (!checklist.length) return 0;
    return Math.round((checklist.filter(c => c.concluido).length / checklist.length) * 100);
  }, [checklist]);

  if (!os) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  return (
    <>
      <PageHeader title={`${os.numero} — ${os.titulo}`} subtitle={os.projetos ? `Projeto ${os.projetos.numero} • ${os.projetos.titulo}` : os.execucao_servicos ? `Execução ${os.execucao_servicos.numero_interno} • ${os.execucao_servicos.titulo}` : undefined}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("/ordens-servico")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
            {os.projetos && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/projetos/${os.projetos.id}`)}>Ver projeto</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.open(`/ordens-servico/${os.id}/imprimir`, "_blank")}><Printer className="h-4 w-4 mr-2" />Imprimir OS</Button>
          </>
        } />

      <div className="p-6 space-y-4">
        {/* Barra de status */}
        <Card><CardContent className="p-4 flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase">Status</Label>
            <Select value={os.status} onValueChange={v => save({ status: v })}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(osStatusLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Badge className={osStatusColor[os.status]} variant="secondary">{osStatusLabel[os.status]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase">Prioridade</Label>
            <Select value={os.prioridade} onValueChange={v => save({ prioridade: v })}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(osPrioridadeLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Badge className={osPrioridadeColor[os.prioridade]} variant="secondary">{osPrioridadeLabel[os.prioridade]}</Badge>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs uppercase">Progresso: {os.percentual_executado}%</Label>
            <div className="flex gap-2 items-center">
              <Progress value={os.percentual_executado} className="flex-1" />
              <PercentInput decimal={false} className="w-24" value={os.percentual_executado}
                onChange={(n) => save({ percentual_executado: Math.max(0, Math.min(100, Number(n) || 0)) })} />
            </div>
          </div>
        </CardContent></Card>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview"><Eye className="h-4 w-4 mr-1.5" />Visão geral</TabsTrigger>
            <TabsTrigger value="checklist"><ClipboardCheck className="h-4 w-4 mr-1.5" />Checklist <span className="ml-1 text-xs text-muted-foreground">({checklistProgress}%)</span></TabsTrigger>
            <TabsTrigger value="visitas"><MapPin className="h-4 w-4 mr-1.5" />Visitas</TabsTrigger>
            <TabsTrigger value="evidencias"><Camera className="h-4 w-4 mr-1.5" />Evidências</TabsTrigger>
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-1.5" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <Card><CardContent className="p-4 grid md:grid-cols-2 gap-4">
              <KV k="Cliente" v={os.cliente_nome || os.clients?.nome_fantasia || os.clients?.razao_social || "—"} />
              <KV k="Cidade" v={
                os.cidade || [os.clients?.cidade, os.clients?.uf].filter(Boolean).join(" / ") || "—"
              } />
              <KV k="Serviço" v={
                os.servico_nome
                || os.services?.nome
                || os.projetos?.projeto_servicos?.map((s: any) => s.nome).filter(Boolean).join(", ")
                || os.projetos?.titulo
                || "—"
              } />
              <KV k="QR Token" v={<span className="font-mono text-xs flex items-center gap-1"><QrCode className="h-3 w-3" />{os.qr_token}</span>} />
              <KV k="Abertura" v={formatDate(os.data_abertura)} />
              <KV k="Previsão início" v={
                <Input type="date" defaultValue={os.data_prevista_inicio || ""} onBlur={e => save({ data_prevista_inicio: e.target.value || null })} />
              } />
              <KV k="Previsão conclusão" v={
                <Input type="date" defaultValue={os.data_prevista_conclusao || ""} onBlur={e => save({ data_prevista_conclusao: e.target.value || null })} />
              } />
              <KV k="Conclusão real" v={
                os.projetos?.data_fim_real ? (
                  <div className="text-sm">
                    <div>{formatDate(os.projetos.data_fim_real)}</div>
                    <div className="text-xs text-muted-foreground">Herdado do projeto {os.projetos.numero}</div>
                  </div>
                ) : formatDate(os.data_real_conclusao)
              } />
              <KV k="Responsável técnico" v={
                projResp ? (
                  <div className="text-sm">
                    <div className="font-medium">{projResp.nome || projResp.email}</div>
                    <div className="text-xs text-muted-foreground">Herdado do projeto {os.projetos?.numero}</div>
                  </div>
                ) : (
                  <Select value={os.responsavel_tecnico_id || ""} onValueChange={v => save({ responsavel_tecnico_id: v || null })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                )
              } />
            </CardContent></Card>
            {projResp ? (
              <Card><CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">Responsável técnico (do projeto)</div>
                <div className="grid md:grid-cols-3 gap-2 text-sm">
                  <KV k="Nome" v={projResp.nome || "—"} />
                  <KV k="Cargo" v={projResp.cargo || "—"} />
                  <KV k="Área" v={projResp.area || "—"} />
                  <KV k="Registro" v={projResp.registro_profissional || "—"} />
                  <KV k="Telefone" v={projResp.telefone || "—"} />
                  <KV k="E-mail" v={projResp.email || "—"} />
                </div>
              </CardContent></Card>
            ) : os.execucao_profissionais && (
              <Card><CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">Responsável técnico</div>
                <div className="grid md:grid-cols-3 gap-2 text-sm">
                  <KV k="Nome" v={os.execucao_profissionais.nome} />
                  <KV k="Cargo" v={os.execucao_profissionais.cargo || "—"} />
                  <KV k="Área" v={os.execucao_profissionais.area || "—"} />
                  <KV k="Registro" v={os.execucao_profissionais.registro_profissional || "—"} />
                  <KV k="Telefone" v={os.execucao_profissionais.telefone || "—"} />
                  <KV k="E-mail" v={os.execucao_profissionais.email || "—"} />
                </div>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="checklist">
            <ChecklistCard osId={os.id} items={checklist} onChange={reload} />
          </TabsContent>

          <TabsContent value="visitas">
            <VisitasCard osId={os.id} visitas={visitas} profs={profs} projRespId={projResp?.id} onChange={reload} />
          </TabsContent>

          <TabsContent value="evidencias">
            <EvidenciasCard osId={os.id} evidencias={evidencias} visitas={visitas} onChange={reload} />
          </TabsContent>

          <TabsContent value="historico">
            <Card><CardContent className="p-4">
              <div className="space-y-2">
                {timeline.map(t => (
                  <div key={t.id} className="flex items-start gap-3 text-sm border-l-2 border-primary/30 pl-3">
                    <div className="flex-1">
                      <div className="font-medium">{t.evento}</div>
                      {t.detalhe && <div className="text-muted-foreground text-xs">{t.detalhe}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</div>
                  </div>
                ))}
                {!timeline.length && <p className="text-sm text-muted-foreground">Sem eventos.</p>}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function KV({ k, v }: { k: string; v: any }) {
  return <div><div className="text-xs uppercase text-muted-foreground mb-0.5">{k}</div><div className="text-sm">{v}</div></div>;
}
function Field({ label, children }: { label: string; children: any }) {
  return <div><Label className="text-xs uppercase">{label}</Label>{children}</div>;
}

// ============ SUB-CARDS ============

function RecursosCard({ osId, recursos, onChange }: any) {
  const [tipo, setTipo] = useState("equipamento");
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState("1");
  const add = async () => {
    if (!desc) return;
    const { error } = await supabase.from("os_recursos").insert({ os_id: osId, tipo: tipo as any, descricao: desc, quantidade: Number(qtd) || 1 });
    if (error) return toast.error(error.message);
    setDesc(""); setQtd("1"); onChange();
  };
  const del = async (id: string) => { await supabase.from("os_recursos").delete().eq("id", id); onChange(); };
  const byTipo = recursos.reduce((acc: any, r: any) => { (acc[r.tipo] ||= []).push(r); return acc; }, {});
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Recursos / Equipamentos / Veículos / Documentos / EPIs</div>
      <div className="flex gap-2">
        <Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(osRecursoTipoLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)} />
        <Input type="number" className="w-24" value={qtd} onChange={e => setQtd(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {Object.entries(byTipo).map(([t, arr]: any) => (
        <div key={t}>
          <div className="text-xs uppercase text-muted-foreground mt-2 mb-1">{osRecursoTipoLabel[t]}</div>
          <div className="space-y-1">
            {arr.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-1.5 rounded">
                <span className="flex-1">{r.descricao}</span><span className="font-mono text-xs">{r.quantidade}</span>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!recursos.length && <p className="text-sm text-muted-foreground">Nenhum recurso cadastrado.</p>}
    </CardContent></Card>
  );
}

function EquipeCard({ osId, equipe, profs, onChange }: any) {
  const [profId, setProfId] = useState("");
  const [papel, setPapel] = useState("apoio");
  const [conflitos, setConflitos] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const ids = equipe.map((e: any) => e.profissional_id);
      if (!ids.length) return setConflitos({});
      const { data: ev } = await supabase.from("os_eventos_agenda")
        .select("profissional_id").in("profissional_id", ids)
        .gte("start_at", new Date(Date.now() - 7 * 86400000).toISOString());
      const map: Record<string, number> = {};
      (ev || []).forEach((e: any) => { map[e.profissional_id] = (map[e.profissional_id] || 0) + 1; });
      setConflitos(map);
    })();
  }, [equipe]);

  const add = async () => {
    if (!profId) return;
    const { error } = await supabase.from("os_equipe").insert({ os_id: osId, profissional_id: profId, papel });
    if (error) return toast.error(error.message);
    setProfId(""); onChange();
  };
  const del = async (id: string) => { await supabase.from("os_equipe").delete().eq("id", id); onChange(); };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Equipe de apoio</div>
      <div className="flex gap-2">
        <Select value={profId} onValueChange={setProfId}><SelectTrigger className="flex-1"><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>{profs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}{p.cargo ? ` — ${p.cargo}` : ""}</SelectItem>)}</SelectContent></Select>
        <Select value={papel} onValueChange={setPapel}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="lider">Líder</SelectItem><SelectItem value="apoio">Apoio</SelectItem><SelectItem value="observador">Observador</SelectItem></SelectContent></Select>
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1">
        {equipe.map((e: any) => {
          const cnt = conflitos[e.profissional_id] || 0;
          return (
            <div key={e.id} className="flex items-center gap-3 text-sm bg-muted/40 px-3 py-2 rounded">
              <span className="flex-1">{e.execucao_profissionais?.nome} — <span className="text-muted-foreground">{e.papel}</span></span>
              {cnt > 1 && <Badge variant="secondary" className="bg-amber-100 text-amber-900">⚠ {cnt} eventos próximos</Badge>}
              <Button size="sm" variant="ghost" onClick={() => del(e.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          );
        })}
        {!equipe.length && <p className="text-sm text-muted-foreground">Sem equipe vinculada.</p>}
      </div>
    </CardContent></Card>
  );
}

function ChecklistCard({ osId, items, onChange }: any) {
  const [desc, setDesc] = useState("");
  const [obrig, setObrig] = useState(true);
  const add = async () => {
    if (!desc) return;
    const ord = (items[items.length - 1]?.ordem || 0) + 1;
    const { error } = await supabase.from("os_checklist").insert({ os_id: osId, descricao: desc, obrigatorio: obrig, ordem: ord });
    if (error) return toast.error(error.message);
    setDesc(""); onChange();
  };
  const toggle = async (it: any) => {
    await supabase.from("os_checklist").update({ concluido: !it.concluido, concluido_em: !it.concluido ? new Date().toISOString() : null }).eq("id", it.id);
    onChange();
  };
  const del = async (id: string) => { await supabase.from("os_checklist").delete().eq("id", id); onChange(); };
  const total = items.length, done = items.filter((i: any) => i.concluido).length;
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between"><div className="text-sm font-semibold">Checklist obrigatório</div><div className="text-sm text-muted-foreground">{done}/{total}</div></div>
      <Progress value={total ? (done / total) * 100 : 0} />
      <div className="flex gap-2">
        <Input placeholder="Item do checklist" value={desc} onChange={e => setDesc(e.target.value)} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={obrig} onChange={e => setObrig(e.target.checked)} />Obrigatório</label>
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1">
        {items.map((it: any) => (
          <div key={it.id} className={`flex items-center gap-2 px-3 py-2 rounded ${it.concluido ? "bg-emerald-50" : "bg-muted/30"}`}>
            <input type="checkbox" checked={it.concluido} onChange={() => toggle(it)} />
            <span className={`flex-1 text-sm ${it.concluido ? "line-through text-muted-foreground" : ""}`}>{it.descricao}</span>
            {it.obrigatorio && <Badge variant="secondary" className="text-xs">Obrig.</Badge>}
            <Button size="sm" variant="ghost" onClick={() => del(it.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
        {!items.length && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
      </div>
    </CardContent></Card>
  );
}

function VisitasCard({ osId, visitas, profs, projRespId, onChange }: any) {
  const [open, setOpen] = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);
  const defaultResp = () => (projRespId && profs.some((p: any) => p.id === projRespId) ? projRespId : "");
  const initial = () => ({ data: today(), hora_inicio: "08:00", hora_fim: "17:00", dia_inteiro: false, objetivo: "", local: "", responsavel_id: defaultResp() });
  const [v, setV] = useState<any>(initial());
  useEffect(() => { if (open) setV(initial()); /* eslint-disable-next-line */ }, [open, projRespId]);
  const add = async () => {
    if (!v.data) return toast.error("Informe a data");
    const payload = {
      os_id: osId,
      data: v.data,
      hora_inicio: v.dia_inteiro ? "00:00" : v.hora_inicio,
      hora_fim: v.dia_inteiro ? "23:59" : v.hora_fim,
      objetivo: v.objetivo,
      local: v.local,
      responsavel_id: v.responsavel_id || null,
    };
    const { error } = await supabase.from("os_visitas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Visita registrada"); setOpen(false); onChange();
  };
  const concluir = async (id: string) => {
    await supabase.from("os_visitas").update({ situacao: "realizada", concluida_em: new Date().toISOString() }).eq("id", id);
    onChange();
  };
  const del = async (id: string) => { await supabase.from("os_visitas").delete().eq("id", id); onChange(); };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Visitas técnicas</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova visita</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova visita</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data"><Input type="date" value={v.data} onChange={e => setV({ ...v, data: e.target.value })} /></Field>
              <Field label="Responsável">
                <Select value={v.responsavel_id} onValueChange={x => setV({ ...v, responsavel_id: x })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{profs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="col-span-2 flex items-center gap-2">
                <input id="dia-inteiro" type="checkbox" className="h-4 w-4" checked={!!v.dia_inteiro} onChange={e => setV({ ...v, dia_inteiro: e.target.checked })} />
                <label htmlFor="dia-inteiro" className="text-sm cursor-pointer select-none">Dia inteiro</label>
              </div>
              {!v.dia_inteiro && <Field label="Hora início"><Input type="time" value={v.hora_inicio} onChange={e => setV({ ...v, hora_inicio: e.target.value })} /></Field>}
              {!v.dia_inteiro && <Field label="Hora fim"><Input type="time" value={v.hora_fim} onChange={e => setV({ ...v, hora_fim: e.target.value })} /></Field>}
              <Field label="Local"><Input value={v.local} onChange={e => setV({ ...v, local: e.target.value })} /></Field>
              <div className="col-span-2"><Field label="Objetivo"><Textarea value={v.objetivo} onChange={e => setV({ ...v, objetivo: e.target.value })} /></Field></div>
            </div>
            <DialogFooter><Button onClick={add}>Salvar visita</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Responsável</TableHead><TableHead>Objetivo</TableHead><TableHead>Situação</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {visitas.map((vi: any) => (
            <TableRow key={vi.id}>
              <TableCell>{formatDate(vi.data)}</TableCell>
              <TableCell className="font-mono text-xs">{vi.hora_inicio?.slice(0, 5)}–{vi.hora_fim?.slice(0, 5)}</TableCell>
              <TableCell>{vi.execucao_profissionais?.nome || "—"}</TableCell>
              <TableCell className="text-sm">{vi.objetivo || "—"}</TableCell>
              <TableCell><Badge variant="secondary">{osVisitaSituacaoLabel[vi.situacao]}</Badge></TableCell>
              <TableCell className="flex gap-1">
                {vi.situacao !== "realizada" && <Button size="sm" variant="ghost" onClick={() => concluir(vi.id)}><CheckCircle2 className="h-4 w-4" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => del(vi.id)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {!visitas.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma visita registrada.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function LogisticaCard({ osId, logistica, onChange }: any) {
  const [f, setF] = useState<any>(logistica || {});
  useEffect(() => setF(logistica || {}), [logistica]);
  const save = async () => {
    const payload = { ...f, os_id: osId };
    if (logistica?.id) {
      const { error } = await supabase.from("os_logistica").update(payload).eq("id", logistica.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("os_logistica").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Logística salva"); onChange();
  };
  const fld = (k: string, label: string, type = "text") =>
    <Field label={label}><Input type={type} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })} /></Field>;
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Logística e deslocamento</div>
      <div className="grid md:grid-cols-3 gap-3">
        {fld("cidade", "Cidade")}{fld("endereco", "Endereço")}{fld("veiculo", "Veículo")}
        {fld("distancia_km", "Distância (km)", "number")}{fld("tempo_estimado_min", "Tempo estimado (min)", "number")}{fld("motorista", "Motorista")}
        {fld("hospedagem", "Hospedagem")}{fld("alimentacao", "Alimentação")}
        {fld("pedagios", "Pedágios (R$)", "number")}{fld("combustivel", "Combustível (R$)", "number")}
      </div>
      <Field label="Observações"><Textarea value={f.observacoes ?? ""} onChange={e => setF({ ...f, observacoes: e.target.value })} /></Field>
      <Button onClick={save}><Save className="h-4 w-4 mr-2" />Salvar logística</Button>
    </CardContent></Card>
  );
}

function DocumentosCard({ osId, documentos, onChange }: any) {
  const [cat, setCat] = useState("pendente");
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const add = async () => {
    if (!nome) return;
    let path: string | null = null;
    if (file) {
      const p = `${osId}/${Date.now()}-${file.name}`;
      const { error: e } = await supabase.storage.from("os-documentos").upload(p, file);
      if (e) return toast.error(e.message);
      path = p;
    }
    const { error } = await supabase.from("os_documentos").insert({ os_id: osId, categoria: cat as any, nome, anexo_path: path });
    if (error) return toast.error(error.message);
    setNome(""); setFile(null); onChange();
  };
  const download = async (d: any) => {
    if (!d.anexo_path) return;
    const { data } = await supabase.storage.from("os-documentos").createSignedUrl(d.anexo_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const del = async (d: any) => {
    if (d.anexo_path) await supabase.storage.from("os-documentos").remove([d.anexo_path]);
    await supabase.from("os_documentos").delete().eq("id", d.id); onChange();
  };
  const byCat = documentos.reduce((a: any, d: any) => { (a[d.categoria] ||= []).push(d); return a; }, {});
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Documentos</div>
      <div className="flex flex-wrap gap-2">
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(osDocCategoriaLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Nome do documento" value={nome} onChange={e => setNome(e.target.value)} className="flex-1 min-w-[200px]" />
        <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-auto" />
        <Button onClick={add}><Upload className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>
      {["recebido", "gerado", "pendente"].map(k => (
        <div key={k}>
          <div className="text-xs uppercase text-muted-foreground mt-2 mb-1">{osDocCategoriaLabel[k]}</div>
          {(byCat[k] || []).map((d: any) => (
            <div key={d.id} className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-2 rounded">
              <span className="flex-1">{d.nome}</span>
              {d.anexo_path && <Button size="sm" variant="ghost" onClick={() => download(d)}>Baixar</Button>}
              <Button size="sm" variant="ghost" onClick={() => del(d)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {!(byCat[k] || []).length && <p className="text-xs text-muted-foreground">—</p>}
        </div>
      ))}
    </CardContent></Card>
  );
}

function EvidenciasCard({ osId, evidencias, visitas, onChange }: any) {
  const [tipo, setTipo] = useState("foto");
  const [visitaId, setVisitaId] = useState("");
  const [legenda, setLegenda] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const e of evidencias) {
        if (e.arquivo_path) {
          const { data } = await supabase.storage.from("os-evidencias").createSignedUrl(e.arquivo_path, 600);
          if (data?.signedUrl) map[e.id] = data.signedUrl;
        }
      }
      setUrls(map);
    })();
  }, [evidencias]);

  const add = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    const p = `${osId}/${Date.now()}-${file.name}`;
    const { error: e1 } = await supabase.storage.from("os-evidencias").upload(p, file);
    if (e1) return toast.error(e1.message);
    const { error } = await supabase.from("os_evidencias").insert({
      os_id: osId, visita_id: visitaId || null, tipo: tipo as any, arquivo_path: p, legenda, tamanho_bytes: file.size,
    });
    if (error) return toast.error(error.message);
    setFile(null); setLegenda(""); onChange();
  };
  const del = async (e: any) => {
    if (e.arquivo_path) await supabase.storage.from("os-evidencias").remove([e.arquivo_path]);
    await supabase.from("os_evidencias").delete().eq("id", e.id); onChange();
  };

  const grupos = evidencias.reduce((acc: any, e: any) => {
    const k = e.visita_id || "sem_visita"; (acc[k] ||= []).push(e); return acc;
  }, {});

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Galeria de evidências</div>
      <div className="flex flex-wrap gap-2">
        <Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(osEvidenciaTipoLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={visitaId || "_none"} onValueChange={v => setVisitaId(v === "_none" ? "" : v)}><SelectTrigger className="w-56"><SelectValue placeholder="Visita (opcional)" /></SelectTrigger>
          <SelectContent><SelectItem value="_none">Sem visita</SelectItem>{visitas.map((v: any) => <SelectItem key={v.id} value={v.id}>{formatDate(v.data)} — {v.objetivo || "Visita"}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Legenda" value={legenda} onChange={e => setLegenda(e.target.value)} className="flex-1 min-w-[200px]" />
        <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-auto" />
        <Button onClick={add}><Upload className="h-4 w-4 mr-1" />Enviar</Button>
      </div>
      {Object.entries(grupos).map(([k, arr]: any) => {
        const visita = visitas.find((v: any) => v.id === k);
        return (
          <div key={k}>
            <div className="text-xs uppercase text-muted-foreground mt-3 mb-2">{visita ? `Visita ${formatDate(visita.data)} — ${visita.objetivo || ""}` : "Sem visita vinculada"}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {arr.map((e: any) => (
                <div key={e.id} className="border rounded-lg overflow-hidden bg-card">
                  {e.tipo === "foto" && urls[e.id]
                    ? <img src={urls[e.id]} alt={e.legenda || ""} className="w-full h-32 object-cover" />
                    : <div className="w-full h-32 bg-muted flex items-center justify-center text-3xl">{e.tipo === "video" ? "🎬" : e.tipo === "audio" ? "🎙️" : e.tipo === "pdf" ? "📄" : "📎"}</div>}
                  <div className="p-2 flex items-center gap-2">
                    <div className="text-xs flex-1 truncate">{e.legenda || osEvidenciaTipoLabel[e.tipo]}</div>
                    {urls[e.id] && <a href={urls[e.id]} target="_blank" rel="noreferrer" className="text-xs underline">abrir</a>}
                    <Button size="sm" variant="ghost" onClick={() => del(e)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {!evidencias.length && <p className="text-sm text-muted-foreground">Nenhuma evidência ainda.</p>}
    </CardContent></Card>
  );
}