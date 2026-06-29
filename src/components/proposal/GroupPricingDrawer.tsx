import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { PercentInput } from "@/components/ui/percent-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CheckCircle2, AlertTriangle, Calculator, DollarSign, Clock } from "lucide-react";
import { brl, pct } from "@/lib/format";
import { MoneyInput } from "@/components/ui/money-input";
import { statusMargemMeta } from "@/lib/pricing";
import {
  computeGroup,
  custoDiretoLabel,
  custosDiretosCategorias,
  horaTecnicaLabel,
  horasTecnicasCategorias,
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
  items: any[];
  existingPricings: Record<string, any>;
  params: any;
  onApplied: () => void;
};

type DiretoRow = { id: string; categoria: string; descricao: string; valor: number; observacao: string };
type HoraRow = { id: string; categoria: string; descricao: string; horas: number; observacao: string };

export default function GroupPricingDrawer({
  open, onClose, proposalId, clientFuncionarios, items, existingPricings, params, onApplied,
}: Props) {
  const custoHoraLegado = params.horas_produtivas_mes > 0
    ? Number(params.custo_fixo_mensal || 0) / Number(params.horas_produtivas_mes)
    : 0;
  const valorHoraTecnica = Number(params.valor_hora_tecnica || 0) > 0
    ? Number(params.valor_hora_tecnica)
    : 35;

  const [regra, setRegra] = useState<RateioRegra>("igual");
  const [regraHoras, setRegraHoras] = useState<RateioRegra>("igual");
  const [observacoes, setObservacoes] = useState("");
  const [motivo, setMotivo] = useState("");
  const [diretos, setDiretos] = useState<DiretoRow[]>([]);
  const [horasShared, setHorasShared] = useState<HoraRow[]>([]);
  const [aliquotaPadrao, setAliquotaPadrao] = useState<number>(Number(params.aliquota_imposto || 0.1));
  const [margemPadrao] = useState<number>(Number(params.margem_minima || 0.2));
  const [drafts, setDrafts] = useState<Record<string, GroupItemInput>>({});

  useEffect(() => {
    if (!open) return;
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
        peso_manual: 100 / Math.max(1, items.length),
      };
    });
    setDrafts(map);
    setDiretos([]);
    setHorasShared([]);
    setObservacoes("");
    setMotivo("");
    setRegra("igual");
    setRegraHoras("igual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.map((i) => i.id).join(",")]);

  const totalDiretos = diretos.reduce((a, c) => a + (Number(c.valor) || 0), 0);
  const totalHoras = horasShared.reduce((a, c) => a + (Number(c.horas) || 0), 0);
  const totalCustoHoras = totalHoras * valorHoraTecnica;

  const groupInputs = items.map((it) => drafts[it.id]).filter(Boolean);

  const computed = useMemo(() => {
    if (groupInputs.length === 0) return null;
    return computeGroup(groupInputs, {
      regra,
      regra_horas: regraHoras,
      custos_compartilhados_total: totalDiretos,
      horas_compartilhadas_total: totalHoras,
      valor_hora_tecnica: valorHoraTecnica,
      custo_hora_interno: custoHoraLegado,
      custo_por_vida: Number(params.custo_por_vida || 0),
      arredondamento: Number(params.arredondamento || 1),
      markup_minimo: Number(params.markup_minimo || 1.5),
      margem_minima: Number(params.margem_minima || 0.2),
    });
  }, [groupInputs, regra, regraHoras, totalDiretos, totalHoras, valorHoraTecnica, custoHoraLegado, params]);

  function setItem(id: string, patch: Partial<GroupItemInput>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function addDireto() {
    setDiretos((s) => [...s, { id: crypto.randomUUID(), categoria: "deslocamento", descricao: "", valor: 0, observacao: "" }]);
  }
  function addHora() {
    setHorasShared((s) => [...s, { id: crypto.randomUUID(), categoria: "elaboracao", descricao: "", horas: 0, observacao: "" }]);
  }

  async function applyToProposal() {
    if (!computed) return;
    try {
      const { data: sim, error: simErr } = await supabase.from("simulacoes_precificacao").insert({
        proposal_id: proposalId,
        tipo: "agrupada",
        regra_rateio: regra,
        regra_rateio_horas: regraHoras,
        valor_hora_tecnica_aplicado: valorHoraTecnica,
        observacoes,
        motivo,
        aplicada: true,
        aplicada_em: new Date().toISOString(),
        totais: computed.totals as any,
        parametros: { custo_hora_interno: custoHoraLegado, valorHoraTecnica, aliquotaPadrao, margemPadrao } as any,
      }).select("*").single();
      if (simErr) throw simErr;

      const sharedRows: any[] = [];
      diretos.forEach((d) => sharedRows.push({
        simulacao_id: sim.id, tipo_custo: "direto", categoria: d.categoria,
        descricao: d.descricao, valor: d.valor, observacao: d.observacao,
      }));
      horasShared.forEach((h) => sharedRows.push({
        simulacao_id: sim.id, tipo_custo: "hora_tecnica", categoria: h.categoria,
        descricao: h.descricao, valor: h.horas * valorHoraTecnica,
        horas: h.horas, valor_hora: valorHoraTecnica, observacao: h.observacao,
      }));
      if (sharedRows.length) await supabase.from("simulacao_custos_compartilhados").insert(sharedRows);

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
          custo_compartilhado_rateado: r.custo_compartilhado_rateado + r.custo_horas_rateado,
          custo_total: r.custo_total,
          preco_sugerido: r.preco_sugerido,
          preco_final: r.preco_final,
          lucro_estimado: r.lucro_estimado,
          margem_liquida: r.margem_liquida,
          markup: r.markup,
          status_margem: r.status_margem,
          indicadores: { ...r.pricing, horas_rateadas: r.horas_rateadas, custo_horas_rateado: r.custo_horas_rateado } as any,
        };
      });
      await supabase.from("simulacao_itens").insert(itensPayload);

      const histRows: any[] = [];
      for (const r of computed.perItem) {
        const item = items.find((x) => x.id === r.proposal_item_id);
        if (!item) continue;
        const qtd = Math.max(1, Number(item.quantidade) || 1);
        const novoUnit = Number((r.preco_final / qtd).toFixed(2));
        const valorAnt = Number(item.valor_unitario || 0) * qtd;

        await supabase.from("proposal_items").update({
          valor_unitario: novoUnit, valor_total: novoUnit * qtd,
        }).eq("id", item.id);

        const inp = drafts[r.proposal_item_id];
        const pricingPayload = {
          proposal_item_id: item.id,
          custos: { ...inp.custos_individuais, _rateio_grupo: r.custo_compartilhado_rateado, _rateio_horas: r.custo_horas_rateado },
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
        if (existing) await supabase.from("proposal_item_pricing").update(pricingPayload).eq("id", existing.id);
        else await supabase.from("proposal_item_pricing").insert(pricingPayload);

        histRows.push({
          proposal_id: proposalId,
          simulacao_id: sim.id,
          proposal_item_id: item.id,
          acao: "aplicada_grupo",
          motivo,
          valor_anterior: valorAnt,
          valor_novo: r.preco_final,
          detalhes: { regra, regra_horas: regraHoras, rateado: r.custo_compartilhado_rateado, horas_rateadas: r.horas_rateadas } as any,
        });
      }
      if (histRows.length) await supabase.from("historico_precificacao").insert(histRows);

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
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
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

          {/* === BLOCO 1: CUSTOS DIRETOS === */}
          <section className="space-y-2 border border-border rounded-md p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Custos diretos (R$)
              </h3>
              <Button size="sm" variant="outline" onClick={addDireto}><Plus className="h-3 w-3 mr-1" /> Adicionar custo direto</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Valores pagos a terceiros ou consumidos no serviço (deslocamento, hospedagem, ART, EPI…).</p>
            {diretos.map((s) => (
              <div key={s.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  <Label className="text-[11px]">Categoria</Label>
                  <Select value={s.categoria} onValueChange={(v) => setDiretos((arr) => arr.map((x) => x.id === s.id ? { ...x, categoria: v } : x))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{custosDiretosCategorias.map((c) => <SelectItem key={c} value={c}>{custoDiretoLabel[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Label className="text-[11px]">Descrição</Label>
                  <Input className="h-8" value={s.descricao} onChange={(e) => setDiretos((arr) => arr.map((x) => x.id === s.id ? { ...x, descricao: e.target.value } : x))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-[11px]">Valor</Label>
                  <MoneyInput className="h-8" value={s.valor}
                    onChange={(v) => setDiretos((arr) => arr.map((x) => x.id === s.id ? { ...x, valor: v } : x))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-[11px]">Observação</Label>
                  <Input className="h-8" value={s.observacao} onChange={(e) => setDiretos((arr) => arr.map((x) => x.id === s.id ? { ...x, observacao: e.target.value } : x))} />
                </div>
                <Button variant="ghost" size="icon" className="col-span-1 h-8" onClick={() => setDiretos((arr) => arr.filter((x) => x.id !== s.id))}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
              <span className="text-muted-foreground">
                Regra:&nbsp;
                <Select value={regra} onValueChange={(v) => setRegra(v as RateioRegra)}>
                  <SelectTrigger className="inline-flex h-7 w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(rateioRegraLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </span>
              <span>Subtotal: <span className="font-mono font-semibold">{brl(totalDiretos)}</span></span>
            </div>
          </section>

          {/* === BLOCO 2: HORAS TÉCNICAS === */}
          <section className="space-y-2 border border-border rounded-md p-3 bg-secondary/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-secondary" /> Horas técnicas HSE
              </h3>
              <Button size="sm" variant="outline" onClick={addHora}><Plus className="h-3 w-3 mr-1" /> Adicionar horas técnicas</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Esforço interno da equipe. Convertido automaticamente em custo usando&nbsp;
              <span className="font-mono font-semibold">{brl(valorHoraTecnica)}/h</span> (Configurações → Precificação).
            </p>
            {horasShared.map((s) => {
              const custo = (Number(s.horas) || 0) * valorHoraTecnica;
              return (
                <div key={s.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-[11px]">Categoria</Label>
                    <Select value={s.categoria} onValueChange={(v) => setHorasShared((arr) => arr.map((x) => x.id === s.id ? { ...x, categoria: v } : x))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{horasTecnicasCategorias.map((c) => <SelectItem key={c} value={c}>{horaTecnicaLabel[c]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[11px]">Descrição</Label>
                    <Input className="h-8" value={s.descricao} onChange={(e) => setHorasShared((arr) => arr.map((x) => x.id === s.id ? { ...x, descricao: e.target.value } : x))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[11px]">Horas</Label>
                    <Input className="h-8 text-right font-mono" type="number" step="0.5" value={s.horas}
                      onChange={(e) => setHorasShared((arr) => arr.map((x) => x.id === s.id ? { ...x, horas: Number(e.target.value) || 0 } : x))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[11px]">Custo calculado</Label>
                    <Input className="h-8 text-right font-mono bg-muted" disabled value={brl(custo)} />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-[11px]">Obs.</Label>
                    <Input className="h-8" value={s.observacao} onChange={(e) => setHorasShared((arr) => arr.map((x) => x.id === s.id ? { ...x, observacao: e.target.value } : x))} />
                  </div>
                  <Button variant="ghost" size="icon" className="col-span-1 h-8" onClick={() => setHorasShared((arr) => arr.filter((x) => x.id !== s.id))}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              );
            })}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
              <span className="text-muted-foreground">
                Regra:&nbsp;
                <Select value={regraHoras} onValueChange={(v) => setRegraHoras(v as RateioRegra)}>
                  <SelectTrigger className="inline-flex h-7 w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(rateioRegraLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </span>
              <div className="flex items-center gap-4">
                <span><span className="text-muted-foreground">Horas totais:</span> <span className="font-mono font-semibold">{totalHoras}h</span></span>
                <span><span className="text-muted-foreground">Custo total:</span> <span className="font-mono font-semibold">{brl(totalCustoHoras)}</span></span>
              </div>
            </div>
          </section>

          {/* Imposto padrão */}
          <section className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Imposto padrão (%)</Label>
              <PercentInput value={aliquotaPadrao} onChange={(n) => setAliquotaPadrao(n)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Motivo / referência desta simulação</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Revisão comercial, ajuste de margem, contraproposta…" />
            </div>
          </section>

          {/* Detalhe por serviço */}
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Detalhe por serviço</h3>
            <div className="border border-border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-2 py-2">Serviço</th>
                    <th className="text-right px-2 py-2">Custos próprios</th>
                    <th className="text-right px-2 py-2">Horas próprias</th>
                    <th className="text-right px-2 py-2">Margem %</th>
                    {(regra === "manual" || regraHoras === "manual") && <th className="text-right px-2 py-2">Peso %</th>}
                    <th className="text-right px-2 py-2">Diretos rateados</th>
                    <th className="text-right px-2 py-2">Horas rateadas</th>
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
                          <Input className="h-7 text-right font-mono" type="number" step="0.01" value={sumC}
                            onChange={(e) => setItem(it.id, { custos_individuais: { total: Number(e.target.value) || 0 } })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-7 text-right font-mono" type="number" step="0.5" value={sumH}
                            onChange={(e) => setItem(it.id, { horas: { total: Number(e.target.value) || 0 } })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <PercentInput className="h-7" value={d.margem_desejada}
                            onChange={(n) => setItem(it.id, { margem_desejada: n })} />
                        </td>
                        {(regra === "manual" || regraHoras === "manual") && (
                          <td className="px-2 py-1.5">
                            <PercentInput className="h-7" decimal={false} precision={1} value={d.peso_manual}
                              onChange={(n) => setItem(it.id, { peso_manual: n })} />
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-right font-mono">{brl(r?.custo_compartilhado_rateado || 0)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{brl(r?.custo_horas_rateado || 0)} <span className="text-[10px] text-muted-foreground">({(r?.horas_rateadas || 0).toFixed(1)}h)</span></td>
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
          </section>

          {/* Totais do grupo */}
          {computed && (
            <Card><CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold">Indicadores do grupo</h3>
                {meta && <Badge className={`border ${meta.color}`}>{meta.label}</Badge>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Custos diretos (rateados)" v={brl(computed.totals.custo_compartilhado_total)} />
                <Kpi label="Horas técnicas (rateadas)" v={`${computed.totals.horas_compartilhadas_total}h · ${brl(computed.totals.custo_horas_compartilhadas_total)}`} />
                <Kpi label="Custo próprio dos itens" v={brl(computed.totals.custo_individual_total)} />
                <Kpi label="Custo geral" v={brl(computed.totals.custo_geral)} />
                <Kpi label="Receita total" v={brl(computed.totals.receita_total)} />
                <Kpi label="Imposto estimado" v={brl(computed.totals.imposto_estimado)} />
                <Kpi label="Lucro previsto" v={brl(computed.totals.lucro_total)} />
                <Kpi label="Margem · Markup" v={`${pct(computed.totals.margem_liquida)} · ${computed.totals.markup_medio.toFixed(2)}x`} />
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
      <p className="font-mono font-semibold text-sm">{v}</p>
    </div>
  );
}