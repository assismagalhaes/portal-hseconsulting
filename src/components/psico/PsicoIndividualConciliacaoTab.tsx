import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Cpu, Lock, RefreshCcw, ShieldAlert, Unlock } from "lucide-react";
import { fatorLabel } from "@/lib/psicoLabels";
import { mensagemErroConciliacao } from "@/lib/psicoIndividualFunctionError";
import { condicaoLabel } from "@/lib/psicoIndividualCondicoes";

type Achado = {
  id: string;
  processamento_id: string;
  fator_codigo: string;
  perigo_codigo: string | null;
  descricao_organizacional: string | null;
  frequencia_exposicao: string | null;
  intensidade_exigencia: string | null;
  controle_existente: string | null;
  eficacia_controle: string | null;
  condicao_preliminar: string | null;
  nivel_evidencia: string | null;
  estado_convergencia: string | null;
  fundamentacao_sanitizada: string | null;
  regra_codigo: string | null;
  regra_versao: string | null;
  estado_final: string;
  estado_original: string | null;
  necessita_acao: boolean;
  justificativa_alteracao: string | null;
  revisado_por: string | null;
  revisado_em: string | null;
  imutavel: boolean;
};

const ESTADOS: { value: string; label: string; tone: string }[] = [
  { value: "controlado", label: "Controlado", tone: "bg-emerald-100 text-emerald-800" },
  { value: "atencao_preventiva", label: "Atenção preventiva", tone: "bg-yellow-100 text-yellow-800" },
  { value: "requer_intervencao", label: "Requer intervenção", tone: "bg-orange-100 text-orange-800" },
  { value: "prioritario", label: "Prioritário", tone: "bg-red-100 text-red-800" },
  { value: "divergente", label: "Divergente", tone: "bg-purple-100 text-purple-800" },
  { value: "evidencia_insuficiente", label: "Evidência insuficiente", tone: "bg-slate-100 text-slate-700" },
  { value: "nao_aplicavel", label: "Não aplicável", tone: "bg-muted text-muted-foreground" },
];
const PRIORIDADE_ESTADO: Record<string, number> = {
  prioritario: 7,
  requer_intervencao: 6,
  divergente: 5,
  evidencia_insuficiente: 4,
  atencao_preventiva: 3,
  controlado: 2,
  nao_aplicavel: 1,
};
function estadoInfo(v: string | null | undefined) {
  return ESTADOS.find((e) => e.value === v) ?? { value: v ?? "—", label: v ?? "—", tone: "bg-muted" };
}
function labelize(v?: string | null) {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PsicoIndividualConciliacaoTab({
  avaliacaoId,
  onReload,
}: {
  avaliacaoId: string;
  onReload?: () => Promise<void> | void;
}) {
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [ultimoBloqueio, setUltimoBloqueio] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState("");

  async function carregar() {
    setLoading(true);
    setErroCarregar(null);
    try {
      const { data, error } = await (supabase as any).rpc("psico_ind_listar_achados", { p_avaliacao: avaliacaoId });
      if (error) throw error;
      setAchados((data as Achado[]) ?? []);
    } catch (e: any) {
      setErroCarregar(e?.message || "Falha ao carregar achados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [avaliacaoId]);

  async function rodar() {
    setProcessando(true);
    setUltimoBloqueio(null);
    try {
      const { data, error } = await supabase.functions.invoke("psico-individual-processar", {
        body: { avaliacao_id: avaliacaoId },
      });
      if (error) {
        const mensagem = await mensagemErroConciliacao(error, data);
        throw new Error(mensagem);
      }
      const payload = data as any;
      if (payload?.status === "bloqueado") {
        setUltimoBloqueio(payload?.motivo || "bloqueado");
        toast.warning("Processamento bloqueado: falta um dos formulários.");
      } else {
        toast.success("Conciliação processada.");
      }
      await carregar();
      await onReload?.();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível processar a conciliação.");
    } finally {
      setProcessando(false);
    }
  }

  const imutavel = achados[0]?.imutavel ?? false;
  const processamentoId = achados[0]?.processamento_id ?? null;
  const fatoresConsolidados = useMemo(() => {
    const grupos = new Map<string, Achado[]>();
    for (const achado of achados) {
      grupos.set(achado.fator_codigo, [...(grupos.get(achado.fator_codigo) ?? []), achado]);
    }
    return [...grupos.entries()].map(([fator, itens]) => {
      const pior = itens.reduce((atual, item) =>
        (PRIORIDADE_ESTADO[item.estado_final] ?? 0) > (PRIORIDADE_ESTADO[atual.estado_final] ?? 0)
          ? item
          : atual,
      );
      return {
        fator,
        itens,
        estado: pior.estado_final,
        acoes: itens.filter((item) => item.necessita_acao).length,
        divergencias: itens.filter((item) => item.estado_final === "divergente").length,
      };
    });
  }, [achados]);

  async function aprovar() {
    if (!processamentoId) return;
    try {
      const { error } = await (supabase as any).rpc("psico_ind_aprovar_processamento", { p_processamento: processamentoId });
      if (error) throw error;
      toast.success("Processamento aprovado e tornado imutável.");
      await carregar();
      await onReload?.();
    } catch (e: any) {
      toast.error("Falha ao aprovar: " + (e?.message || "erro"));
    }
  }

  async function reabrir() {
    if (!processamentoId || motivoReabertura.trim().length < 10) {
      toast.error("Descreva o motivo da reabertura com pelo menos 10 caracteres.");
      return;
    }
    setReabrindo(true);
    try {
      const { error } = await (supabase as any).rpc("psico_ind_reabrir_processamento", {
        p_processamento: processamentoId,
        p_motivo: motivoReabertura.trim(),
      });
      if (error) throw error;
      setMotivoReabertura("");
      toast.success("Conciliação reaberta. Processe novamente para aplicar as regras vigentes.");
      await carregar();
      await onReload?.();
    } catch (e: any) {
      toast.error("Não foi possível reabrir: " + (e?.message || "erro"));
    } finally {
      setReabrindo(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4" /> Conciliação individual</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Motor determinístico que combina empregado × empregador. Nenhuma resposta individual é exibida para o cliente; apenas os achados sanitizados.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {imutavel ? (
              <>
                <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Imutável</Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline"><Unlock className="h-4 w-4 mr-1" /> Reabrir</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reabrir conciliação?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Permitido somente antes de existir ação no plano ou relatório emitido. A operação ficará registrada no histórico.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="motivo-reabertura">Motivo técnico</Label>
                      <Textarea
                        id="motivo-reabertura"
                        value={motivoReabertura}
                        onChange={(event) => setMotivoReabertura(event.target.value)}
                        placeholder="Ex.: reprocessar divergências com a versão atual das regras."
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={reabrir} disabled={reabrindo || motivoReabertura.trim().length < 10}>
                        Reabrir conciliação
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={rodar} disabled={processando}>
                  <RefreshCcw className={`h-4 w-4 mr-1 ${processando ? "animate-spin" : ""}`} />
                  Processar
                </Button>
                {processamentoId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm"><CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Aprovar processamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Após aprovado, os achados ficam imutáveis. Novos processamentos precisarão criar uma nova avaliação.
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
          {ultimoBloqueio && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldAlert className="h-4 w-4 mt-0.5" />
              <div>
                Não é possível concluir sem os dois formulários. Motivo técnico: <code>{ultimoBloqueio}</code>
              </div>
            </div>
          )}
          {erroCarregar && (
            <div className="text-sm text-destructive">{erroCarregar}</div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando achados…</p>
          ) : achados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum processamento encontrado. Rode <strong>Processar</strong> após os dois formulários estarem concluídos.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div>
                  <h4 className="font-semibold">Consolidação por fator</h4>
                  <p className="text-xs text-muted-foreground">
                    O nível do fator considera a condição válida mais crítica, sem ocultar as condições avaliadas abaixo.
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {fatoresConsolidados.map((fator) => {
                    const info = estadoInfo(fator.estado);
                    return (
                      <div key={fator.fator} className="rounded-md border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{fatorLabel(fator.fator)}</span>
                          <Badge className={info.tone}>{info.label}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {fator.itens.length} condição(ões) · {fator.acoes} exige(m) ação
                          {fator.divergencias > 0 ? ` · ${fator.divergencias} divergência(s)` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 className="font-semibold">Condições avaliadas</h4>
                <p className="text-xs text-muted-foreground">
                  Cada cartão representa uma condição específica do fator, identificada pelo instrumento congelado.
                </p>
              </div>
              {achados.map((a) => (
                <AchadoCard key={a.id} a={a} onChanged={carregar} disabled={imutavel} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AchadoCard({ a, onChanged, disabled }: { a: Achado; onChanged: () => void; disabled: boolean }) {
  const [novoEstado, setNovoEstado] = useState<string>(a.estado_final);
  const [just, setJust] = useState("");
  const [saving, setSaving] = useState(false);
  const info = estadoInfo(a.estado_final);
  const alterou = useMemo(() => (a.estado_original && a.estado_original !== a.estado_final) || !!a.justificativa_alteracao, [a]);

  async function salvar() {
    if (!just.trim()) { toast.error("Informe a justificativa da decisão técnica."); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("psico_ind_alterar_classificacao", {
        p_achado: a.id, p_novo_estado: novoEstado, p_justificativa: just.trim(),
      });
      if (error) throw error;
      toast.success(novoEstado === a.estado_final ? "Classificação confirmada tecnicamente." : "Classificação atualizada.");
      setJust("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao alterar classificação.");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <div className="font-medium">{condicaoLabel(a.perigo_codigo)}</div>
          <div className="text-xs text-muted-foreground">{fatorLabel(a.fator_codigo)}</div>
        </div>
        <Badge className={info.tone}>{info.label}</Badge>
        {a.necessita_acao && <Badge variant="outline" className="text-orange-700 border-orange-300 gap-1"><AlertTriangle className="h-3 w-3" /> requer ação</Badge>}
        {a.estado_final === "divergente" && !a.revisado_em && (
          <Badge variant="outline" className="text-purple-700 border-purple-300">validação técnica pendente</Badge>
        )}
        {alterou && <Badge variant="outline" className="text-purple-700 border-purple-300">alterado tecnicamente</Badge>}
        <div className="ml-auto text-xs text-muted-foreground">
          Regra <code>{a.regra_codigo}</code> · {a.regra_versao}
        </div>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <Info label="Condição preliminar" value={labelize(a.condicao_preliminar)} />
        <Info label="Convergência" value={labelize(a.estado_convergencia)} />
        <Info label="Evidência" value={labelize(a.nivel_evidencia)} />
        <Info label="Frequência exposição" value={labelize(a.frequencia_exposicao)} />
        <Info label="Intensidade exigência" value={labelize(a.intensidade_exigencia)} />
        <Info label="Controle existente" value={labelize(a.controle_existente)} />
        <Info label="Eficácia controle" value={labelize(a.eficacia_controle)} />
      </div>

      {a.fundamentacao_sanitizada && (
        <div className="rounded bg-muted p-2 text-xs whitespace-pre-wrap">
          {a.fundamentacao_sanitizada}
        </div>
      )}

      {a.justificativa_alteracao && (
        <div className="text-xs">
          <span className="text-muted-foreground">Justificativa registrada:</span>{" "}
          <span>{a.justificativa_alteracao}</span>
        </div>
      )}

      {!disabled && (
        <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto] items-start pt-1">
          <div>
            <Label className="text-xs">Decisão do responsável técnico</Label>
            <Select value={novoEstado} onValueChange={setNovoEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Justificativa da decisão técnica</Label>
            <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Descreva a base técnica e organizacional da decisão." />
          </div>
          <div className="pt-5">
            <Button size="sm" onClick={salvar} disabled={saving || !just.trim()}>
              {novoEstado === a.estado_final ? "Confirmar" : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
