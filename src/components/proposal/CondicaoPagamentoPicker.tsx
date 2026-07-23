import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Info, RefreshCcw, Wrench, Plus, Trash2, Undo2, History, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { MARCO_LABEL, MARCOS, buildTextoCondicao, somaPercentuais, validarParcelas, type CondPagMarco, type ParcelaForm } from "@/lib/condicoesPagamento";

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
  quantidade_parcelas: number; personalizada: boolean;
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
  const [textoPadrao, setTextoPadrao] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ParcelaForm[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [showHist, setShowHist] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [proposalId]);

  async function load() {
    const [c, s, fc] = await Promise.all([
      supabase.from("condicoes_pagamento")
        .select("*, parcelas:condicoes_pagamento_parcelas(*)")
        .eq("ativa", true)
        .order("ordem", { ascending: true }).order("nome", { ascending: true }),
      supabase.from("proposal_condicao_pagamento")
        .select("*, parcelas:proposal_condicao_parcelas(*)")
        .eq("proposal_id", proposalId).maybeSingle(),
      supabase.from("financeiro_configuracoes").select("texto_padrao_pagamento").limit(1).maybeSingle(),
    ]);
    setConds((c.data || []) as any);
    setTextoPadrao((fc.data as any)?.texto_padrao_pagamento || "");
    const snapData = s.data as any;
    if (snapData) {
      snapData.parcelas = (snapData.parcelas || []).sort((a: any, b: any) => a.numero - b.numero);
      setSnap(snapData);
      setSelectedId(snapData.condicao_id || "");
      setComplemento(snapData.texto_complementar || "");
    }
    const { data: hist } = await supabase
      .from("proposal_condicao_pagamento_historico")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistorico(hist || []);
  }

  const selected = useMemo(() => conds.find((c) => c.id === selectedId), [conds, selectedId]);

  async function persistirSnapshot(opts: {
    nome: string;
    descricao: string | null;
    condicao_id: string | null;
    quantidade: number;
    personalizada: boolean;
    parcelasBase: ParcelaForm[];
    complementoOverride?: string | null;
  }) {
    setSaving(true);
    try {
      await supabase.from("proposal_condicao_pagamento").delete().eq("proposal_id", proposalId);
      const compl = opts.complementoOverride !== undefined ? opts.complementoOverride : (complemento || null);
      const { data: novo, error } = await supabase.from("proposal_condicao_pagamento").insert({
        proposal_id: proposalId,
        condicao_id: opts.condicao_id,
        nome: opts.nome,
        descricao: opts.descricao,
        texto_complementar: compl,
        quantidade_parcelas: opts.quantidade,
        personalizada: opts.personalizada,
      }).select("id").maybeSingle();
      if (error || !novo) throw new Error(error?.message || "Erro ao gravar condição");

      const parcelasPayload = opts.parcelasBase.map((p, i) => ({
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

      const texto = buildTextoCondicao(opts.nome, opts.parcelasBase, total, compl, textoPadrao);
      await supabase.from("proposals").update({ condicoes_pagamento: texto }).eq("id", proposalId);
      onSaved?.(texto);
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao aplicar condição");
    } finally {
      setSaving(false);
    }
  }

  async function aplicar(condId: string) {
    const cond = conds.find((c) => c.id === condId);
    if (!cond) return;
    const parcelasBase: ParcelaForm[] = [...(cond.parcelas || [])].sort((a, b) => a.numero - b.numero).map((p) => ({
      numero: p.numero, percentual: Number(p.percentual), marco: p.marco,
      dias_apos_marco: p.dias_apos_marco ?? 0, dia_mes: p.dia_mes ?? null, descricao: p.descricao,
    }));
    await persistirSnapshot({
      nome: cond.nome,
      descricao: cond.descricao,
      condicao_id: cond.id,
      quantidade: cond.quantidade_parcelas,
      personalizada: false,
      parcelasBase,
      complementoOverride: complemento || cond.texto_complementar || null,
    });
    toast.success("Condição aplicada à proposta");
  }

  function iniciarPersonalizacao() {
    const base: ParcelaForm[] = (snap?.parcelas || selected?.parcelas || []).map((p: any) => ({
      numero: p.numero, percentual: Number(p.percentual), marco: p.marco,
      dias_apos_marco: p.dias_apos_marco ?? 0, dia_mes: p.dia_mes ?? null, descricao: p.descricao ?? null,
    }));
    if (!base.length) {
      toast.info("Selecione ou aplique uma condição antes de personalizar.");
      return;
    }
    setDraft(base);
    setEditing(true);
  }

  async function salvarPersonalizacao() {
    const err = validarParcelas(draft);
    if (err) return toast.error(err);
    const nome = snap?.nome || selected?.nome || "Condição personalizada";
    await persistirSnapshot({
      nome,
      descricao: snap?.descricao ?? selected?.descricao ?? null,
      condicao_id: snap?.condicao_id ?? selected?.id ?? null,
      quantidade: draft.length,
      personalizada: true,
      parcelasBase: draft,
    });
    setEditing(false);
    toast.success("Condição personalizada salva");
  }

  async function restaurarOriginal() {
    const condId = snap?.condicao_id;
    if (!condId) return toast.info("Sem condição-modelo vinculada para restaurar.");
    if (!confirm("Restaurar as parcelas do modelo original? A personalização será descartada.")) return;
    await aplicar(condId);
    setEditing(false);
  }

  async function remover() {
    if (!confirm("Remover condição parametrizada? O texto livre atual permanecerá até você aplicar outra.")) return;
    await supabase.from("proposal_condicao_pagamento").delete().eq("proposal_id", proposalId);
    setSnap(null); setSelectedId(""); setEditing(false);
    toast.success("Condição removida");
  }

  const parcelasPreview = snap?.parcelas.length
    ? snap.parcelas
    : (selected?.parcelas || []).map((p) => ({
        ...p, valor: Number(((Number(p.percentual) / 100) * (total || 0)).toFixed(2)),
      }));

  const draftSoma = somaPercentuais(draft);
  const draftOk = Math.abs(draftSoma - 100) < 0.01;

  function updateDraft(idx: number, patch: Partial<ParcelaForm>) {
    setDraft((ps) => ps.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  function addDraft() {
    setDraft((ps) => [...ps, { numero: ps.length + 1, percentual: 0, marco: "aceite_proposta", dias_apos_marco: 0, dia_mes: null, descricao: null }]);
  }
  function removeDraft(idx: number) {
    setDraft((ps) => ps.filter((_, i) => i !== idx).map((p, i) => ({ ...p, numero: i + 1 })));
  }

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
          <Button size="sm" onClick={() => aplicar(selectedId)} disabled={!selectedId || saving || editing}>
            {snap?.condicao_id === selectedId ? <><RefreshCcw className="h-3.5 w-3.5 mr-1" />Reaplicar</> : "Aplicar"}
          </Button>
          {snap && !editing && (
            <Button size="sm" variant="outline" onClick={iniciarPersonalizacao}>
              <Wrench className="h-3.5 w-3.5 mr-1" />Personalizar
            </Button>
          )}
          {snap?.personalizada && snap?.condicao_id && !editing && (
            <Button size="sm" variant="ghost" onClick={restaurarOriginal}>
              <Undo2 className="h-3.5 w-3.5 mr-1" />Restaurar original
            </Button>
          )}
          {snap && !editing && <Button size="sm" variant="ghost" onClick={remover}>Remover</Button>}
        </div>
      </div>

      {selected?.descricao && !snap && (
        <p className="text-xs text-muted-foreground flex items-start gap-1"><Info className="h-3 w-3 mt-0.5" />{selected.descricao}</p>
      )}

      {snap?.personalizada && !editing && (
        <Badge variant="secondary" className="text-[10px]">Condição personalizada nesta proposta</Badge>
      )}

      {editing ? (
        <Card className="p-3 space-y-2 border-dashed">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Parcelas personalizadas desta proposta</Label>
              <p className="text-[11px] text-muted-foreground">Alterações não modificam o modelo cadastrado.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addDraft}>
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {draft.map((p, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 rounded-md border bg-muted/20">
                <div className="col-span-1">
                  <Label className="text-[10px]">Nº</Label>
                  <Input value={idx + 1} disabled className="h-8" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">%</Label>
                  <Input type="number" step="0.01" className="h-8" value={p.percentual}
                    onChange={(e) => updateDraft(idx, { percentual: Number(e.target.value) })} />
                </div>
                <div className="col-span-5">
                  <Label className="text-[10px]">Marco</Label>
                  <Select value={p.marco} onValueChange={(v) => updateDraft(idx, { marco: v as CondPagMarco })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MARCOS.map((m) => <SelectItem key={m} value={m}>{MARCO_LABEL[m]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {p.marco === "mensal_recorrente" ? (
                  <div className="col-span-3">
                    <Label className="text-[10px]">Dia do mês</Label>
                    <Input
                      type="number" min={1} max={31} className="h-8"
                      value={p.dia_mes ?? ""}
                      onChange={(e) => updateDraft(idx, { dia_mes: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                ) : (
                  <div className="col-span-3">
                    <Label className="text-[10px]">Dias após marco</Label>
                    <Input
                      type="number" min={0} className="h-8"
                      value={p.dias_apos_marco}
                      onChange={(e) => updateDraft(idx, { dias_apos_marco: Number(e.target.value || 0) })}
                    />
                  </div>
                )}
                <div className="col-span-1 flex justify-end">
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover parcela" onClick={() => removeDraft(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className={`text-xs font-medium ${draftOk ? "text-emerald-600" : "text-rose-600"}`}>
              Total: {draftSoma.toFixed(2)}% {draftOk ? "✓" : "(precisa ser 100%)"}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={salvarPersonalizacao} disabled={!draftOk || saving}>Salvar personalização</Button>
            </div>
          </div>
        </Card>
      ) : parcelasPreview.length > 0 && (
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
              </tr>
            </thead>
            <tbody>
              {parcelasPreview.map((p: any) => (
                <tr key={p.id || p.numero} className="border-t">
                  <td className="px-3 py-1.5">{p.numero}</td>
                  <td className="px-3 py-1.5">{Number(p.percentual).toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">{brl(Number(p.valor ?? (p.percentual / 100) * total))}</td>
                  <td className="px-3 py-1.5">{MARCO_LABEL[p.marco as CondPagMarco]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Texto complementar (aparece na proposta abaixo das parcelas)</Label>
        <Textarea rows={2} value={complemento} onChange={(e) => setComplemento(e.target.value)}
          placeholder="Opcional: texto livre sobre pagamento (juros, multa, dados bancários…)" />
      </div>

      {textoPadrao && (
        <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <div className="font-medium mb-1 flex items-center gap-1 text-foreground"><Info className="h-3 w-3" /> Texto padrão de pagamento (Configurações)</div>
          <pre className="whitespace-pre-wrap font-sans">{textoPadrao}</pre>
          <p className="mt-1">Aparece automaticamente no PDF e no aceite abaixo das parcelas.</p>
        </div>
      )}

      {!snap && legacyTexto && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
          <div className="font-medium mb-1 flex items-center gap-1"><Info className="h-3 w-3" /> Texto legado desta proposta</div>
          <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{legacyTexto}</pre>
          <p className="mt-2 text-muted-foreground">Aplique uma condição parametrizada acima para substituir este texto e habilitar a integração com o financeiro.</p>
        </div>
      )}

      {historico.length > 0 && (
        <div className="rounded-md border">
          <button
            type="button"
            onClick={() => setShowHist((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50"
          >
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico da condição ({historico.length})
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHist ? "rotate-180" : ""}`} />
          </button>
          {showHist && (
            <div className="border-t divide-y max-h-80 overflow-y-auto">
              {historico.map((h) => (
                <div key={h.id} className="p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={h.acao === "removida" ? "destructive" : h.acao === "personalizada" ? "secondary" : "outline"}
                      className="text-[10px] capitalize"
                    >
                      {h.acao}
                    </Badge>
                    <span className="font-medium">{h.nome || "—"}</span>
                    {h.revisao != null && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Rev. {String(h.revisao).padStart(2, "0")}
                      </Badge>
                    )}
                    <span className="ml-auto text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {Array.isArray(h.parcelas) && h.parcelas.length > 0 && (
                    <div className="text-muted-foreground pl-1">
                      {h.parcelas.map((p: any) => (
                        <div key={p.numero} className="flex gap-2">
                          <span className="font-mono w-6">{p.numero})</span>
                          <span className="font-mono">{Number(p.percentual).toFixed(2)}%</span>
                          <span>· {MARCO_LABEL[p.marco as CondPagMarco]}</span>
                          {p.valor ? <span className="ml-auto font-mono">{brl(Number(p.valor))}</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                  {h.texto_complementar && (
                    <p className="text-muted-foreground italic">{h.texto_complementar}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}