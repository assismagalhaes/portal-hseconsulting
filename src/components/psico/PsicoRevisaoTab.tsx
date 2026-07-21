import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Lock, RefreshCw, ShieldCheck, Info, Sparkles, Save, History, Upload, FileSignature } from "lucide-react";
import { useAuth } from "@/lib/auth";
import PsicoAprovacaoConsolidada from "./PsicoAprovacaoConsolidada";
import {
  RevisaoStatus, STATUS_REVISAO_COLOR, STATUS_REVISAO_LABEL,
  TRATAMENTO_LABEL, PRIORIDADE_COLOR,
  aprovarRevisao, atualizarRevisao, atualizarRevisaoFator, criarRevisao,
  getParecerHistorico, getRevisaoAtiva, getRevisaoFatores, reabrirRevisao,
  salvarParecerConclusivo, traduzirErro, validarRevisao,
} from "@/lib/psicoRevisao";
import { formatDateTime } from "@/lib/format";
import { formatDate } from "@/lib/format";

export default function PsicoRevisaoTab({ av, onReload }: { av: any; onReload?: () => void }) {
  const { isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rev, setRev] = useState<any>(null);
  const [fatores, setFatores] = useState<any[]>([]);
  const [orient, setOrient] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [validacao, setValidacao] = useState<any>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveText, setApproveText] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenMotivo, setReopenMotivo] = useState("");
  const [parecer, setParecer] = useState<Record<string, string>>({});
  const [parecerHistory, setParecerHistory] = useState<any[]>([]);
  const [generatingOpinion, setGeneratingOpinion] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [ctxDados, setCtxDados] = useState<{ clienteNome?: string; totalRespondentes?: number } | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<any>(null);

  function buildDefaults(revData: any, dados: { clienteNome?: string; totalRespondentes?: number }) {
    const cliente = dados.clienteNome || "—";
    const unidade = av?.unidade || "não informada";
    const ini = av?.data_inicio_prevista ? formatDate(av.data_inicio_prevista) : "—";
    const fim = av?.data_fim_prevista ? formatDate(av.data_fim_prevista) : "—";
    const previstos = av?.quantidade_participantes_prevista ?? "—";
    const respondentes = dados.totalRespondentes ?? 0;
    const modoColeta = av?.modo_coleta === "publico_anonimo"
      ? "coleta pública anônima (link único por avaliação)"
      : "coleta nominal por convite individual";
    const adesaoPct = previstos && Number(previstos) > 0
      ? Math.round((respondentes / Number(previstos)) * 100)
      : null;

    const contexto =
`Cliente: ${cliente}.
Unidade avaliada: ${unidade}.
Período previsto de coleta: ${ini} a ${fim}.
Participantes previstos: ${previstos}. Respondentes válidos: ${respondentes}${adesaoPct !== null ? ` (adesão de ${adesaoPct}%)` : ""}.
Modalidade: ${modoColeta}.`;

    const limitacoesPartes: string[] = [];
    if (revData?.amostra_reduzida) {
      limitacoesPartes.push("Amostra reduzida: recortes por função, setor ou unidade com menos de 2 respondentes foram suprimidos para preservar o sigilo (NR-01).");
    }
    if (adesaoPct !== null && adesaoPct < 70) {
      limitacoesPartes.push(`Adesão inferior a 70% (${adesaoPct}%): a leitura coletiva deve considerar possível viés de participação.`);
    }
    if (av?.modo_coleta === "publico_anonimo") {
      limitacoesPartes.push("Coleta pública anônima: não é possível vincular respostas a indivíduos; a análise é estritamente coletiva.");
    }
    limitacoesPartes.push("O questionário mede percepções autorrelatadas em um recorte temporal específico e não substitui avaliação clínica individual.");

    return {
      contexto_organizacional: contexto,
      limitacoes: limitacoesPartes.join(" "),
    };
  }

  function preencherAutomaticamente() {
    if (!rev || !ctxDados) return;
    const defaults = buildDefaults(rev, ctxDados);
    setForm((f: any) => ({
      ...f,
      contexto_organizacional: defaults.contexto_organizacional,
      limitacoes: defaults.limitacoes,
      responsavel_tecnico_id: f.responsavel_tecnico_id || (profiles.find((p) => p.id === user?.id)?.id ?? f.responsavel_tecnico_id),
    }));
    toast.success("Dados básicos preenchidos. Revise antes de salvar.");
  }

  async function load() {
    setLoading(true);
    try {
      const r = await getRevisaoAtiva(av.id);
      setRev(r);
      setParecer(r?.parecer_conclusivo || {
        sintese_resultados: r?.conclusao_tecnica || r?.conclusao_sugerida || "",
        interpretacao_integrada: r?.contexto_organizacional || "",
        prioridades_intervencao: r?.recomendacao_geral || "",
        recomendacoes: r?.recomendacao_geral || "",
        limitacoes: r?.limitacoes || "",
        conclusao: r?.conclusao_tecnica || r?.conclusao_sugerida || "",
      });
      if (r) {
        const fs = await getRevisaoFatores(r.id);
        setFatores(fs);
        const codes = Array.from(new Set(fs.map((f: any) => f.fator_codigo)));
        if (codes.length && r.biblioteca_versao_id) {
          const { data: o } = await (supabase as any).from("psico_fatores_orientacoes")
            .select("*")
            .eq("biblioteca_versao_id", r.biblioteca_versao_id)
            .in("fator_codigo", codes);
          const map: Record<string, any> = {};
          (o || []).forEach((x: any) => { map[x.fator_codigo] = x; });
          setOrient(map);
        }
        const { data: p } = await (supabase as any).from("profiles").select("id, nome, email, cargo, registro_profissional, assinatura_modo, assinatura_ativa, assinatura_nome_arquivo, assinatura_mime_type").order("nome");
        setProfiles(p || []);
        const history = await getParecerHistorico(r.id);
        setParecerHistory(history.data || []);
        const { data: val } = await validarRevisao(r.id);
        setValidacao(val);

        // Contexto determinístico: cliente + totais do processamento
        const [{ data: cli }, { data: proc }] = await Promise.all([
          av?.cliente_id
            ? (supabase as any).from("clients").select("razao_social, nome_fantasia").eq("id", av.cliente_id).maybeSingle()
            : Promise.resolve({ data: null }),
          (supabase as any).from("psico_resultado_processamentos").select("total_respondentes").eq("id", r.processamento_id).maybeSingle(),
        ]);
        const dados = {
          clienteNome: cli?.nome_fantasia || cli?.razao_social || undefined,
          totalRespondentes: proc?.total_respondentes ?? 0,
        };
        setCtxDados(dados);
        const defaults = buildDefaults(r, dados);
        const currentUserAsProfile = (p || []).find((prof: any) => prof.id === user?.id)?.id || "";
        setForm({
          contexto_organizacional: r?.contexto_organizacional || defaults.contexto_organizacional,
          limitacoes: r?.limitacoes || defaults.limitacoes,
          recomendacao_geral: r?.recomendacao_geral || "",
          observacoes_internas: r?.observacoes_internas || "",
          responsavel_tecnico_id: r?.responsavel_tecnico_id || currentUserAsProfile,
        });
      } else {
        setForm({
          contexto_organizacional: "",
          limitacoes: "",
          recomendacao_geral: "",
          observacoes_internas: "",
          responsavel_tecnico_id: "",
        });
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [av?.id]);

  const podeIniciar = !rev && (av.status === "resultado_pronto" || av.status === "relatorio_emitido");
  const readOnly = rev?.status === "aprovada";

  async function iniciar(modo: "rapida" | "detalhada") {
    setCreating(true);
    const { error } = await criarRevisao(av.id, modo);
    setCreating(false);
    if (error) { toast.error(traduzirErro(String(error.message).split(":")[0]) || error.message); return; }
    toast.success("Revisão técnica criada");
    load(); onReload?.();
  }

  async function salvarCabecalho() {
    if (!rev) return;
    setSaving(true);
    const { error } = await atualizarRevisao(rev.id, {
      contexto_organizacional: form.contexto_organizacional || null,
      limitacoes: form.limitacoes || null,
      recomendacao_geral: form.recomendacao_geral || null,
      observacoes_internas: form.observacoes_internas || null,
      responsavel_tecnico_id: form.responsavel_tecnico_id || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Revisão salva"); load();
  }

  async function salvarParecer(origem?: "manual" | "editado_ia" | "restaurado", conteudo = parecer) {
    if (!rev) return;
    setSaving(true);
    const resolvedOrigin = origem || (rev.parecer_origem === "ia" || rev.parecer_origem === "editado_ia" ? "editado_ia" : "manual");
    const { error } = await salvarParecerConclusivo(rev.id, conteudo, resolvedOrigin);
    setSaving(false);
    if (error) { toast.error(error.message.includes("PARECER_ESTRUTURA_INVALIDA") ? "Preencha as seis partes do parecer com conteúdo técnico suficiente." : error.message); return; }
    toast.success("Parecer técnico salvo e versionado");
    load();
  }

  async function gerarParecerIa() {
    if (!rev) return;
    const hasOpinion = Object.values(parecer).some((value) => value?.trim());
    if (hasOpinion) { setRegenOpen(true); return; }
    await executarGeracaoParecer(false);
  }

  async function executarGeracaoParecer(substituir: boolean) {
    if (!rev) return;
    setGeneratingOpinion(true);
    const headerSave = await atualizarRevisao(rev.id, {
      contexto_organizacional: form.contexto_organizacional || null,
      limitacoes: form.limitacoes || null,
      recomendacao_geral: form.recomendacao_geral || null,
      responsavel_tecnico_id: form.responsavel_tecnico_id || null,
    });
    if (headerSave.error) {
      setGeneratingOpinion(false);
      toast.error(`Não foi possível salvar o contexto antes da geração: ${headerSave.error.message}`);
      return;
    }
    const { data, error } = await supabase.functions.invoke("psico-gerar-parecer", {
      body: { revisao_id: rev.id, confirmar_substituicao: substituir },
    });
    setGeneratingOpinion(false);
    if (error || !data?.parecer) { toast.error(data?.error || error?.message || "Não foi possível gerar a minuta"); return; }
    setParecer(data.parecer);
    toast.success("Minuta gerada. Revise e salve antes de aprovar.");
    load();
  }

  async function configurarAssinatura(mode: "em_branco" | "imagem", file?: File) {
    const target = form.responsavel_tecnico_id;
    if (!target) { toast.error("Selecione o responsável técnico primeiro"); return; }
    setUploadingSignature(true);
    let body: FormData | Record<string, string>;
    if (mode === "imagem" && file) {
      const formData = new FormData();
      formData.append("responsavel_tecnico_id", target);
      formData.append("arquivo", file);
      body = formData;
    } else body = { responsavel_tecnico_id: target, modo: "em_branco" };
    const { data, error } = await supabase.functions.invoke("psico-assinatura-upload", { body });
    setUploadingSignature(false);
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Não foi possível configurar a assinatura"); return; }
    toast.success(mode === "imagem" ? "Imagem privada da assinatura atualizada" : "Assinatura em branco selecionada");
    load();
  }

  async function salvarFator(f: any, patch: Record<string, any>) {
    const { error } = await atualizarRevisaoFator(f.id, patch);
    if (error) { toast.error(error.message); return; }
    setFatores((prev) => prev.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
  }

  async function marcarPronta() {
    if (!rev) return;
    const { error } = await atualizarRevisao(rev.id, { status: "pronta_para_aprovacao" });
    if (error) { toast.error(error.message); return; }
    toast.success("Revisão marcada como pronta para aprovação"); load();
  }

  async function aprovar() {
    if (!rev) return;
    const esperado = `APROVAR ${av.codigo}`;
    const { error } = await aprovarRevisao(rev.id, esperado);
    if (error) {
      const msg = String(error.message);
      if (msg.includes("CHECKLIST_INCOMPLETO")) toast.error("Checklist incompleto. Revise os itens pendentes.");
      else toast.error(msg);
      return;
    }
    toast.success("Revisão aprovada!");
    setApproveOpen(false); load(); onReload?.();
  }

  async function reabrir() {
    if (!rev) return;
    if (reopenMotivo.trim().length < 20) { toast.error("Motivo deve ter ao menos 20 caracteres"); return; }
    const { error } = await reabrirRevisao(rev.id, reopenMotivo);
    if (error) { toast.error(error.message); return; }
    toast.success("Revisão reaberta");
    setReopenOpen(false); setReopenMotivo(""); load(); onReload?.();
  }

  if (loading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>;

  if (!rev) {
    if (!podeIniciar) {
      return (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          A revisão técnica poderá ser iniciada quando o resultado da avaliação estiver pronto.
        </CardContent></Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Iniciar revisão técnica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground max-w-2xl">
            A revisão técnica traz o tratamento de cada fator (ação recomendada, monitoramento preventivo ou sem ação), a conclusão do responsável técnico e as recomendações. O plano de ação é pré-populado com as medidas sugeridas da biblioteca vigente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => iniciar("rapida")} disabled={creating}>
              <Sparkles className="h-4 w-4 mr-2" /> Criar (modo rápido)
            </Button>
            <Button variant="outline" onClick={() => iniciar("detalhada")} disabled={creating}>
              Criar (modo detalhado)
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status: RevisaoStatus = rev.status;
  const erros: string[] = validacao?.erros || [];

  return (
    <div className="space-y-4">
      <PsicoAprovacaoConsolidada avaliacaoId={av.id} avaliacaoCodigo={av.codigo} refreshKey={rev?.updated_at || rev?.atualizada_em} />
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={STATUS_REVISAO_COLOR[status]}>{STATUS_REVISAO_LABEL[status]}</Badge>
            <span className="text-xs text-muted-foreground">Versão {rev.versao} · Modo {rev.modo}</span>
            {rev.amostra_reduzida && <Badge variant="outline" className="text-amber-700 border-amber-300">Amostra reduzida</Badge>}
            {readOnly && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Imutável</span>}
            {rev.aprovada_em && <span className="text-xs text-muted-foreground">Aprovada em {formatDateTime(rev.aprovada_em)}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Revalidar</Button>
            {status === "rascunho" && (
              <Button size="sm" variant="outline" onClick={marcarPronta} disabled={!validacao?.valido}>
                Marcar como pronta
              </Button>
            )}
            {(status === "rascunho" || status === "pronta_para_aprovacao" || status === "reaberta") && (
              <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={!validacao?.valido}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> Aprovar revisão
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Aprovar revisão técnica?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A aprovação torna a revisão e o plano de ação imutáveis. Deseja continuar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); aprovar(); }}>Sim, aprovar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {status === "aprovada" && isAdmin && av.status !== "relatorio_emitido" && (
              <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">Reabrir</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reabrir revisão aprovada?</AlertDialogTitle>
                    <AlertDialogDescription>Descreva o motivo (mínimo 20 caracteres). A ação será registrada em auditoria.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea rows={4} value={reopenMotivo} onChange={(e) => setReopenMotivo(e.target.value)} />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); reabrir(); }}>Confirmar reabertura</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {validacao && (
        <Alert variant={validacao.valido ? "default" : "destructive"}>
          {validacao.valido ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4" />}
          <AlertTitle>{validacao.valido ? "Checklist completo" : "Pendências encontradas"}</AlertTitle>
          <AlertDescription>
            <div className="text-xs mb-1">{validacao.fatores_significativos} fator(es) significativo(s) · {validacao.itens} item(ns) selecionado(s) no plano</div>
            {erros.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {erros.map((e, i) => <li key={i}>{traduzirErro(e)}</li>)}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cabeçalho técnico</CardTitle>
          {!readOnly && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={preencherAutomaticamente} disabled={!ctxDados}>
                <Sparkles className="h-4 w-4 mr-2" /> Preencher automaticamente
              </Button>
              <Button size="sm" onClick={salvarCabecalho} disabled={saving}>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Responsável técnico *</Label>
            <Select value={form.responsavel_tecnico_id || ""} onValueChange={(v) => setForm({ ...form, responsavel_tecnico_id: v })} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
            {rev.responsavel_snapshot && (
              <p className="text-xs text-muted-foreground mt-1">
                Assinado por: <b>{rev.responsavel_snapshot.nome}</b> · {rev.responsavel_snapshot.cargo}
              </p>
            )}
            {!readOnly && form.responsavel_tecnico_id && (
              <div className="mt-3 rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium"><FileSignature className="h-4 w-4" /> Assinatura no relatório</div>
                <p className="text-xs text-muted-foreground">A imagem é opcional, privada e será congelada como referência quando a revisão for aprovada.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={uploadingSignature} onClick={() => configurarAssinatura("em_branco")}>Deixar espaço em branco</Button>
                  <Label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent">
                    <Upload className="mr-2 h-4 w-4" /> Enviar PNG/JPG
                    <Input className="sr-only" type="file" accept="image/png,image/jpeg" disabled={uploadingSignature}
                      onChange={(event) => { const file = event.target.files?.[0]; if (file) configurarAssinatura("imagem", file); event.target.value = ""; }} />
                  </Label>
                </div>
                {(() => {
                  const selected = profiles.find((profile) => profile.id === form.responsavel_tecnico_id);
                  return selected ? <p className="text-xs text-muted-foreground">Modo atual: <b>{selected.assinatura_modo === "imagem" && selected.assinatura_ativa ? `imagem (${selected.assinatura_nome_arquivo || "arquivo protegido"})` : "em branco"}</b></p> : null;
                })()}
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Contexto organizacional</Label>
            <Textarea rows={3} value={form.contexto_organizacional} disabled={readOnly}
              onChange={(e) => setForm({ ...form, contexto_organizacional: e.target.value })}
              placeholder="Descreva contexto relevante (mudanças recentes, sazonalidade, reestruturações etc.)" />
          </div>
          <div className="md:col-span-2">
            <Label>Limitações do estudo *</Label>
            <Textarea rows={2} value={form.limitacoes} disabled={readOnly}
              onChange={(e) => setForm({ ...form, limitacoes: e.target.value })}
              placeholder="Ex.: baixa adesão em determinada unidade, período curto de coleta…" />
          </div>
          <div className="md:col-span-2">
            <Label>Recomendação geral</Label>
            <Textarea rows={3} value={form.recomendacao_geral} disabled={readOnly}
              onChange={(e) => setForm({ ...form, recomendacao_geral: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Observações internas <span className="text-xs text-muted-foreground">(não sai no relatório)</span></Label>
            <Textarea rows={2} value={form.observacoes_internas} disabled={readOnly}
              onChange={(e) => setForm({ ...form, observacoes_internas: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Parecer técnico conclusivo</CardTitle>
            {!readOnly && <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={gerarParecerIa} disabled={generatingOpinion}>
                <Sparkles className="mr-2 h-4 w-4" /> {generatingOpinion ? "Gerando…" : "Gerar minuta com IA"}
              </Button>
              <Button type="button" size="sm" onClick={() => salvarParecer()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> Salvar parecer
              </Button>
            </div>}
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Texto sugerido por inteligência artificial. Revisão e aprovação técnica humanas são obrigatórias. Somente o parecer aprovado integra o relatório.</AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["sintese_resultados", "Síntese dos resultados", "Apresente participação, índice descritivo, fatores significativos e prioridades calculadas."],
            ["interpretacao_integrada", "Interpretação integrada", "Relacione os achados coletivos ao contexto informado, sem afirmar causalidade."],
            ["prioridades_intervencao", "Prioridades de intervenção", "Explique o que deve ser priorizado e por quê."],
            ["recomendacoes", "Recomendações", "Oriente medidas organizacionais, trabalho real, eficácia e integração com o PGR."],
            ["limitacoes", "Limitações", "Registre limites da amostra e da interpretação do questionário."],
            ["conclusao", "Conclusão", "Consolide a decisão técnica e os próximos passos da organização."],
          ].map(([key, label, placeholder]) => <div key={key}>
            <Label>{label} *</Label>
            <Textarea rows={key === "interpretacao_integrada" || key === "recomendacoes" ? 4 : 3}
              value={parecer[key] || ""} disabled={readOnly}
              placeholder={placeholder}
              onChange={(event) => setParecer((current) => ({ ...current, [key]: event.target.value }))} />
          </div>)}
          {parecerHistory.length > 0 && <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium inline-flex items-center gap-2"><History className="h-4 w-4" /> Histórico do parecer ({parecerHistory.length})</summary>
            <div className="mt-3 space-y-2">
              {parecerHistory.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/50 p-2 text-xs">
                <span>Versão {version.numero} · {version.origem} · {formatDateTime(version.criado_em)}{version.prompt_codigo ? ` · ${version.prompt_codigo}` : ""}</span>
                {!readOnly && <Button size="sm" variant="ghost" onClick={() => setRestoreVersion(version)}>Restaurar</Button>}
              </div>)}
            </div>
          </details>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tratamento por fator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fatores.map((f) => {
            const o = orient[f.fator_codigo];
            return (
              <div key={f.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{f.fator_codigo}</span>
                    <span className="font-medium">{o?.nome || f.fator_codigo}</span>
                    <Badge className={PRIORIDADE_COLOR[f.prioridade_calculada] || "bg-muted"}>{f.prioridade_calculada}</Badge>
                    {f.significativo_calculado ? (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">Significativo</Badge>
                    ) : (
                      <Badge variant="outline">Não significativo</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Info className="h-3 w-3" /> Cálculo original imutável
                  </div>
                </div>

                {o?.definicao_resumida && <p className="text-xs text-muted-foreground">{o.definicao_resumida}</p>}

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Tratamento técnico</Label>
                    <Select
                      value={f.tratamento_tecnico}
                      onValueChange={(v) => salvarFator(f, { tratamento_tecnico: v })}
                      disabled={readOnly}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRATAMENTO_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Observação técnica</Label>
                    <Textarea
                      rows={2}
                      defaultValue={f.observacao_tecnica || ""}
                      disabled={readOnly}
                      onBlur={(e) => e.target.value !== (f.observacao_tecnica || "") && salvarFator(f, { observacao_tecnica: e.target.value || null })}
                    />
                  </div>
                </div>

                {f.tratamento_tecnico === "sem_acao_especifica" && (
                  <div>
                    <Label className="text-xs">Justificativa (obrigatória para "sem ação específica")</Label>
                    <Textarea
                      rows={2}
                      defaultValue={f.justificativa || ""}
                      disabled={readOnly}
                      onBlur={(e) => e.target.value !== (f.justificativa || "") && salvarFator(f, { justificativa: e.target.value || null })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground border-t pt-2">
        A revisão não altera resultados matemáticos calculados. Apenas registra o tratamento técnico, a conclusão e as recomendações do responsável.
      </p>

      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova minuta com IA?</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova versão será gerada e substituirá o texto atual dos seis campos do parecer. A versão anterior é preservada no histórico para comparação e restauração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setRegenOpen(false); void executarGeracaoParecer(true); }}>
              Sim, gerar nova
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreVersion} onOpenChange={(open) => !open && setRestoreVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar versão {restoreVersion?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo desta versão substituirá o parecer atual. A versão em uso agora continuará disponível no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const v = restoreVersion;
              setRestoreVersion(null);
              if (v) { setParecer(v.conteudo); salvarParecer("restaurado", v.conteudo); }
            }}>Sim, restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
