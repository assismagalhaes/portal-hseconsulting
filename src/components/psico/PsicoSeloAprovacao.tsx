import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";

/**
 * Selo consolidado da aprovação técnica.
 * Renderiza dados imutáveis do responsável no momento da aprovação (snapshot).
 */
export default function PsicoSeloAprovacao({
  avaliacaoCodigo,
  aprovadaEm,
  snapshot,
}: {
  avaliacaoCodigo: string;
  aprovadaEm: string | null;
  snapshot: any;
}) {
  if (!aprovadaEm || !snapshot) return null;
  return (
    <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10">
      <CardContent className="py-4 flex flex-wrap items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-emerald-600/10 grid place-items-center">
          <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            Revisão técnica aprovada — {avaliacaoCodigo}
          </div>
          <div className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
            {snapshot.nome} · {snapshot.cargo} · {snapshot.registro_profissional}
          </div>
        </div>
        <div className="text-xs text-emerald-900/70 dark:text-emerald-100/70 font-mono">
          Aprovada em {formatDateTime(aprovadaEm)}
        </div>
      </CardContent>
    </Card>
  );
}