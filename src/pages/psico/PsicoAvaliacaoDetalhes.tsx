import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Ban, Pencil, Save, X, Link2 } from "lucide-react";
import { statusColor, statusLabel, vincularVersaoVigente, getVersaoVigente } from "@/lib/psico";
import { formatDate, formatDateTime } from "@/lib/format";
import PsicoParticipantes from "@/components/psico/PsicoParticipantes";
import PsicoColetaTab from "@/components/psico/PsicoColetaTab";
import PsicoResultadosTab from "@/components/psico/PsicoResultadosTab";
import PsicoRevisaoTab from "@/components/psico/PsicoRevisaoTab";
import PsicoPlanoTab from "@/components/psico/PsicoPlanoTab";
import PsicoRelatorioTab from "@/components/psico/PsicoRelatorioTab";

const BASE = "/operacoes/avaliacao-fatores-psicossociais";

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

export default function PsicoAvaliacaoDetalhes() {
  const { id } = useParams();
  const nav = useNavigate();
  const [av, setAv] = useState<any>(null);
  const [cli, setCli] = useState<any>(null);
  const [resp, setResp] = useState<any>(null);
  const [metod, setMetod] = useState<any>(null);
  const [quest, setQuest] = useState<any>(null);
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [motivo, setMotivo] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [vigente, setVigente] = useState<any>(null);

  useEffect(() => { document.title = "Avaliação Psicossocial | Portal HSE"; load(); }, [id]);

  async function load() {
    const { data } = await supabase.from("psico_avaliacoes").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    setAv(data);
    setForm(data);
    const revsQ = await (supabase as any).from("psico_revisoes_tecnicas").select("id").eq("avaliacao_id", id!);
    const revIds: string[] = (revsQ.data || []).map((x: any) => x.id);
    const planosQ = revIds.length
      ? await (supabase as any).from("psico_planos_acao").select("id").in("revisao_id", revIds)
      : { data: [] as any[] };
    const planoIds: string[] = (planosQ.data || []).map((x: any) => x.id);
    const relQ = await (supabase as any).from("psico_relatorios").select("id").eq("avaliacao_id", id!).maybeSingle();
    const relVersoesIds: string[] = [];
    if (relQ.data?.id) {
      const vs = await (supabase as any).from("psico_relatorios_versoes").select("id").eq("relatorio_id", relQ.data.id);
      (vs.data || []).forEach((x: any) => relVersoesIds.push(x.id));
    }
    const auditQuery = supabase.from("psico_auditoria").select("*")
      .or([
        `and(entidade.eq.avaliacao,entidade_id.eq.${id})`,
        revIds.length ? `and(entidade.eq.revisao_tecnica,entidade_id.in.(${revIds.join(",")}))` : null,
        planoIds.length ? `and(entidade.eq.plano_acao,entidade_id.in.(${planoIds.join(",")}))` : null,
        relVersoesIds.length ? `and(entidade.eq.relatorio_versao,entidade_id.in.(${relVersoesIds.join(",")}))` : null,
      ].filter(Boolean).join(","))
      .order("created_at", { ascending: false });
    const [c, r, m, q, aud] = await Promise.all([
      supabase.from("clients").select("id, razao_social, nome_fantasia, cidade, uf").eq("id", data.cliente_id).maybeSingle(),
      data.responsavel_hse_id ? supabase.from("profiles").select("id, nome, email").eq("id", data.responsavel_hse_id).maybeSingle() : Promise.resolve({ data: null }),
      data.metodologia_versao_id ? supabase.from("psico_metodologias_versoes").select("codigo, nome, versao").eq("id", data.metodologia_versao_id).maybeSingle() : Promise.resolve({ data: null }),
      data.questionario_versao_id ? supabase.from("psico_questionarios_versoes").select("codigo, nome, versao").eq("id", data.questionario_versao_id).maybeSingle() : Promise.resolve({ data: null }),
      auditQuery,
    ]);
    setCli(c.data); setResp(r.data); setMetod(m.data); setQuest(q.data); setAuditoria(aud.data || []);
    const { data: v } = await getVersaoVigente();
    setVigente(v);
  }

  async function salvarEdicao() {
    if (!form.titulo?.trim()) return toast.error("Título é obrigatório");
    if (form.data_fim_prevista && form.data_inicio_prevista && form.data_fim_prevista < form.data_inicio_prevista) return toast.error("Data final anterior à inicial");
    if (Number(form.quantidade_participantes_prevista) < 1) return toast.error("Mínimo 1 participante");
    const { error } = await supabase.from("psico_avaliacoes").update({
      titulo: form.titulo,
      unidade: form.unidade || "Geral",
      data_inicio_prevista: form.data_inicio_prevista || null,
      data_fim_prevista: form.data_fim_prevista || null,
      quantidade_participantes_prevista: Number(form.quantidade_participantes_prevista) || 1,
      responsavel_hse_id: form.responsavel_hse_id,
      observacoes_internas: form.observacoes_internas || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Avaliação atualizada");
    setEditing(false); load();
  }

  async function cancelar() {
    if (!motivo.trim()) return toast.error("Informe o motivo do cancelamento");
    const { error } = await supabase.from("psico_avaliacoes").update({
      status: "cancelada",
      motivo_cancelamento: motivo,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Avaliação cancelada");
    setCancelOpen(false); setMotivo(""); load();
  }

  if (!av) {
    return <div className="p-8 text-muted-foreground">Carregando…</div>;
  }

  const podeEditar = av.status === "rascunho";
  const podeCancelar = av.status !== "cancelada" && av.status !== "relatorio_emitido";
  const clienteNome = cli?.nome_fantasia || cli?.razao_social || "—";

  return (
    <div>
      <PageHeader
        title={av.titulo}
        subtitle={<span className="flex items-center gap-2"><span className="font-mono text-xs">{av.codigo}</span> · {clienteNome}</span> as any}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to={`${BASE}/avaliacoes`}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link></Button>
            {podeEditar && !editing && (
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-2" /> Editar</Button>
            )}
            {podeCancelar && (
              <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive"><Ban className="h-4 w-4 mr-2" /> Cancelar avaliação</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar avaliação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação registra o cancelamento no histórico. A avaliação permanecerá visível como cancelada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <Label>Motivo do cancelamento *</Label>
                    <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); cancelar(); }}>Confirmar cancelamento</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Badge className={statusColor(av.status)}>{statusLabel(av.status)}</Badge>
          {av.status === "cancelada" && av.motivo_cancelamento && (
            <span className="text-sm text-muted-foreground">Motivo: {av.motivo_cancelamento}</span>
          )}
        </div>

        {av.status === "rascunho" && !av.questionario_versao_id && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
            <CardContent className="py-4 flex items-center justify-between gap-3 text-sm">
              {vigente ? (
                <>
                  <span>Esta avaliação ainda não possui uma versão de questionário vinculada.</span>
                  <Button size="sm" onClick={async () => {
                    const { error } = await vincularVersaoVigente(id!);
                    if (error) return toast.error(error.message);
                    toast.success("Versão vigente vinculada"); load();
                  }}>
                    <Link2 className="h-4 w-4 mr-2" /> Vincular versão vigente
                  </Button>
                </>
              ) : (
                <>
                  <span>Nenhuma versão de questionário publicada ainda. Publique uma versão em Configurações antes de vincular.</span>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`${BASE}?tab=config`}>Ir para Configurações</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="py-4"><Field label="Cliente" value={clienteNome} /></CardContent></Card>
          <Card><CardContent className="py-4"><Field label="Unidade" value={av.unidade} /></CardContent></Card>
          <Card><CardContent className="py-4"><Field label="Período previsto" value={`${av.data_inicio_prevista ? formatDate(av.data_inicio_prevista) : "—"} → ${av.data_fim_prevista ? formatDate(av.data_fim_prevista) : "—"}`} /></CardContent></Card>
          <Card><CardContent className="py-4"><Field label="Participantes previstos" value={av.quantidade_participantes_prevista} /></CardContent></Card>
          <Card><CardContent className="py-4"><Field label="Responsável HSE" value={resp?.nome || resp?.email || "—"} /></CardContent></Card>
          <Card><CardContent className="py-4"><Field label="Questionário" value={quest ? `${quest.codigo} v${quest.versao}` : "—"} /></CardContent></Card>
          <Card><CardContent className="py-4"><Field label="Metodologia" value={metod ? `${metod.codigo} v${metod.versao}` : "—"} /></CardContent></Card>
          <Card><CardContent className="py-4"><Field label="Última atualização" value={formatDateTime(av.updated_at)} /></CardContent></Card>
        </div>

        <Tabs defaultValue="visao">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="participantes">Participantes</TabsTrigger>
            <TabsTrigger value="coleta">Coleta</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
            <TabsTrigger value="revisao">Revisão Técnica</TabsTrigger>
            <TabsTrigger value="plano">Plano de Ação</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="visao">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Dados da avaliação</CardTitle>
                {editing && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(av); }}><X className="h-4 w-4 mr-1" /> Descartar</Button>
                    <Button size="sm" onClick={salvarEdicao}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!editing ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Título" value={av.titulo} />
                    <Field label="Unidade" value={av.unidade} />
                    <Field label="Data de início prevista" value={av.data_inicio_prevista ? formatDate(av.data_inicio_prevista) : "—"} />
                    <Field label="Data de encerramento prevista" value={av.data_fim_prevista ? formatDate(av.data_fim_prevista) : "—"} />
                    <Field label="Participantes previstos" value={av.quantidade_participantes_prevista} />
                    <Field label="Responsável HSE" value={resp?.nome || resp?.email || "—"} />
                    <div className="sm:col-span-2">
                      <Field label="Observações internas" value={<p className="whitespace-pre-wrap">{av.observacoes_internas || "—"}</p>} />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Título</Label>
                      <Input value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                    </div>
                    <div>
                      <Label>Unidade</Label>
                      <Input value={form.unidade || ""} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
                    </div>
                    <div>
                      <Label>Participantes previstos</Label>
                      <Input type="number" min={1} value={form.quantidade_participantes_prevista}
                        onChange={(e) => setForm({ ...form, quantidade_participantes_prevista: Number(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <Label>Data prevista de início</Label>
                      <Input type="date" value={form.data_inicio_prevista || ""} onChange={(e) => setForm({ ...form, data_inicio_prevista: e.target.value })} />
                    </div>
                    <div>
                      <Label>Data prevista de encerramento</Label>
                      <Input type="date" value={form.data_fim_prevista || ""} onChange={(e) => setForm({ ...form, data_fim_prevista: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Observações internas</Label>
                      <Textarea rows={3} value={form.observacoes_internas || ""} onChange={(e) => setForm({ ...form, observacoes_internas: e.target.value })} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participantes">
            <PsicoParticipantes
              avaliacaoId={av.id}
              clienteNome={clienteNome}
              tituloAvaliacao={av.titulo}
              mensagemConvite={av.mensagem_convite || ""}
              assuntoConvite={av.assunto_convite || ""}
              dataInicio={av.data_inicio_prevista}
              dataFim={av.data_fim_prevista}
              quantidadePrevista={av.quantidade_participantes_prevista}
              status={av.status}
              temVersaoPublicada={!!av.questionario_versao_id}
              codigoAvaliacao={av.codigo}
            />
          </TabsContent>
          <TabsContent value="coleta">
            <PsicoColetaTab av={av} onReload={load} />
          </TabsContent>
          <TabsContent value="resultados">
            <PsicoResultadosTab av={av} onReload={load} />
          </TabsContent>
          <TabsContent value="revisao">
            <PsicoRevisaoTab av={av} onReload={load} />
          </TabsContent>
          <TabsContent value="plano">
            <PsicoPlanoTab av={av} onReload={load} />
          </TabsContent>
          <TabsContent value="relatorio">
            <PsicoRelatorioTab av={av} onReload={load} />
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
              <CardContent>
                {auditoria.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
                ) : (
                  <ul className="divide-y">
                    {auditoria.map((a) => (
                      <li key={a.id} className="py-3 flex items-start gap-3 text-sm">
                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                          a.entidade === "revisao_tecnica" ? "bg-emerald-600" :
                          a.entidade === "plano_acao" ? "bg-sky-600" :
                          a.entidade === "relatorio_versao" ? "bg-violet-600" : "bg-primary"
                        }`} />
                        <div className="flex-1">
                          <div className="font-medium">{a.metadados?.resumo || a.acao}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(a.created_at)} · {a.entidade} · {a.acao}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
