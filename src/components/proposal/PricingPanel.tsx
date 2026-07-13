import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PercentInput } from "@/components/ui/percent-input";
import { Plus, Trash2, Save } from "lucide-react";
import { brl, pct } from "@/lib/format";
import { toast } from "sonner";
import {
  computePricing,
  statusMargemMeta,
  type PricingInput,
  type CustoDiretoRow,
  type HoraTecnicaRow,
  CUSTO_CATEGORIAS,
  ATIVIDADE_CATEGORIAS,
  normalizarCustosDiretos,
  normalizarHorasTecnicas,
} from "@/lib/pricing";

const newId = () => Math.random().toString(36).slice(2, 10);

export type PricingDraft = {
  custos: CustoDiretoRow[];
  horas: HoraTecnicaRow[];
  aliquota_imposto: number;
  margem_desejada: number;
  lucro_desejado: number;
  desconto_comercial: number;
};

export default function PricingPanel({
  item,
  existing,
  params,
  clientFuncionarios = 0,
  saveLabel = "Aplicar preço ao item",
  onSave,
}: {
  item?: { quantidade?: number } | null;
  existing?: any;
  params: any;
  clientFuncionarios?: number;
  saveLabel?: string;
  onSave: (draft: PricingDraft, computed: ReturnType<typeof computePricing>) => void;
}) {
  const p = params || {};
  const custoHoraLegado = Number(p.horas_produtivas_mes) > 0 ? Number(p.custo_fixo_mensal || 0) / Number(p.horas_produtivas_mes) : 0;
  const custoHora = Number(p.valor_hora_tecnica || 0) > 0 ? Number(p.valor_hora_tecnica) : custoHoraLegado;

  const [draft, setDraft] = useState<PricingDraft>(() => existing ? {
    custos: normalizarCustosDiretos(existing.custos),
    horas: normalizarHorasTecnicas(existing.horas, custoHora),
    aliquota_imposto: Number(existing.aliquota_imposto ?? p.aliquota_imposto ?? 0.10),
    margem_desejada: Number(existing.margem_desejada ?? p.margem_minima ?? 0.20),
    lucro_desejado: Number(existing.lucro_desejado ?? 0),
    desconto_comercial: Number(existing.desconto_comercial ?? 0),
  } : {
    custos: [],
    horas: [],
    aliquota_imposto: Number(p.aliquota_imposto || 0.10),
    margem_desejada: Number(p.margem_minima || 0.20),
    lucro_desejado: 0,
    desconto_comercial: 0,
  });

  const input: PricingInput = useMemo(() => ({
    custos: draft.custos, horas: draft.horas,
    qtd_funcionarios: clientFuncionarios,
    custo_hora_interno: custoHora,
    valor_hora_tecnica: Number(p.valor_hora_tecnica || 0),
    custo_por_vida: Number(p.custo_por_vida || 0),
    aliquota_imposto: Number(draft.aliquota_imposto || 0),
    margem_desejada: Number(draft.margem_desejada || 0),
    lucro_desejado: Number(draft.lucro_desejado || 0),
    desconto_comercial: Number(draft.desconto_comercial || 0),
    arredondamento: Number(p.arredondamento || 1),
    markup_minimo: Number(p.markup_minimo || 1),
    margem_minima: Number(p.margem_minima || 0),
  }), [draft, p, custoHora, clientFuncionarios]);
  const c = computePricing(input);
  const meta = statusMargemMeta[c.status_margem];

  const addCusto = () => setDraft({ ...draft, custos: [...draft.custos, { id: newId(), categoria: "", descricao: "", valor: 0 }] });
  const updCusto = (id: string, patch: Partial<CustoDiretoRow>) =>
    setDraft({ ...draft, custos: draft.custos.map((r) => r.id === id ? { ...r, ...patch } : r) });
  const delCusto = (id: string) => setDraft({ ...draft, custos: draft.custos.filter((r) => r.id !== id) });

  const addHora = () => setDraft({ ...draft, horas: [...draft.horas, { id: newId(), atividade: "", horas: 0, valor_hora: custoHora }] });
  const updHora = (id: string, patch: Partial<HoraTecnicaRow>) =>
    setDraft({ ...draft, horas: draft.horas.map((r) => r.id === id ? { ...r, ...patch } : r) });
  const delHora = (id: string) => setDraft({ ...draft, horas: draft.horas.filter((r) => r.id !== id) });

  const qtdItem = Number(item?.quantidade || 1);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Custos diretos</h3>
            <Button size="sm" variant="outline" onClick={addCusto}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar custo direto
            </Button>
          </div>
          {draft.custos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">Nenhum custo direto adicionado.</p>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 w-56">Categoria</th>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-right px-3 py-2 w-32">Valor</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.custos.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1.5">
                        <Select value={row.categoria || ""} onValueChange={(v) => updCusto(row.id!, { categoria: v })}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                          <SelectContent>
                            {CUSTO_CATEGORIAS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input className="h-8" placeholder="Ex.: Combustível, ART…" value={row.descricao} onChange={(e) => updCusto(row.id!, { descricao: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input className="h-8 text-right" type="number" min="0" step="0.01" value={row.valor} onChange={(e) => updCusto(row.id!, { valor: Math.max(0, Number(e.target.value) || 0) })} />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delCusto(row.id!)}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/40 font-semibold">
                  <tr className="border-t border-border">
                    <td colSpan={2} className="px-3 py-2 text-right">Subtotal dos custos diretos</td>
                    <td className="px-3 py-2 text-right font-mono">{brl(c.custo_direto_total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold">Horas técnicas HSE</h3>
              <p className="text-xs text-muted-foreground">
                Valor da hora técnica HSE: <span className="font-mono font-semibold">{brl(custoHora)}/h</span>
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={addHora}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar atividade técnica
            </Button>
          </div>
          {draft.horas.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">Nenhuma atividade técnica adicionada.</p>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Atividade</th>
                    <th className="text-right px-3 py-2 w-24">Horas</th>
                    <th className="text-right px-3 py-2 w-28">Valor/h</th>
                    <th className="text-right px-3 py-2 w-32">Custo</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.horas.map((row) => {
                    const custoLinha = (Number(row.horas) || 0) * (Number(row.valor_hora) || 0);
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          <Select value={row.atividade || ""} onValueChange={(v) => updHora(row.id!, { atividade: v })}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                            <SelectContent>
                              {ATIVIDADE_CATEGORIAS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-right" type="number" min="0" step="0.5" value={row.horas} onChange={(e) => updHora(row.id!, { horas: Math.max(0, Number(e.target.value) || 0) })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-right" type="number" min="0" step="0.01" value={row.valor_hora} onChange={(e) => updHora(row.id!, { valor_hora: Math.max(0, Number(e.target.value) || 0) })} />
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{brl(custoLinha)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delHora(row.id!)}>
                            <Trash2 className="h-3.5 w-3.5 text-danger" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/40 font-semibold">
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-right">Totais</td>
                    <td className="px-3 py-2 text-right font-mono">{c.horas_total}h</td>
                    <td></td>
                    <td className="px-3 py-2 text-right font-mono">{brl(c.custo_horas)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Formação do preço</h3>
          <div className="grid grid-cols-2 gap-2">
            <MiniPct label="Imposto (%)" v={draft.aliquota_imposto} onChange={v => setDraft({ ...draft, aliquota_imposto: Number(v) || 0 })} />
            <MiniPct label="Margem desejada (%)" v={draft.margem_desejada} onChange={v => setDraft({ ...draft, margem_desejada: Number(v) || 0 })} />
            <Mini label="Lucro adicional (R$)" v={draft.lucro_desejado} onChange={v => setDraft({ ...draft, lucro_desejado: Number(v) || 0 })} />
            <Mini label="Desconto (R$)" v={draft.desconto_comercial} onChange={v => setDraft({ ...draft, desconto_comercial: Number(v) || 0 })} />
          </div>
        </div>
        <Card className="bg-secondary text-secondary-foreground">
          <CardContent className="p-4 space-y-1.5 text-sm">
            <Row label="Custo total"><span className="font-mono">{brl(c.custo_total)}</span></Row>
            <Row label="Preço mínimo"><span className="font-mono">{brl(c.preco_minimo)}</span></Row>
            <Row label="Preço sugerido"><span className="font-mono">{brl(c.preco_sugerido)}</span></Row>
            <Row label="Preço comercial"><span className="font-mono text-primary text-lg font-bold">{brl(c.preco_arredondado)}</span></Row>
            {qtdItem > 1 && (
              <Row label={`Valor unitário (× ${qtdItem})`}>
                <span className="font-mono">{brl(c.preco_arredondado / qtdItem)}</span>
              </Row>
            )}
            <hr className="border-white/20" />
            <Row label="Imposto"><span className="font-mono">{brl(c.imposto_estimado)}</span></Row>
            <Row label="Lucro"><span className="font-mono">{brl(c.lucro_estimado)}</span></Row>
            <Row label="Margem"><span className="font-mono">{pct(c.margem_liquida)}</span></Row>
            <Row label="Markup"><span className="font-mono">{c.markup.toFixed(2)}x</span></Row>
            <div className="pt-2"><Badge className={`border ${meta.color}`}>{meta.label}</Badge></div>
          </CardContent>
        </Card>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => {
          const custosInvalidos = draft.custos.filter((r) => !r.categoria || !r.descricao?.trim());
          if (custosInvalidos.length) { toast.error("Preencha categoria e descrição em todos os custos diretos."); return; }
          const horasInvalidas = draft.horas.filter((r) => !r.atividade);
          if (horasInvalidas.length) { toast.error("Selecione a atividade em todas as linhas de horas técnicas."); return; }
          onSave(draft, c);
        }}><Save className="h-4 w-4 mr-1" /> {saveLabel}</Button>
      </div>
    </div>
  );
}

function Row({ label, children }: any) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}

function Mini({ label, v, onChange }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input className="h-8" type="number" step="0.01" value={v ?? 0} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function MiniPct({ label, v, onChange }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <PercentInput className="h-8" value={Number(v ?? 0)} onChange={(n) => onChange(n)} />
    </div>
  );
}