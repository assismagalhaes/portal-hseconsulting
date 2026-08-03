import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { getPsicoDashboardResults } from "@/lib/psicoResultados";
import { fmt, fmtDateTime, AvisoMetodologico } from "./shared";

export default function MetodologiaPainel({ avaliacaoId, escopoId }: { avaliacaoId: string; escopoId: string }) {
  const dashQ = useQuery({
    queryKey: ["psico", "dashboard-resultados", avaliacaoId, escopoId],
    queryFn: () => getPsicoDashboardResults(avaliacaoId, escopoId),
    staleTime: 5 * 60 * 1000,
  });

  if (dashQ.isLoading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando…</CardContent></Card>;
  if (!dashQ.data || dashQ.data.ok === false) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Metadados indisponíveis</AlertTitle>
        <AlertDescription>{dashQ.data && dashQ.data.ok === false ? dashQ.data.message : "Não foi possível carregar."}</AlertDescription>
      </Alert>
    );
  }
  const d = dashQ.data.data;
  const proc = d.processamento;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processamento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Field label="Motor" value={proc.versao_motor} mono />
          <Field label="Hash abreviado" value={`#${proc.hash_abreviado}`} mono />
          <Field label="Processado em" value={fmtDateTime(proc.processado_em)} />
          <Field label="Questionário" value={`${proc.questionario.codigo ?? "—"} v${proc.questionario.versao ?? "—"}`} />
          <Field label="Metodologia" value={`${proc.metodologia.codigo ?? "—"} v${proc.metodologia.versao ?? "—"}`} />
          <Field label="Total de respondentes" value={String(proc.total_respondentes)} mono />
          <Field label="Total de itens" value={String(proc.total_itens)} mono />
          <Field label="Total de escopos" value={String(proc.total_escopos)} mono />
          <Field label="Escopos suprimidos" value={String(proc.escopos_suprimidos)} mono />
          <Field label="Funções elegíveis" value={String(proc.escopos_funcao_elegiveis)} mono />
          <Field label="Setores elegíveis" value={String(proc.escopos_setor_elegiveis)} mono />
          <Field label="Unidades elegíveis" value={String(proc.escopos_unidade_elegiveis)} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metodologia HSE-PSICO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Cada resposta recebe um peso de 0 a 4 conforme a escala do questionário (perguntas inversas têm o peso
            recalculado). O score médio de uma pergunta é a média aritmética dos pesos das respostas válidas. O score
            do fator é a média aritmética dos scores das perguntas do fator. O índice geral descritivo é a média
            aritmética dos scores dos fatores.
          </p>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Faixas de classificação (score 0–4)</div>
            <ul className="text-xs grid sm:grid-cols-2 lg:grid-cols-5 gap-1">
              <li>Irrelevante: 0,00 – 0,80</li>
              <li>Baixo: 0,80 – 1,60</li>
              <li>Médio: 1,60 – 2,40</li>
              <li>Alto: 2,40 – 3,20</li>
              <li>Crítico: 3,20 – 4,00</li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Critérios de significância do fator</div>
            <ul className="text-xs list-disc pl-5 space-y-0.5">
              <li><strong>Principal:</strong> % Médio + Alto + Crítico &gt; 50%.</li>
              <li><strong>Agravamento:</strong> % Alto + Crítico ≥ 30%.</li>
              <li><strong>Crítico automático:</strong> % Crítico ≥ 10% (eleva a prioridade para crítica).</li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Prioridades derivadas</div>
            <ul className="text-xs list-disc pl-5 space-y-0.5">
              <li><strong>Crítica:</strong> critério crítico automático acionado.</li>
              <li><strong>Alta:</strong> critério agravamento acionado.</li>
              <li><strong>Média:</strong> critério principal acionado.</li>
              <li><strong>Monitoramento:</strong> nenhum critério acionado.</li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Mínimos metodológicos</div>
            <p className="text-xs">
              Escopos (função, setor, unidade) só são apresentados quando atingem o mínimo metodológico definido no
              motor. Escopos abaixo do mínimo são suprimidos e contabilizados em “Escopos suprimidos”.
            </p>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Escopo atualmente exibido</div>
            <div className="text-xs">
              {d.escopo.tipo === "global" ? "Resultado geral" : `${d.escopo.tipo}: ${d.escopo.rotulo ?? "—"}`} · {d.escopo.respondentes} respondente(s) · mínimo aplicado {d.escopo.minimo_aplicado}
              {d.escopo.amostra_reduzida && " · amostra reduzida"}
            </div>
          </div>

          <AvisoMetodologico />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}