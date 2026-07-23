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
import { AlertTriangle, CheckCircle2, Cpu, Lock, RefreshCcw, ShieldAlert } from "lucide-react";
import { fatorLabel } from "@/lib/psicoLabels";

type Achado = {
  id: string;
  processamento_id: string;
  fator_codigo: string;
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
function estadoInfo(v: string | null | undefined) {
  return ESTADOS.find((e) => e.value === v) ?? { value: v ?? "—", label: v ?? "—", tone: "bg-muted" };
}
function labelize(v?: string | null) {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PsicoIndividualConciliacaoTab({ avaliacaoId }: { avaliacaoId: string }) {
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [ultimoBloqueio, setUltimoBloqueio] = useState<string | null>(null);

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
      if (error) throw error;
      const payload = data as any;
      if (payload?.status === "bloqueado") {
        setUltimoBloqueio(payload?.motivo || "bloqueado");
        toast.warning("Processamento bloqueado: falta um dos formulários.");
      } else {
        toast.success("Conciliação processada.");
      }
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao processar conciliação: " + (e?.message || "erro"));
    } finally {
      setProcessando(false);
    }
  }

  const imutavel = achados[0]?.imutavel ?? false;
  const processamentoId = achados[0]?.processamento_id ?? null;

  async function aprovar() {
    if (!processamentoId) return;
    try {
      const { error } = await (supabase as any).rpc("psico_ind_aprovar_processamento", { p_processamento: processamentoId });
      if (error) throw error;
      toast.success("Processamento aprovado e tornado imutável.");
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao aprovar: " + (e?.message || "erro"));
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
              <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Imutável</Badge>
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
    if (novoEstado === a.estado_final) return;
    if (!just.trim()) { toast.error("Informe a justificativa da alteração."); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("psico_ind_alterar_classificacao", {
        p_achado: a.id, p_novo_estado: novoEstado, p_justificativa: just.trim(),
      });
      if (error) throw error;
      toast.success("Classificação atualizada.");
      setJust("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao alterar classificação.");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-medium">{fatorLabel(a.fator_codigo)}</div>
        <Badge className={info.tone}>{info.label}</Badge>
        {a.necessita_acao && <Badge variant="outline" className="text-orange-700 border-orange-300 gap-1"><AlertTriangle className="h-3 w-3" /> requer ação</Badge>}
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
            <Label className="text-xs">Justificativa (obrigatória ao alterar)</Label>
            <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Descreva a base clínica/organizacional da alteração." />
          </div>
          <div className="pt-5">
            <Button size="sm" onClick={salvar} disabled={saving || novoEstado === a.estado_final}>Salvar</Button>
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
