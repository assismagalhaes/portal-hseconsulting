import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Circle } from "lucide-react";
import {
  STATUS_REVISAO_COLOR, STATUS_REVISAO_LABEL, RevisaoStatus,
  traduzirErro, validarRevisao, getRevisaoAtiva,
} from "@/lib/psicoRevisao";
import { PLANO_STATUS_COLOR, PLANO_STATUS_LABEL, PlanoStatus, getPlanoPorRevisao } from "@/lib/psicoPlano";
import PsicoSeloAprovacao from "./PsicoSeloAprovacao";

/**
 * Painel consolidado de aprovação: mostra estado da revisão, do plano, checklist agregado
 * e selo do aprovador quando concluído. Puro visual — a ação de aprovar segue no
 * PsicoRevisaoTab (onde o fluxo transacional está implementado).
 */
export default function PsicoAprovacaoConsolidada({
  avaliacaoId, avaliacaoCodigo, refreshKey,
}: {
  avaliacaoId: string;
  avaliacaoCodigo: string;
  refreshKey?: any;
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
    const items = [
      { key: "RESPONSAVEL_TECNICO_AUSENTE", label: "Responsável técnico definido" },
      { key: "CONCLUSAO_INCOMPLETA", label: "Conclusão técnica preenchida (≥50 caracteres)" },
      { key: "LIMITACOES_INCOMPLETAS", label: "Limitações descritas" },
      { key: "FATOR_SIGNIFICATIVO_SEM_ACAO", label: "Todos os fatores significativos com ação" },
    ];
    return items.map((i) => ({ ...i, ok: !set.has(i.key) }));
  }, [val]);

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

          <div className="md:col-span-3 space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Checklist técnico</div>
            <ul className="text-sm space-y-1.5">
              {[...checklist, ...detalheItens].map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className={c.ok ? "" : "text-destructive"}>{c.label}</span>
                </li>
              ))}
              {!val && <li className="text-xs text-muted-foreground flex items-center gap-2"><Circle className="h-3 w-3" /> Calculando validação…</li>}
            </ul>
          </div>
        </CardContent>
      </Card>

      {val && !val.valido && !aprovada && (val.erros || []).length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Pendências que impedem a aprovação</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 text-sm">
              {(val.erros as string[]).map((e, i) => <li key={i}>{traduzirErro(e)}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
