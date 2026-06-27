import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  brl, execucaoStatusLabel, execucaoStatusColor, prioridadeLabel, prioridadeColor,
  prazoStatus, formatDate, formatDateTime, checklistSituacaoLabel,
} from "@/lib/format";
import {
  ArrowLeft, Save, Plus, Trash2, FileText, UserCog, Users as UsersIcon,
  ClipboardCheck, MessageSquare, Paperclip, History, ListTree, Upload, Download,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

type Exec = any;

export default function ExecucaoEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exec, setExec] = useState<Exec | null>(null);
  const [profs, setProfs] = useState<any[]>([]);
  const [equipe, setEquipe] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [obs, setObs] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [anexos, setAnexos] = useState<any[]>([]);

  const reload = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("execucao_servicos")
      .select("*, clients(*), proposals(numero, titulo), execucao_profissionais!execucao_servicos_responsavel_tecnico_id_fkey(*)")
      .eq("id", id).maybeSingle();
    if (error) return toast.error(error.message);
    setExec(data);
    const [p, e, c, o, t, h, a] = await Promise.all([
      supabase.from("execucao_profissionais").select("*").order("nome"),
      supabase.from("execucao_servico_equipe").select("*, execucao_profissionais(*)").eq("execucao_id", id),
      supabase.from("execucao_checklists").select("*, execucao_profissionais(nome)").eq("execucao_id", id).order("ordem").order("created_at"),
      supabase.from("execucao_observacoes").select("*").eq("execucao_id", id).order("created_at", { ascending: false }),
      supabase.from("execucao_timeline").select("*").eq("execucao_id", id).order("created_at", { ascending: false }),
      supabase.from("execucao_historico").select("*").eq("execucao_id", id).order("created_at", { ascending: false }),
      supabase.from("execucao_anexos").select("*").eq("execucao_id", id).order("created_at", { ascending: false }),
    ]);
    setProfs((p.data as any) || []);
    setEquipe((e.data as any) || []);
    setChecklist((c.data as any) || []);
    setObs((o.data as any) || []);
    setTimeline((t.data as any) || []);
    setHistorico((h.data as any) || []);
    setAnexos((a.data as any) || []);
  };
  useEffect(() => { reload(); }, [id]);

  if (!exec) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  const prazo = prazoStatus(exec.data_prevista_conclusao, exec.status);

  const saveCampos = async (patch: any) => {
    const { error } = await supabase.from("execucao_servicos").update(patch).eq("id", exec.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    reload();
  };

  return (
    <>
      <PageHeader
        title={`${exec.numero_interno} — ${exec.titulo}`}
        subtitle={exec.clients?.nome_fantasia || exec.clients?.razao_social}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/execucao"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link></Button>
            <Button variant="outline" asChild><Link to={`/propostas/${exec.proposal_id}`}><FileText className="h-4 w-4 mr-2" />Proposta {exec.proposals?.numero}</Link></Button>
          </>
        }
      />
      <div className="p-6 space-y-4">
        {/* Resumo topo */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Mini label="Status"><Badge className={execucaoStatusColor[exec.status]} variant="secondary">{execucaoStatusLabel[exec.status]}</Badge></Mini>
          <Mini label="Prioridade"><Badge className={prioridadeColor[exec.prioridade]} variant="secondary">{prioridadeLabel[exec.prioridade]}</Badge></Mini>
          <Mini label="Responsável">{exec.execucao_profissionais?.nome || "—"}</Mini>
          <Mini label="Aprovado em">{formatDate(exec.data_aprovacao)}</Mini>
          <Mini label="Prazo"><span className={prazo.cor}>{prazo.emoji} {prazo.label}</span></Mini>
          <Mini label="Valor">{brl(exec.valor_contratado)}</Mini>
        </div>

        <Tabs defaultValue="geral">
          <TabsList className="flex-wrap">
            <TabsTrigger value="geral"><UserCog className="h-4 w-4 mr-1" />Visão geral</TabsTrigger>
            <TabsTrigger value="equipe"><UsersIcon className="h-4 w-4 mr-1" />Equipe</TabsTrigger>
            <TabsTrigger value="checklist"><ClipboardCheck className="h-4 w-4 mr-1" />Checklist</TabsTrigger>
            <TabsTrigger value="obs"><MessageSquare className="h-4 w-4 mr-1" />Observações</TabsTrigger>
            <TabsTrigger value="anexos"><Paperclip className="h-4 w-4 mr-1" />Anexos</TabsTrigger>
            <TabsTrigger value="timeline"><ListTree className="h-4 w-4 mr-1" />Timeline</TabsTrigger>
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          {/* GERAL */}
          <TabsContent value="geral" className="space-y-4">
            <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={exec.status} onValueChange={(v) => saveCampos({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(execucaoStatusLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={exec.prioridade} onValueChange={(v) => saveCampos({ prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(prioridadeLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável técnico</Label>
                <Select value={exec.responsavel_tecnico_id || "none"} onValueChange={(v) => saveCampos({ responsavel_tecnico_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem responsável —</SelectItem>
                    {profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}{p.cargo ? ` · ${p.cargo}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cidade</Label><Input defaultValue={exec.cidade || ""} onBlur={(e) => e.target.value !== (exec.cidade || "") && saveCampos({ cidade: e.target.value || null })} /></div>
              <div><Label>Quantidade</Label><Input type="number" step="0.01" defaultValue={exec.quantidade} onBlur={(e) => Number(e.target.value) !== Number(exec.quantidade) && saveCampos({ quantidade: Number(e.target.value) })} /></div>
              <div><Label>Unidade</Label><Input defaultValue={exec.unidade || ""} onBlur={(e) => e.target.value !== (exec.unidade || "") && saveCampos({ unidade: e.target.value || null })} /></div>
              <div><Label>Data prevista de início</Label><Input type="date" defaultValue={exec.data_prevista_inicio || ""} onBlur={(e) => saveCampos({ data_prevista_inicio: e.target.value || null })} /></div>
              <div><Label>Data prevista de conclusão</Label><Input type="date" defaultValue={exec.data_prevista_conclusao || ""} onBlur={(e) => saveCampos({ data_prevista_conclusao: e.target.value || null })} /></div>
              <div><Label>Data real de conclusão</Label><Input type="date" defaultValue={exec.data_real_conclusao || ""} onBlur={(e) => saveCampos({ data_real_conclusao: e.target.value || null })} /></div>
              <div className="md:col-span-3"><Label>Descrição comercial</Label><Textarea defaultValue={exec.descricao || ""} onBlur={(e) => e.target.value !== (exec.descricao || "") && saveCampos({ descricao: e.target.value || null })} /></div>
              <div className="md:col-span-3"><Label>Escopo técnico</Label><Textarea rows={4} defaultValue={exec.escopo_tecnico || ""} onBlur={(e) => e.target.value !== (exec.escopo_tecnico || "") && saveCampos({ escopo_tecnico: e.target.value || null })} /></div>
              <div className="md:col-span-3 flex items-center gap-3 border-t pt-3 mt-2">
                <Switch checked={!!exec.visivel_cliente} onCheckedChange={(v) => saveCampos({ visivel_cliente: v })} />
                <div>
                  <div className="text-sm font-medium">Visível para o cliente (Portal do Cliente)</div>
                  <div className="text-xs text-muted-foreground">Quando ativo, será exposto no futuro Portal do Cliente.</div>
                </div>
              </div>
              <div className="md:col-span-3"><Label>Resumo para o cliente</Label><Textarea rows={2} defaultValue={exec.resumo_cliente || ""} onBlur={(e) => e.target.value !== (exec.resumo_cliente || "") && saveCampos({ resumo_cliente: e.target.value || null })} /></div>
            </CardContent></Card>
          </TabsContent>

          {/* EQUIPE */}
          <TabsContent value="equipe">
            <EquipeTab equipe={equipe} profs={profs} execId={exec.id} resp={exec.execucao_profissionais} onChange={reload} />
          </TabsContent>

          {/* CHECKLIST */}
          <TabsContent value="checklist">
            <ChecklistTab items={checklist} profs={profs} execId={exec.id} onChange={reload} />
          </TabsContent>

          {/* OBSERVAÇÕES */}
          <TabsContent value="obs">
            <ObsTab items={obs} execId={exec.id} userId={user?.id} userEmail={user?.email} onChange={reload} />
          </TabsContent>

          {/* ANEXOS */}
          <TabsContent value="anexos">
            <AnexosTab items={anexos} execId={exec.id} userId={user?.id} onChange={reload} />
          </TabsContent>

          {/* TIMELINE */}
          <TabsContent value="timeline">
            <Card><CardContent className="p-4">
              <ol className="relative border-l border-border pl-5 space-y-4">
                {timeline.map(t => (
                  <li key={t.id} className="relative">
                    <div className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-primary" />
                    <div className="text-sm font-medium">{t.evento}</div>
                    {t.detalhe && <div className="text-sm text-muted-foreground">{t.detalhe}</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(t.created_at)}</div>
                  </li>
                ))}
                {!timeline.length && <li className="text-sm text-muted-foreground">Sem eventos registrados.</li>}
              </ol>
            </CardContent></Card>
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Quando</TableHead><TableHead>Ação</TableHead><TableHead>Campo</TableHead>
                  <TableHead>De</TableHead><TableHead>Para</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {historico.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">{formatDateTime(h.created_at)}</TableCell>
                      <TableCell>{h.acao}</TableCell>
                      <TableCell className="text-xs">{h.campo || "—"}</TableCell>
                      <TableCell className="text-xs">{h.valor_anterior || "—"}</TableCell>
                      <TableCell className="text-xs">{h.valor_novo || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!historico.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem alterações registradas.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Mini({ label, children }: any) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </CardContent></Card>
  );
}

// ============================================================
// EQUIPE
// ============================================================
function EquipeTab({ equipe, profs, execId, resp, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [profId, setProfId] = useState<string>("");
  const [papel, setPapel] = useState("");
  const add = async () => {
    if (!profId) return toast.error("Selecione um profissional");
    const { error } = await supabase.from("execucao_servico_equipe").insert({ execucao_id: execId, profissional_id: profId, papel: papel || null });
    if (error) return toast.error(error.message);
    setOpen(false); setProfId(""); setPapel(""); onChange();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("execucao_servico_equipe").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };
  return (
    <Card><CardContent className="p-4 space-y-4">
      {resp && (
        <div className="rounded-md border p-3 bg-muted/40">
          <div className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Responsável técnico</div>
          <div className="font-semibold">{resp.nome}</div>
          <div className="text-xs text-muted-foreground">{[resp.cargo, resp.area, resp.especialidade].filter(Boolean).join(" · ") || "—"}</div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="font-semibold">Equipe de apoio</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Adicionar</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar à equipe</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Profissional</Label>
                <Select value={profId} onValueChange={setProfId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{profs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Papel na equipe</Label><Input value={papel} onChange={(e) => setPapel(e.target.value)} placeholder="ex.: Apoio técnico" /></div>
            </div>
            <DialogFooter><Button onClick={add}>Incluir</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Área</TableHead><TableHead>Papel</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {equipe.map((e: any) => (
            <TableRow key={e.id}>
              <TableCell>{e.execucao_profissionais?.nome}</TableCell>
              <TableCell>{e.execucao_profissionais?.cargo || "—"}</TableCell>
              <TableCell>{e.execucao_profissionais?.area || "—"}</TableCell>
              <TableCell>{e.papel || "—"}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
          {!equipe.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum membro de apoio.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

// ============================================================
// CHECKLIST
// ============================================================
function ChecklistTab({ items, profs, execId, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<any>({ situacao: "pendente" });
  const total = items.length;
  const ok = items.filter((i: any) => i.situacao === "concluido").length;
  const perc = total ? Math.round((ok / total) * 100) : 0;

  const add = async () => {
    if (!novo.descricao?.trim()) return toast.error("Informe a descrição");
    const payload: any = {
      execucao_id: execId,
      descricao: novo.descricao,
      responsavel_id: novo.responsavel_id || null,
      data_prevista: novo.data_prevista || null,
      situacao: novo.situacao,
      ordem: items.length,
    };
    const { error } = await supabase.from("execucao_checklists").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setNovo({ situacao: "pendente" }); onChange();
  };
  const upd = async (id: string, patch: any) => {
    if (patch.situacao === "concluido" && !patch.data_realizada) patch.data_realizada = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("execucao_checklists").update(patch).eq("id", id);
    if (error) return toast.error(error.message); onChange();
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("execucao_checklists").delete().eq("id", id);
    if (error) return toast.error(error.message); onChange();
  };
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium mb-1">Progresso: {ok}/{total} ({perc}%)</div>
          <Progress value={perc} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo item</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Item do checklist</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Descrição</Label><Input value={novo.descricao || ""} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></div>
              <div>
                <Label>Responsável</Label>
                <Select value={novo.responsavel_id || "none"} onValueChange={(v) => setNovo({ ...novo, responsavel_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem responsável —</SelectItem>
                    {profs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data prevista</Label><Input type="date" value={novo.data_prevista || ""} onChange={(e) => setNovo({ ...novo, data_prevista: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={add}>Incluir</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Descrição</TableHead><TableHead>Responsável</TableHead>
          <TableHead>Prevista</TableHead><TableHead>Realizada</TableHead>
          <TableHead>Situação</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{i.descricao}</TableCell>
              <TableCell>{i.execucao_profissionais?.nome || "—"}</TableCell>
              <TableCell>{formatDate(i.data_prevista)}</TableCell>
              <TableCell>{formatDate(i.data_realizada)}</TableCell>
              <TableCell>
                <Select value={i.situacao} onValueChange={(v) => upd(i.id, { situacao: v })}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(checklistSituacaoLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => del(i.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
          {!items.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nenhum item no checklist.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

// ============================================================
// OBSERVAÇÕES
// ============================================================
function ObsTab({ items, execId, userId, userEmail, onChange }: any) {
  const [texto, setTexto] = useState("");
  const add = async () => {
    if (!texto.trim()) return;
    const { error } = await supabase.from("execucao_observacoes").insert({ execucao_id: execId, texto, user_id: userId });
    if (error) return toast.error(error.message);
    setTexto(""); onChange();
  };
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
        Observações técnicas são <strong>internas</strong> — nunca aparecem para o cliente.
      </div>
      <div className="flex flex-col gap-2">
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva uma observação técnica..." />
        <div className="flex justify-end"><Button size="sm" onClick={add}><Save className="h-4 w-4 mr-1" />Registrar</Button></div>
      </div>
      <div className="space-y-3">
        {items.map((o: any) => (
          <div key={o.id} className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground mb-1">{formatDateTime(o.created_at)} {o.user_id === userId ? `· ${userEmail}` : ""}</div>
            <div className="text-sm whitespace-pre-wrap">{o.texto}</div>
          </div>
        ))}
        {!items.length && <div className="text-sm text-muted-foreground">Sem observações.</div>}
      </div>
    </CardContent></Card>
  );
}

// ============================================================
// ANEXOS
// ============================================================
function AnexosTab({ items, execId, userId, onChange }: any) {
  const upload = async (file: File) => {
    const path = `${execId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("execucao-anexos").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error } = await supabase.from("execucao_anexos").insert({
      execucao_id: execId, nome_arquivo: file.name, storage_path: path,
      mime_type: file.type, tamanho_bytes: file.size, user_id: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Arquivo enviado"); onChange();
  };
  const baixar = async (a: any) => {
    const { data, error } = await supabase.storage.from("execucao-anexos").createSignedUrl(a.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };
  const del = async (a: any) => {
    await supabase.storage.from("execucao-anexos").remove([a.storage_path]);
    await supabase.from("execucao_anexos").delete().eq("id", a.id);
    onChange();
  };
  return (
    <Card><CardContent className="p-4 space-y-4">
      <label className="flex items-center justify-center border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/40">
        <Upload className="h-5 w-5 mr-2" />
        <span className="text-sm">Selecionar arquivo (PDF, Word, Excel, imagem, ZIP)</span>
        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.webp"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
      </label>
      <Table>
        <TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Tipo</TableHead><TableHead>Tamanho</TableHead><TableHead>Enviado em</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((a: any) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.nome_arquivo}</TableCell>
              <TableCell className="text-xs">{a.mime_type || "—"}</TableCell>
              <TableCell className="text-xs">{a.tamanho_bytes ? `${(a.tamanho_bytes / 1024).toFixed(1)} KB` : "—"}</TableCell>
              <TableCell className="text-xs">{formatDateTime(a.created_at)}</TableCell>
              <TableCell className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => baixar(a)}><Download className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(a)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {!items.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum anexo.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}