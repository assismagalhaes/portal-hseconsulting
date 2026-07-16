import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PercentInput } from "@/components/ui/percent-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Printer, QrCode, MapPin, ClipboardCheck, Camera, History, Eye } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { osStatusLabel, osStatusColor, osPrioridadeLabel, osPrioridadeColor } from "@/lib/os";
import { KV } from "@/components/os/atoms";
import { ChecklistCard } from "@/components/os/ChecklistCard";
import { VisitasCard } from "@/components/os/VisitasCard";
import { EvidenciasCard } from "@/components/os/EvidenciasCard";

// Re-exports (compat com imports antigos, ex.: AtividadePainel)
export { ChecklistCard } from "@/components/os/ChecklistCard";
export { VisitasCard } from "@/components/os/VisitasCard";
export { EvidenciasCard } from "@/components/os/EvidenciasCard";

export default function OrdemServicoEditor({ id: idProp, embedded }: { id?: string; embedded?: boolean } = {}) {
  const params = useParams();
  const id = idProp ?? params.id;
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
      .select("*, clients(*), execucao_servicos(numero_interno, titulo), services(nome), projetos(id, numero, titulo, responsavel_execucao_id, data_inicio, data_fim_prevista, data_fim_real, projeto_servicos(nome)), execucao_profissionais!ordens_servico_responsavel_tecnico_id_fkey(*)")
      .eq("id", id).maybeSingle();
    if (error) return toast.error(error.message);
    // Herda datas do projeto quando ainda não estão preenchidas na OS
    let osData: any = data;
    if (osData?.projetos) {
      const patch: any = {};
      if (!osData.data_prevista_inicio && osData.projetos.data_inicio) {
        patch.data_prevista_inicio = osData.projetos.data_inicio;
      }
      if (!osData.data_prevista_conclusao && osData.projetos.data_fim_prevista) {
        patch.data_prevista_conclusao = osData.projetos.data_fim_prevista;
      }
      if (Object.keys(patch).length) {
        const { error: upErr } = await supabase.from("ordens_servico").update(patch).eq("id", osData.id);
        if (!upErr) osData = { ...osData, ...patch };
      }
    }
    setOs(osData);
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
      supabase.from("os_visitas").select("*").eq("os_id", id).order("data").order("hora_inicio"),
      supabase.from("os_logistica").select("*").eq("os_id", id).maybeSingle(),
      supabase.from("os_documentos").select("*").eq("os_id", id).order("created_at", { ascending: false }),
      supabase.from("os_evidencias").select("*").eq("os_id", id).order("created_at", { ascending: false }),
      supabase.from("os_timeline").select("*").eq("os_id", id).order("created_at", { ascending: false }),
    ]);
    // Combina profissionais do cadastro (execucao_profissionais) com usuários
    // internos que têm papel técnico/admin/coordenador — assim ambos podem ser
    // escolhidos como responsáveis por uma visita técnica.
    const execList = ((pp.data as any) || []).map((p: any) => ({
      id: p.id, nome: p.nome, cargo: p.cargo || null, source: "prof" as const,
    }));
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "tecnico", "comercial"] as any);
    const userIds = Array.from(new Set((roles || []).map((r: any) => r.user_id))) as string[];
    let usersList: any[] = [];
    if (userIds.length) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      usersList = (pr || []).map((u: any) => ({
        id: u.id, nome: u.nome || u.email, cargo: null, source: "user" as const,
      }));
    }
    // Dedup por id (execucao_profissionais tem prioridade quando coincidir).
    const seen = new Set<string>();
    const combined = [...execList, ...usersList].filter((x) => {
      if (seen.has(x.id)) return false; seen.add(x.id); return true;
    }).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    setProfs(combined); setEquipe((eq.data as any) || []);
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
      {!embedded && (
        <PageHeader title={`${os.numero} — ${os.titulo}`} subtitle={os.projetos ? `Projeto ${os.projetos.numero} • ${os.projetos.titulo}` : os.execucao_servicos ? `Execução ${os.execucao_servicos.numero_interno} • ${os.execucao_servicos.titulo}` : undefined}
          actions={
            <>
              {os.projetos && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/projetos/${os.projetos.id}`)}><ArrowLeft className="h-4 w-4 mr-2" />Ver projeto</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => window.open(`/ordens-servico/${os.id}/imprimir`, "_blank")}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
            </>
          } />
      )}

      <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
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
