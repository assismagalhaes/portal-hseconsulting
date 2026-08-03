import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Circle, ClipboardCheck, ShieldCheck } from "lucide-react";
import {
  STATUS_REVISAO_COLOR, STATUS_REVISAO_LABEL, RevisaoStatus,
  traduzirErro, validarRevisao, getRevisaoAtiva,
} from "@/lib/psicoRevisao";
import { separarErrosPorEtapa } from "@/lib/psicoRevisaoGates";
import { PLANO_STATUS_COLOR, PLANO_STATUS_LABEL, PlanoStatus, getPlanoPorRevisao } from "@/lib/psicoPlano";
import PsicoSeloAprovacao from "./PsicoSeloAprovacao";

/**
 * Painel consolidado de aprovação: mostra estado da revisão, do plano, checklist agregado
 * e selo do aprovador quando concluído. Puro visual — a ação de aprovar segue no
 * PsicoRevisaoTab (onde o fluxo transacional está implementado).
 */
export default function PsicoAprovacaoConsolidada({
  avaliacaoId, avaliacaoCodigo, refreshKey, etapa = "revisao",
}: {
  avaliacaoId: string;
  avaliacaoCodigo: string;
  refreshKey?: any;
  etapa?: "plano" | "revisao";
}) {
  const [revisao, setRevisao] = useState<any>(null);
  const [plano, setPlano] = useState<any>(null);
  const [val, setVal] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getRevisaoAtiva(avaliacaoId);
      if (cancelled) return;
      setRevisao(r);
      if (!r) { setPlano(null); setVal(null); return; }
      const p = await getPlanoPorRevisao(r.id);
      if (cancelled) return;
      setPlano(p);
      const { data, error } = await validarRevisao(r.id);
      if (!cancelled) {
        setVal(error ? {
          valido: false,
          erros: ["VALIDACAO_INDISPONIVEL"],
          avisos: [],
          fatores_significativos: null,
          itens: null,
        } : data);
      }
    })();
    return () => { cancelled = true; };
  }, [avaliacaoId, refreshKey]);

  const checklist = useMemo(() => {
    if (!val) return [];
    const erros: string[] = val.erros || [];
    const set = new Set(erros);
    const itemsRevisao = [
      { key: "RESPONSAVEL_TECNICO_AUSENTE", label: "Responsável técnico definido" },
      { key: "CONCLUSAO_INCOMPLETA", label: "Conclusão técnica preenchida (≥50 caracteres)" },
      { key: "LIMITACOES_INCOMPLETAS", label: "Limitações descritas" },
      { key: "FATOR_SIGNIFICATIVO_SEM_ACAO", label: "Fatores com ação recomendada possuem medida vinculada" },
    ];
    const itemsPlano = [
      { key: "FATOR_SIGNIFICATIVO_SEM_ACAO", label: "Fatores com ação recomendada possuem medida vinculada" },
    ];
    return (etapa === "plano" ? itemsPlano : itemsRevisao)
      .map((i) => ({ ...i, ok: !set.has(i.key) }));
  }, [etapa, val]);

  const detalheItens = useMemo(() => {
    if (!val) return [] as { label: string; ok: boolean }[];
    const erros: string[] = val.erros || [];
    const findQt = (prefix: string) => erros.find((e) => e.startsWith(prefix))?.split(":")[1];
    const semResp = findQt("ITENS_SEM_RESPONSAVEL:");
    const semPrazo = findQt("ITENS_SEM_PRAZO:");
    const semEvid = findQt("ITENS_SEM_EVIDENCIA:");
    return [
      { label: "Itens selecionados com responsável", ok: !semResp },
      { label: "Itens selecionados com prazo", ok: !semPrazo },
      { label: "Itens selecionados com evidência", ok: !semEvid },
    ];
  }, [val]);

  if (!revisao) return null;

  const statusRev: RevisaoStatus = revisao.status;
  const statusPlano: PlanoStatus | null = plano?.status || null;
  const aprovada = statusRev === "aprovada";
  const erros: string[] = val?.erros || [];
  const errosPorEtapa = separarErrosPorEtapa(erros);
  const errosBloqueantes = errosPorEtapa.plano;
  const planoSemAcoesValido = etapa === "plano"
    && val?.itens === 0
    && errosPorEtapa.plano.length === 0;
  const checklistCompleto = [...checklist, ...detalheItens].every((item) => item.ok);

  return (
    <div className="space-y-3">
      {aprovada && (
        <PsicoSeloAprovacao
          avaliacaoCodigo={avaliacaoCodigo}
          aprovadaEm={revisao.aprovada_em}
          snapshot={revisao.responsavel_snapshot}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consolidação da aprovação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Revisão técnica</div>
            <Badge className={STATUS_REVISAO_COLOR[statusRev]}>{STATUS_REVISAO_LABEL[statusRev]}</Badge>
            <div className="text-xs text-muted-foreground">Versão {revisao.versao} · Modo {revisao.modo}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Plano de ação</div>
            {statusPlano ? <Badge className={PLANO_STATUS_COLOR[statusPlano]}>{PLANO_STATUS_LABEL[statusPlano]}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
            {val && <div className="text-xs text-muted-foreground">{val.itens} ação(ões) selecionada(s)</div>}
          </div>
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fatores significativos</div>
            <div className="text-lg font-semibold">{val?.fatores_significativos ?? "—"}</div>
            <div className="text-xs text-muted-foreground">de 7 fatores avaliados</div>
          </div>

          <div className="md:col-span-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Checklist técnico</div>
              {val && checklistCompleto && (
                <Badge variant="outline" className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-700">
                  Verificações atendidas
                </Badge>
              )}
            </div>
            {!val ? (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                <Circle className="h-3 w-3" /> Calculando validação…
              </div>
            ) : checklistCompleto ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Não há pendência técnica nesta etapa. Os detalhes reaparecem somente quando exigirem atenção.
              </p>
            ) : (
              <ul className="mt-2 grid gap-1.5 text-sm md:grid-cols-2">
                {[...checklist, ...detalheItens].filter((c) => !c.ok).map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {planoSemAcoesValido && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-emerald-950 dark:text-emerald-100">Plano preventivo sem ação obrigatória</h3>
              <p className="mt-1 text-sm text-emerald-900/75 dark:text-emerald-200/75">
                Nenhum fator exige ação corretiva. O plano pode seguir sem itens; os tratamentos de manutenção
                e monitoramento preventivo continuam registrados por fator.
              </p>
            </div>
          </div>
        </div>
      )}

      {etapa === "plano" && errosBloqueantes.length > 0 && !aprovada && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Pendências que impedem revisar o plano</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 text-sm">
              {errosBloqueantes.map((e, i) => <li key={i}>{traduzirErro(e)}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

    </div>
  );
}
