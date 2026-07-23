import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Wand2, Plus, Trash2, CheckCircle2, Lock, RefreshCw, AlertTriangle, Info, Save,
} from "lucide-react";
import {
  IndPlanoItem, SugestaoIA,
  aprovarPlanoIndividual, atualizarItemPlanoIndividual, criarItemPlanoIndividual,
  excluirItemPlanoIndividual, gatesPlanoIndividual, listarAchadosDaAvaliacao,
  listarPlanoIndividual, sugerirPlanoIA, sugestaoToPatch,
} from "@/lib/psicoIndividualPlano";
import { fatorLabel } from "@/lib/psicoLabels";
import { PSICO_INDIVIDUAL_AI_PLAN_ENABLED } from "@/lib/psicoIndividual";

type Achado = {
  id: string; fator_codigo: string; estado_final: string;
  necessita_acao: boolean; imutavel: boolean;
};

const ESTADO_BADGE: Record<string, string> = {
  prioritario: "bg-red-100 text-red-800",
  requer_intervencao: "bg-orange-100 text-orange-800",
  atencao_preventiva: "bg-yellow-100 text-yellow-800",
  divergente: "bg-purple-100 text-purple-800",
  controlado: "bg-emerald-100 text-emerald-800",
  evidencia_insuficiente: "bg-slate-100 text-slate-700",
  nao_aplicavel: "bg-muted text-muted-foreground",
};

export default function PsicoIndividualPlanoTab({ avaliacaoId }: { avaliacaoId: string }) {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<IndPlanoItem[]>([]);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [gates, setGates] = useState<Awaited<ReturnType<typeof gatesPlanoIndividual>> | null>(null);

  const [iaLoading, setIaLoading] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);
  const [sugestoes, setSugestoes] = useState<SugestaoIA[]>([]);
  const [rejeitadas, setRejeitadas] = useState<any[]>([]);
  const [iaMeta, setIaMeta] = useState<{ modelo?: string; prompt_versao?: string; log_id?: string } | null>(null);
  const [regenerarOpen, setRegenerarOpen] = useState(false);

  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState<any>({
    achado_id: "", titulo: "", objetivo: "", acao_recomendada: "",
    responsavel_sugerido: "", prazo_sugerido_dias: 30, evidencia_recomendada: "",
    indicador_eficacia: "", justificativa: "",
  });

  async function carregar() {
    setLoading(true);
    try {
      const [it, ac] = await Promise.all([
        listarPlanoIndividual(avaliacaoId),
        listarAchadosDaAvaliacao(avaliacaoId),
      ]);
      setItens(it);
      setAchados(ac as Achado[]);
      try { setGates(await gatesPlanoIndividual(avaliacaoId)); }
      catch { setGates(null); }
    } catch (e: any) {
      toast.error("Falha ao carregar plano: " + (e?.message || "erro"));
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [avaliacaoId]);

  const imutavel = itens.length > 0 && itens.every((i) => i.imutavel);
  const achadosMap = useMemo(() => {
    const m = new Map<string, Achado>();
    achados.forEach((a) => m.set(a.id, a));
    return m;
  }, [achados]);
  const achadosAcao = achados.filter((a) => a.necessita_acao);

  async function rodarIA() {
    setIaLoading(true);
    try {
      const { data, error } = await sugerirPlanoIA(avaliacaoId);
      if (error) {
        const msg = (error as any)?.message || "Falha na IA. Você pode criar ações manualmente.";
        toast.error(msg);
        return;
      }
      const payload = data as any;
      if (payload?.error) {
        toast.error(payload?.detail || payload.error);
        return;
      }
      setSugestoes((payload?.sugestoes ?? []) as SugestaoIA[]);
      setRejeitadas(payload?.rejeitadas ?? []);
      setIaMeta({ modelo: payload?.modelo, prompt_versao: payload?.prompt_versao, log_id: payload?.log_id });
      if (payload?.gate_prioritario_incompleto) {
        toast.warning("IA não cobriu todos os achados prioritários. Complete manualmente.");
      } else {
        toast.success(`IA sugeriu ${payload?.sugestoes?.length ?? 0} ação(ões).`);
      }
      setIaOpen(true);
    } finally { setIaLoading(false); }
  }

  async function aceitarSugestao(s: SugestaoIA) {
    const ach = achadosMap.get(s.achado_id);
    if (!ach) { toast.error("Achado não encontrado."); return; }
    const patch = sugestaoToPatch(s, avaliacaoId, ach.fator_codigo);
    const { error } = await criarItemPlanoIndividual(patch);
    if (error) { toast.error((error as any).message); return; }
    setSugestoes((p) => p.filter((x) => x !== s));
    toast.success("Ação adicionada ao plano.");
    carregar();
  }
  function rejeitarSugestao(s: SugestaoIA) {
    setSugestoes((p) => p.filter((x) => x !== s));
  }

  async function criarManual() {
    if (!novo.achado_id) { toast.error("Selecione o achado."); return; }
    if (!novo.titulo?.trim() || !novo.objetivo?.trim() || !novo.acao_recomendada?.trim()) {
      toast.error("Preencha título, objetivo e ação."); return;
    }
    const ach = achadosMap.get(novo.achado_id);
    if (!ach) { toast.error("Achado inválido."); return; }
    const { error } = await criarItemPlanoIndividual({
      avaliacao_id: avaliacaoId, achado_id: novo.achado_id,
      fator_codigo: ach.fator_codigo, origem: "manual",
      titulo: novo.titulo.trim(), objetivo: novo.objetivo.trim(),
      acao_recomendada: novo.acao_recomendada.trim(),
      responsavel_sugerido: novo.responsavel_sugerido?.trim() || null,
      prazo_sugerido_dias: Number(novo.prazo_sugerido_dias) || null,
      evidencia_recomendada: novo.evidencia_recomendada?.trim() || null,
      indicador_eficacia: novo.indicador_eficacia?.trim() || null,
      justificativa: novo.justificativa?.trim() || null,
    } as any);
    if (error) { toast.error((error as any).message); return; }
    setNovoOpen(false);
    setNovo({ achado_id: "", titulo: "", objetivo: "", acao_recomendada: "", responsavel_sugerido: "", prazo_sugerido_dias: 30, evidencia_recomendada: "", indicador_eficacia: "", justificativa: "" });
    toast.success("Ação criada.");
    carregar();
  }

  async function excluir(item: IndPlanoItem) {
    const { error } = await excluirItemPlanoIndividual(item.id);
    if (error) { toast.error((error as any).message); return; }
    setItens((p) => p.filter((x) => x.id !== item.id));
    carregar();
  }

  async function salvarCampo(id: string, patch: Partial<IndPlanoItem>) {
    const { error } = await atualizarItemPlanoIndividual(id, patch);
    if (error) { toast.error((error as any).message); return; }
    setItens((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    carregar();
  }

  async function aprovar() {
    try {
      const { error } = await aprovarPlanoIndividual(avaliacaoId);
      if (error) throw error;
      toast.success("Plano de ação aprovado e congelado.");
      carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aprovar plano.");
    }
  }

  if (loading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>;

  const processamentoOk = achados.length > 0 && achados.some((a) => a.imutavel);
  if (achados.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Nenhum achado disponível. Rode a <b>Conciliação</b> antes de montar o plano.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Plano de ação individual</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {achadosAcao.length} achado(s) exigem ação · {itens.length} item(ns) no plano
              {imutavel && <span className="ml-2 inline-flex items-center gap-1"><Lock className="h-3 w-3" /> imutável</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!imutavel && (
              <>
                <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Ação manual</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Nova ação manual</DialogTitle></DialogHeader>
                    <div className="grid gap-3">
                      <div>
                        <Label>Achado *</Label>
                        <Select value={novo.achado_id} onValueChange={(v) => setNovo({ ...novo, achado_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione um achado" /></SelectTrigger>
                          <SelectContent>
                            {achadosAcao.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {fatorLabel(a.fator_codigo)} — {a.estado_final}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Título *</Label><Input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></div>
                      <div><Label>Objetivo *</Label><Textarea rows={2} value={novo.objetivo} onChange={(e) => setNovo({ ...novo, objetivo: e.target.value })} /></div>
                      <div><Label>Ação a executar *</Label><Textarea rows={2} value={novo.acao_recomendada} onChange={(e) => setNovo({ ...novo, acao_recomendada: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Responsável (papel)</Label><Input value={novo.responsavel_sugerido} onChange={(e) => setNovo({ ...novo, responsavel_sugerido: e.target.value })} /></div>
                        <div><Label>Prazo (dias)</Label><Input type="number" min={1} value={novo.prazo_sugerido_dias} onChange={(e) => setNovo({ ...novo, prazo_sugerido_dias: e.target.value })} /></div>
                      </div>
                      <div><Label>Evidência</Label><Input value={novo.evidencia_recomendada} onChange={(e) => setNovo({ ...novo, evidencia_recomendada: e.target.value })} /></div>
                      <div><Label>Indicador de eficácia</Label><Input value={novo.indicador_eficacia} onChange={(e) => setNovo({ ...novo, indicador_eficacia: e.target.value })} /></div>
                      <div><Label>Justificativa</Label><Textarea rows={2} value={novo.justificativa} onChange={(e) => setNovo({ ...novo, justificativa: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setNovoOpen(false)}>Cancelar</Button>
                      <Button onClick={criarManual}><Save className="h-4 w-4 mr-1" /> Criar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {!PSICO_INDIVIDUAL_AI_PLAN_ENABLED ? null : sugestoes.length > 0 ? (
                  <AlertDialog open={regenerarOpen} onOpenChange={setRegenerarOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={iaLoading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${iaLoading ? "animate-spin" : ""}`} /> Regenerar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regenerar sugestões da IA?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Substitui as sugestões atuais ainda não aceitas. Ações já adicionadas ao plano são preservadas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); setRegenerarOpen(false); rodarIA(); }}>Regenerar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button size="sm" onClick={rodarIA} disabled={iaLoading || !processamentoOk}>
                    <Wand2 className={`h-4 w-4 mr-1 ${iaLoading ? "animate-spin" : ""}`} /> Sugerir com IA
                  </Button>
                )}

                {gates?.pronto_para_aprovacao && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="default"><CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar plano</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Aprovar plano de ação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Após aprovado, todos os itens ficam imutáveis. Novas alterações precisarão de um novo ciclo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={aprovar}>Aprovar e travar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!processamentoOk && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              A conciliação ainda não foi aprovada. A IA só fica disponível depois da aprovação técnica.
            </div>
          )}
          {gates && !gates.pronto_para_aprovacao && !imutavel && (
            <div className="rounded-md border p-3 text-xs space-y-1">
              <div className="font-medium">Pendências para aprovação:</div>
              {gates.achados_sem_acao.length > 0 && (
                <div>• {gates.achados_sem_acao.length} achado(s) sem ação (dos quais {gates.prioritarios_sem_acao.length} prioritário(s))</div>
              )}
              {gates.itens_incompletos.length > 0 && (
                <div>• {gates.itens_incompletos.length} item(ns) sem responsável, prazo ou evidência</div>
              )}
            </div>
          )}
          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ação criada. Use a IA ou crie manualmente.</p>
          ) : (
            <div className="space-y-3">
              {itens.map((i) => (
                <ItemCard key={i.id} item={i} onSalvar={salvarCampo} onExcluir={excluir} disabled={imutavel} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={iaOpen} onOpenChange={setIaOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sugestões da IA</DialogTitle>
            <DialogDescription>
              Modelo <code>{iaMeta?.modelo}</code> · prompt <code>{iaMeta?.prompt_versao}</code> · log <code>{iaMeta?.log_id?.slice(0, 8)}</code>
              <br />Revise cada sugestão. Você pode aceitar, editar depois de aceita, ou rejeitar.
            </DialogDescription>
          </DialogHeader>
          {sugestoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sugestão pendente.</p>
          ) : (
            <div className="max-h-[65vh] overflow-auto space-y-3">
              {sugestoes.map((s, idx) => {
                const ach = achadosMap.get(s.achado_id);
                return (
                  <div key={idx} className="border rounded-md p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={ESTADO_BADGE[ach?.estado_final ?? ""] ?? "bg-muted"}>{fatorLabel(ach?.fator_codigo)}</Badge>
                      <span className="text-xs text-muted-foreground">{ach?.estado_final}</span>
                      <span className="ml-auto text-xs text-muted-foreground">prazo {s.prazo_dias}d</span>
                    </div>
                    <div className="font-medium">{s.titulo}</div>
                    <div><span className="text-xs text-muted-foreground">Objetivo:</span> {s.objetivo}</div>
                    <div><span className="text-xs text-muted-foreground">Ação:</span> {s.acao}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Responsável:</span> {s.responsavel_sugerido}</div>
                      <div><span className="text-muted-foreground">Evidência:</span> {s.evidencia}</div>
                      <div><span className="text-muted-foreground">Indicador:</span> {s.indicador_eficacia}</div>
                      {s.medida_catalogo_codigo && <div><span className="text-muted-foreground">Catálogo:</span> {s.medida_catalogo_codigo}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground italic">Justificativa: {s.justificativa}</div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => aceitarSugestao(s)}>Aceitar</Button>
                      <Button size="sm" variant="ghost" onClick={() => rejeitarSugestao(s)}>Rejeitar</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {rejeitadas.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground border-t pt-2">
              <Info className="h-3 w-3 inline mr-1" />
              {rejeitadas.length} sugestão(ões) foram rejeitadas automaticamente por não passarem nos gates.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemCard({
  item, onSalvar, onExcluir, disabled,
}: {
  item: IndPlanoItem;
  onSalvar: (id: string, patch: Partial<IndPlanoItem>) => void;
  onExcluir: (i: IndPlanoItem) => void;
  disabled: boolean;
}) {
  const [resp, setResp] = useState(item.responsavel_definido ?? item.responsavel_sugerido ?? "");
  const [prazo, setPrazo] = useState<string>(item.prazo_definido ?? "");
  const [evid, setEvid] = useState(item.evidencia_definida ?? item.evidencia_recomendada ?? "");
  const [indic, setIndic] = useState(item.indicador_eficacia ?? "");

  return (
    <div className={`border rounded-md p-3 text-sm ${item.imutavel ? "opacity-90" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline">{fatorLabel(item.fator_codigo)}</Badge>
        <Badge className={ESTADO_BADGE[item.achado_estado] ?? "bg-muted"}>{item.achado_estado}</Badge>
        <Badge variant="secondary" className="uppercase text-[10px]">{item.origem}</Badge>
        {item.imutavel && <Badge className="gap-1"><Lock className="h-3 w-3" /> imutável</Badge>}
        {!disabled && (
          <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => onExcluir(item)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="font-medium">{item.titulo}</div>
      <div className="text-xs text-muted-foreground mb-2">{item.objetivo}</div>
      <div className="text-xs whitespace-pre-wrap mb-2">{item.acao_recomendada}</div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-[10px] uppercase">Responsável</Label>
          <Input value={resp} onChange={(e) => setResp(e.target.value)} disabled={disabled}
            onBlur={() => resp !== (item.responsavel_definido ?? item.responsavel_sugerido ?? "") && onSalvar(item.id, { responsavel_definido: resp || null })} />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Prazo</Label>
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={disabled}
            onBlur={() => prazo !== (item.prazo_definido ?? "") && onSalvar(item.id, { prazo_definido: prazo || null })} />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Evidência</Label>
          <Input value={evid} onChange={(e) => setEvid(e.target.value)} disabled={disabled}
            onBlur={() => evid !== (item.evidencia_definida ?? item.evidencia_recomendada ?? "") && onSalvar(item.id, { evidencia_definida: evid || null })} />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Indicador</Label>
          <Input value={indic} onChange={(e) => setIndic(e.target.value)} disabled={disabled}
            onBlur={() => indic !== (item.indicador_eficacia ?? "") && onSalvar(item.id, { indicador_eficacia: indic || null })} />
        </div>
      </div>
      {item.justificativa && (
        <div className="text-[11px] text-muted-foreground italic mt-2">Justificativa: {item.justificativa}</div>
      )}
    </div>
  );
}
