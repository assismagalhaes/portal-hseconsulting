import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CheckCircle2, AlertTriangle, Calculator } from "lucide-react";
import { brl, pct } from "@/lib/format";
import { statusMargemMeta } from "@/lib/pricing";
import {
  computeGroup,
  custoCompartilhadoLabel,
  custosCompartilhadosCategorias,
  rateioRegraLabel,
  type GroupItemInput,
  type RateioRegra,
} from "@/lib/groupPricing";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  proposalId: string;
  clientFuncionarios: number;
  items: any[];                       // proposal_items selecionados
  existingPricings: Record<string, any>;
  params: any;
  onApplied: () => void;
};

type SharedCost = { id: string; categoria: string; descricao: string; valor: number };

export default function GroupPricingDrawer({
  open, onClose, proposalId, clientFuncionarios, items, existingPricings, params, onApplied,
}: Props) {
  const custoHora = params.horas_produtivas_mes > 0
    ? Number(params.custo_fixo_mensal || 0) / Number(params.horas_produtivas_mes)
    : 0;

  const [regra, setRegra] = useState<RateioRegra>("igual");
  const [observacoes, setObservacoes] = useState("");
  const [shared, setShared] = useState<SharedCost[]>([]);
  const [aliquotaPadrao, setAliquotaPadrao] = useState<number>(Number(params.aliquota_imposto || 0.1));
  const [margemPadrao, setMargemPadrao] = useState<number>(Number(params.margem_minima || 0.2));
  const [drafts, setDrafts] = useState<Record<string, GroupItemInput>>({});

  useEffect(() => {
    if (!open) return;
    // Inicializa drafts a partir das simulações individuais existentes (se houver)
    const map: Record<string, GroupItemInput> = {};
    items.forEach((it) => {
      const p = existingPricings[it.id];
      map[it.id] = {
        proposal_item_id: it.id,
        nome: it.descricao_comercial || it.nome || "Serviço",
        quantidade: Number(it.quantidade) || 1,
        valor_venda_atual: Number(it.valor_total) || 0,
        custos_individuais: { ...(p?.custos || {}) },
        horas: { ...(p?.horas || {}) },
        qtd_funcionarios: clientFuncionarios || 0,
        margem_desejada: Number(p?.margem_desejada ?? margemPadrao),
        aliquota_imposto: Number(p?.aliquota_imposto ?? aliquotaPadrao),
        lucro_desejado: Number(p?.lucro_desejado || 0),
        desconto_comercial: Number(p?.desconto_comercial || 0),
        peso_manual: 100 / items.length,
      };
    });
    setDrafts(map);
    setShared([]);
    setObservacoes("");
    setRegra("igual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.map((i) => i.id).join(",")]);

  const totalCompart = shared.reduce((a, c) => a + (Number(c.valor) || 0), 0);

  const groupInputs = items.map((it) => drafts[it.id]).filter(Boolean);

  const computed = useMemo(() => {
    if (groupInputs.length === 0) return null;
    return computeGroup(groupInputs, {
      regra,
      custos_compartilhados_total: totalCompart,
      custo_hora_interno: custoHora,
      custo_por_vida: Number(params.custo_por_vida || 0),
      arredondamento: Number(params.arredondamento || 1),
      markup_minimo: Number(params.markup_minimo || 1.5),
      margem_minima: Number(params.margem_minima || 0.2),
    });
  }, [groupInputs, regra, totalCompart, custoHora, params]);

  function setItem(id: string, patch: Partial<GroupItemInput>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function addShared() {
    setShared((s) => [...s, { id: crypto.randomUUID(), categoria: "deslocamento", descricao: "", valor: 0 }]);
  }

  async function applyToProposal() {
    if (!computed) return;
    try {
      const { data: sim, error: simErr } = await supabase.from("simulacoes_precificacao").insert({
        proposal_id: proposalId,
        tipo: "agrupada",
        regra_rateio: regra,
        observacoes,
        aplicada: true,
        aplicada_em: new Date().toISOString(),
        totais: computed.totals as any,
        parametros: { custo_hora_interno: custoHora, aliquotaPadrao, margemPadrao } as any,
      }).select("*").single();
      if (simErr) throw simErr;

      if (shared.length) {
        await supabase.from("simulacao_custos_compartilhados").insert(
          shared.map((s) => ({ simulacao_id: sim.id, categoria: s.categoria, descricao: s.descricao, valor: s.valor }))
        );
      }

      const itensPayload = computed.perItem.map((r) => {
        const inp = drafts[r.proposal_item_id];
        return {
          simulacao_id: sim.id,
          proposal_item_id: r.proposal_item_id,
          custos_individuais: inp.custos_individuais,
          horas: inp.horas,
          qtd_funcionarios: inp.qtd_funcionarios,
          margem_desejada: inp.margem_desejada,
          aliquota_imposto: inp.aliquota_imposto,
          lucro_desejado: inp.lucro_desejado,
          desconto_comercial: inp.desconto_comercial,
          peso_manual: inp.peso_manual,
          custo_individual: r.custo_individual,
          custo_compartilhado_rateado: r.custo_compartilhado_rateado,
          custo_total: r.custo_total,
          preco_sugerido: r.preco_sugerido,
          preco_final: r.preco_final,
          lucro_estimado: r.lucro_estimado,
          margem_liquida: r.margem_liquida,
          markup: r.markup,
          status_margem: r.status_margem,
          indicadores: r.pricing as any,
        };
      });
      await supabase.from("simulacao_itens").insert(itensPayload);

      // Atualiza valor unitário e cria/atualiza proposal_item_pricing
      const histRows: any[] = [];
      for (const r of computed.perItem) {
        const item = items.find((x) => x.id === r.proposal_item_id);
        if (!item) continue;
        const qtd = Math.max(1, Number(item.quantidade) || 1);
        const novoUnit = Number((r.preco_final / qtd).toFixed(2));
        const valorAnt = Number(item.valor_unitario || 0) * qtd;

        await supabase.from("proposal_items").update({
          valor_unitario: novoUnit,
          valor_total: novoUnit * qtd,
        }).eq("id", item.id);

        const inp = drafts[r.proposal_item_id];
        const pricingPayload = {
          proposal_item_id: item.id,
          custos: { ...inp.custos_individuais, _rateio_grupo: r.custo_compartilhado_rateado },
          horas: inp.horas,
          aliquota_imposto: inp.aliquota_imposto,
          margem_desejada: inp.margem_desejada,
          lucro_desejado: inp.lucro_desejado,
          desconto_comercial: inp.desconto_comercial,
          preco_sugerido: r.preco_sugerido,
          preco_arredondado: r.preco_final,
          preco_aprovado: r.preco_final,
          indicadores: r.pricing as any,
        };
        const existing = existingPricings[item.id];
        if (existing) {
          await supabase.from("proposal_item_pricing").update(pricingPayload).eq("id", existing.id);
        } else {
          await supabase.from("proposal_item_pricing").insert(pricingPayload);
        }

        histRows.push({
          proposal_id: proposalId,
          simulacao_id: sim.id,
          proposal_item_id: item.id,
          acao: "aplicada_grupo",
          valor_anterior: valorAnt,
          valor_novo: r.preco_final,
          detalhes: { regra, rateado: r.custo_compartilhado_rateado } as any,
        });
      }
      if (histRows.length) await supabase.from("historico_precificacao").insert(histRows);

      // Recalcula valor_total da proposta
      const { data: allItems } = await supabase.from("proposal_items").select("valor_total").eq("proposal_id", proposalId);
      const novoTotal = (allItems || []).reduce((a: number, b: any) => a + Number(b.valor_total || 0), 0);
      await supabase.from("proposals").update({ valor_total: novoTotal }).eq("id", proposalId);

      toast.success(`Simulação aplicada a ${computed.perItem.length} serviço(s)`);
      onApplied();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Falha ao aplicar simulação");
    }
  }

  const meta = computed ? statusMargemMeta[computed.totals.status_margem] : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Calcular custos em grupo · {items.length} serviço(s)
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Itens selecionados */}
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Serviços incluídos</h3>
            <div className="space-y-1">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-1.5">
                  <span className="truncate"><Badge variant="outline" className="font-mono mr-2">#{it.numero_item}</Badge>{it.descricao_comercial}</span>
                  <span className="text-xs text-muted-foreground">Qtd {it.quantidade} · {brl(it.valor_total)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Custos compartilhados */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Custos compartilhados</h3>
              <Button size="sm" variant="outline" onClick={addShared}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
            </div>
            {shared.length === 0 && (
              <p className="text-xs text-muted-foreground">Adicione custos comuns (deslocamento, hospedagem, ART…) — serão distribuídos entre os serviços.</p>
            )}
            {shared.map((s) => (
              <div key={s.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Label className="text-[11px]">Categoria</Label>
                  <Select value={s.categoria} onValueChange={(v) => setShared((arr) => arr.map((x) => x.id === s.id ? { ...x, categoria: v } : x))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{custosCompartilhadosCategorias.map((c) => <SelectItem key={c} value={c}>{custoCompartilhadoLabel[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-5">
                  <Label className="text-[11px]">Descrição</Label>
                  <Input className="h-8" value={s.descricao} onChange={(e) => setShared((arr) => arr.map((x) => x.id === s.id ? { ...x, descricao: e.target.value } : x))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-[11px]">Valor</Label>
                  <Input className="h-8" type="number" step="0.01" value={s.valor}
                    onChange={(e) => setShared((arr) => arr.map((x) => x.id === s.id ? { ...x, valor: Number(e.target.value) || 0 } : x))} />
                </div>
                <Button variant="ghost" size="icon" className="col-span-1 h-8" onClick={() => setShared((arr) => arr.filter((x) => x.id !== s.id))}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
            <div className="text-right text-xs text-muted-foreground">
              Total compartilhado: <span className="font-mono font-semibold">{brl(totalCompart)}</span>
            </div>
          </section>

          {/* Regra de rateio */}
          <section className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Regra de rateio</Label>
              <Select value={regra} onValueChange={(v) => setRegra(v as RateioRegra)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(rateioRegraLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Imposto padrão</Label>
              <Input type="number" step="0.01" value={aliquotaPadrao} onChange={(e) => setAliquotaPadrao(Number(e.target.value) || 0)} />
            </div>
          </section>

          {/* Detalhe por serviço */}
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Detalhe por serviço</h3>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-2 py-2">Serviço</th>
                    <th className="text-right px-2 py-2">Custos próprios</th>
                    <th className="text-right px-2 py-2">Horas</th>
                    <th className="text-right px-2 py-2">Margem %</th>
                    {regra === "manual" && <th className="text-right px-2 py-2">Peso %</th>}
                    <th className="text-right px-2 py-2">Rateado</th>
                    <th className="text-right px-2 py-2">Custo total</th>
                    <th className="text-right px-2 py-2">Preço final</th>
                    <th className="text-right px-2 py-2">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const d = drafts[it.id];
                    if (!d) return null;
                    const r = computed?.perItem[idx];
                    const sumC = Object.values(d.custos_individuais).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                    const sumH = Object.values(d.horas).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                    const meta2 = r ? statusMargemMeta[r.status_margem] : null;
                    return (
                      <tr key={it.id} className="border-t border-border">
                        <td className="px-2 py-1.5 max-w-[180px] truncate">{d.nome}</td>
                        <td className="px-2 py-1.5">
                          <Input className="h-7 text-right" type="number" step="0.01" value={sumC}
                            onChange={(e) => setItem(it.id, { custos_individuais: { total: Number(e.target.value) || 0 } })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-7 text-right" type="number" step="0.5" value={sumH}
                            onChange={(e) => setItem(it.id, { horas: { total: Number(e.target.value) || 0 } })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-7 text-right" type="number" step="0.01" value={d.margem_desejada}
                            onChange={(e) => setItem(it.id, { margem_desejada: Number(e.target.value) || 0 })} />
                        </td>
                        {regra === "manual" && (
                          <td className="px-2 py-1.5">
                            <Input className="h-7 text-right" type="number" step="0.1" value={d.peso_manual}
                              onChange={(e) => setItem(it.id, { peso_manual: Number(e.target.value) || 0 })} />
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-right font-mono">{brl(r?.custo_compartilhado_rateado || 0)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{brl(r?.custo_total || 0)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold text-primary">{brl(r?.preco_final || 0)}</td>
                        <td className="px-2 py-1.5 text-right">
                          {meta2 && <Badge className={`border ${meta2.color} text-[10px]`}>{pct(r!.margem_liquida)}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dica: use as abas individuais para detalhar custos linha a linha. Aqui você ajusta valores agregados rapidamente.
            </p>
          </section>

          {/* Totais do grupo */}
          {computed && (
            <Card><CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold">Indicadores do grupo</h3>
                {meta && <Badge className={`border ${meta.color}`}>{meta.label}</Badge>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Custo compartilhado" v={brl(computed.totals.custo_compartilhado_total)} />
                <Kpi label="Custo individual" v={brl(computed.totals.custo_individual_total)} />
                <Kpi label="Custo geral" v={brl(computed.totals.custo_geral)} />
                <Kpi label="Receita total" v={brl(computed.totals.receita_total)} />
                <Kpi label="Imposto estimado" v={brl(computed.totals.imposto_estimado)} />
                <Kpi label="Lucro previsto" v={brl(computed.totals.lucro_total)} />
                <Kpi label="Margem líquida" v={pct(computed.totals.margem_liquida)} />
                <Kpi label="Markup médio" v={computed.totals.markup_medio.toFixed(2) + "x"} />
              </div>
            </CardContent></Card>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Observações internas</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={applyToProposal} disabled={!computed || computed.perItem.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Aplicar valores na proposta
            </Button>
          </div>

          {computed && computed.totals.status_margem === "prejuizo" && (
            <p className="text-xs text-danger flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Grupo em prejuízo — revise antes de aplicar.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold">{v}</p>
    </div>
  );
}