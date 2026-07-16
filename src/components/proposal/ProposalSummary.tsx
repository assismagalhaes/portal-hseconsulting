// Componentes de resumo comercial do ProposalEditor (Row, InternalSummary,
// ResumoValor) e utilitário `calcDescontoRevisao`. Extraído de
// `src/pages/ProposalEditor.tsx` sem alteração de comportamento.
import { brl, pct } from "@/lib/format";

export function Row({ label, children }: any) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function InternalSummary({ items, pricings, descontoRevisao = 0 }: any) {
  let custoTotal = 0, lucroTotal = 0, receita = 0, imposto = 0;
  items.forEach((it: any) => {
    const p = pricings[it.id];
    if (!p?.indicadores) return;
    // Indicadores são calculados por UNIDADE. Escala pela quantidade do item na proposta
    // para que Custo / Impostos / Receita / Lucro reflitam o total real (mesma base do "Valor total").
    const qtd = Math.max(1, Number(it.quantidade) || 1);
    custoTotal += Number(p.indicadores.custo_total || 0) * qtd;
    lucroTotal += Number(p.indicadores.lucro_estimado || 0) * qtd;
    receita    += Number(p.indicadores.receita_liquida || 0) * qtd;
    imposto    += Number(p.indicadores.imposto_estimado || 0) * qtd;
  });
  const desc = Number(descontoRevisao) || 0;
  const receitaFinal = Math.max(0, receita - desc);
  const lucroFinal = lucroTotal - desc;
  const margem = receitaFinal > 0 ? lucroFinal / receitaFinal : 0;
  return (
    <div className="space-y-2">
      <Row label="Custo total interno"><span className="font-mono">{brl(custoTotal)}</span></Row>
      <Row label="Impostos estimados"><span className="font-mono">{brl(imposto)}</span></Row>
      <Row label="Receita líquida"><span className="font-mono">{brl(receita)}</span></Row>
      {desc > 0 && (
        <>
          <Row label="Desconto (revisão)"><span className="font-mono text-danger">- {brl(desc)}</span></Row>
          <Row label="Receita líquida final"><span className="font-mono font-semibold">{brl(receitaFinal)}</span></Row>
        </>
      )}
      <Row label={desc > 0 ? "Lucro estimado (com desconto)" : "Lucro estimado"}>
        <span className={`font-mono ${lucroFinal < 0 ? "text-danger" : ""}`}>{brl(lucroFinal)}</span>
      </Row>
      <Row label="Margem média"><span className={`font-mono ${margem < 0 ? "text-danger" : ""}`}>{pct(margem)}</span></Row>
    </div>
  );
}

export function calcDescontoRevisao(subtotal: number, revisions: any[]): number {
  if (!revisions?.length) return 0;
  const ord = [...revisions].sort((a, b) => Number(b.revisao || 0) - Number(a.revisao || 0));
  const rev = ord.find((r) => r.status === "aprovada") || ord[0];
  if (!rev || rev.valor_novo == null || rev.valor_anterior == null) return 0;
  // Só considera desconto real quando houve redução entre valor anterior e novo da própria revisão.
  // Evita interpretar "emissão inicial" ou adição de itens após a revisão como desconto.
  if (rev.tipo && rev.tipo !== "desconto") return 0;
  const novo = Number(rev.valor_novo);
  const ant = Number(rev.valor_anterior);
  return ant > novo ? ant - novo : 0;
}

export function ResumoValor({ total, revisions }: { total: number; revisions: any[] }) {
  const desc = calcDescontoRevisao(total, revisions);
  if (!desc) {
    return <Row label="Valor total"><span className="font-mono font-semibold text-primary">{brl(total)}</span></Row>;
  }
  const final = total - desc;
  const ord = [...revisions].sort((a, b) => Number(b.revisao || 0) - Number(a.revisao || 0));
  const rev = ord.find((r: any) => r.status === "aprovada") || ord[0];
  return (
    <>
      <Row label="Subtotal"><span className="font-mono">{brl(total)}</span></Row>
      <Row label={`Desconto (Rev. ${String(rev.revisao).padStart(2, "0")})`}>
        <span className="font-mono text-danger">- {brl(desc)}</span>
      </Row>
      <Row label="Valor final">
        <span className="font-mono font-semibold text-primary">{brl(final)}</span>
      </Row>
    </>
  );
}