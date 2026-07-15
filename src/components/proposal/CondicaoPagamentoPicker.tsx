import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Info, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { MARCO_LABEL, buildTextoCondicao, type CondPagMarco, type ParcelaForm } from "@/lib/condicoesPagamento";

type CondRow = {
  id: string; nome: string; descricao: string | null;
  texto_complementar: string | null; quantidade_parcelas: number; ativa: boolean;
  parcelas: {
    id: string; numero: number; percentual: number; marco: CondPagMarco;
    dias_apos_marco: number; dia_mes: number | null; descricao: string | null;
  }[];
};

type SnapshotRow = {
  id: string; condicao_id: string | null; nome: string;
  descricao: string | null; texto_complementar: string | null;
  quantidade_parcelas: number;
  parcelas: {
    id: string; numero: number; percentual: number; marco: CondPagMarco;
    dias_apos_marco: number; dia_mes: number | null; descricao: string | null; valor: number | null;
  }[];
};

export default function CondicaoPagamentoPicker({
  proposalId, total, legacyTexto, onSaved,
}: {
  proposalId: string;
  total: number;
  legacyTexto?: string | null;
  onSaved?: (textoGerado: string) => void;
}) {
  const [conds, setConds] = useState<CondRow[]>([]);
  const [snap, setSnap] = useState<SnapshotRow | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [complemento, setComplemento] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [proposalId]);

  async function load() {
    const [c, s] = await Promise.all([
      supabase.from("condicoes_pagamento")
        .select("*, parcelas:condicoes_pagamento_parcelas(*)")
        .eq("ativa", true)
        .order("ordem", { ascending: true }).order("nome", { ascending: true }),
      supabase.from("proposal_condicao_pagamento")
        .select("*, parcelas:proposal_condicao_parcelas(*)")
        .eq("proposal_id", proposalId).maybeSingle(),
    ]);
    setConds((c.data || []) as any);
    const snapData = s.data as any;
    if (snapData) {
      snapData.parcelas = (snapData.parcelas || []).sort((a: any, b: any) => a.numero - b.numero);
      setSnap(snapData);
      setSelectedId(snapData.condicao_id || "");
      setComplemento(snapData.texto_complementar || "");
    }
  }

  const selected = useMemo(() => conds.find((c) => c.id === selectedId), [conds, selectedId]);

  async function aplicar(condId: string) {
    const cond = conds.find((c) => c.id === condId);
    if (!cond) return;
    setSaving(true);
    try {
      const parcelasBase: ParcelaForm[] = [...(cond.parcelas || [])].sort((a, b) => a.numero - b.numero).map((p) => ({
        numero: p.numero, percentual: Number(p.percentual), marco: p.marco,
        dias_apos_marco: p.dias_apos_marco ?? 0, dia_mes: p.dia_mes ?? null, descricao: p.descricao,
      }));

      // 1) upsert snapshot (delete + insert – já são poucas parcelas)
      await supabase.from("proposal_condicao_pagamento").delete().eq("proposal_id", proposalId);
      const { data: novo, error } = await supabase.from("proposal_condicao_pagamento").insert({
        proposal_id: proposalId,
        condicao_id: cond.id,
        nome: cond.nome,
        descricao: cond.descricao,
        texto_complementar: complemento || cond.texto_complementar || null,
        quantidade_parcelas: cond.quantidade_parcelas,
        personalizada: false,
      }).select("id").maybeSingle();
      if (error || !novo) throw new Error(error?.message || "Erro ao gravar condição");

      const parcelasPayload = parcelasBase.map((p, i) => ({
        proposal_id: proposalId,
        proposal_condicao_id: novo.id,
        numero: i + 1,
        ordem: i + 1,
        percentual: p.percentual,
        marco: p.marco,
        dias_apos_marco: p.dias_apos_marco,
        dia_mes: p.marco === "mensal_recorrente" ? p.dia_mes : null,
        descricao: p.descricao,
        valor: Number(((p.percentual / 100) * (total || 0)).toFixed(2)),
      }));
      const { error: perr } = await supabase.from("proposal_condicao_parcelas").insert(parcelasPayload);
      if (perr) throw new Error(perr.message);

      // 2) texto compatível para PDF/aceite (backfill legacy field)
      const texto = buildTextoCondicao(cond.nome, parcelasBase, total, complemento || cond.texto_complementar);
      await supabase.from("proposals").update({ condicoes_pagamento: texto }).eq("id", proposalId);

      toast.success("Condição aplicada à proposta");
      onSaved?.(texto);
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao aplicar condição");
    } finally {
      setSaving(false);
    }
  }

  async function remover() {
    if (!confirm("Remover condição parametrizada? O texto livre atual permanecerá até você aplicar outra.")) return;
    await supabase.from("proposal_condicao_pagamento").delete().eq("proposal_id", proposalId);
    setSnap(null); setSelectedId("");
    toast.success("Condição removida");
  }

  const parcelasPreview = snap?.parcelas.length
    ? snap.parcelas
    : (selected?.parcelas || []).map((p) => ({
        ...p, valor: Number(((Number(p.percentual) / 100) * (total || 0)).toFixed(2)),
      }));

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Condição de pagamento</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Selecione uma condição cadastrada…" /></SelectTrigger>
            <SelectContent>
              {conds.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} <span className="text-xs text-muted-foreground">· {c.quantidade_parcelas}x</span>
                </SelectItem>
              ))}
              {conds.length === 0 && <div className="px-2 py-4 text-sm text-muted-foreground">Nenhuma condição ativa. Cadastre em Financeiro → Condições de Pagamento.</div>}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => aplicar(selectedId)} disabled={!selectedId || saving}>
            {snap?.condicao_id === selectedId ? <><RefreshCcw className="h-3.5 w-3.5 mr-1" />Reaplicar</> : "Aplicar"}
          </Button>
          {snap && <Button size="sm" variant="ghost" onClick={remover}>Remover</Button>}
        </div>
      </div>

      {selected?.descricao && !snap && (
        <p className="text-xs text-muted-foreground flex items-start gap-1"><Info className="h-3 w-3 mt-0.5" />{selected.descricao}</p>
      )}

      {parcelasPreview.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/40 text-xs">
            <span className="font-medium">
              {snap ? `Aplicada: ${snap.nome}` : `Prévia: ${selected?.nome}`}
              {snap && <Badge variant="outline" className="ml-2 text-[10px]">snapshot salvo</Badge>}
            </span>
            <span className="text-muted-foreground">Base de cálculo: {brl(total || 0)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-1.5">#</th>
                <th className="text-left px-3 py-1.5">%</th>
                <th className="text-right px-3 py-1.5">Valor</th>
                <th className="text-left px-3 py-1.5">Marco</th>
                <th className="text-left px-3 py-1.5">Prazo</th>
                <th className="text-left px-3 py-1.5">Observação</th>
              </tr>
            </thead>
            <tbody>
              {parcelasPreview.map((p: any) => (
                <tr key={p.id || p.numero} className="border-t">
                  <td className="px-3 py-1.5">{p.numero}</td>
                  <td className="px-3 py-1.5">{Number(p.percentual).toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">{brl(Number(p.valor ?? (p.percentual / 100) * total))}</td>
                  <td className="px-3 py-1.5">{MARCO_LABEL[p.marco as CondPagMarco]}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {p.marco === "mensal_recorrente"
                      ? `todo dia ${p.dia_mes ?? "—"}`
                      : p.dias_apos_marco ? `+${p.dias_apos_marco} dias` : "no ato"}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{p.descricao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Texto complementar (aparece na proposta abaixo das parcelas)</Label>
        <Textarea rows={2} value={complemento} onChange={(e) => setComplemento(e.target.value)}
          placeholder="Opcional: observação livre sobre pagamento (juros, multa, dados bancários…)" />
      </div>

      {!snap && legacyTexto && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
          <div className="font-medium mb-1 flex items-center gap-1"><Info className="h-3 w-3" /> Texto legado desta proposta</div>
          <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{legacyTexto}</pre>
          <p className="mt-2 text-muted-foreground">Aplique uma condição parametrizada acima para substituir este texto e habilitar a integração com o financeiro.</p>
        </div>
      )}
    </div>
  );
}