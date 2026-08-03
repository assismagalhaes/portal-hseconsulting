import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Copy, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { MARCOS, MARCO_LABEL, somaPercentuais, validarParcelas, type CondPagMarco, type ParcelaForm } from "@/lib/condicoesPagamento";

type Cond = {
  id?: string;
  nome: string;
  descricao: string | null;
  texto_complementar: string | null;
  quantidade_parcelas: number;
  permite_mensal_recorrente: boolean;
  is_padrao: boolean;
  ativa: boolean;
  em_uso?: boolean;
  ordem?: number;
};

const emptyCond: Cond = {
  nome: "", descricao: "", texto_complementar: "",
  quantidade_parcelas: 1, permite_mensal_recorrente: false,
  is_padrao: false, ativa: true,
};

export default function CondicoesPagamento() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [cond, setCond] = useState<Cond>(emptyCond);
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([]);

  useEffect(() => { document.title = "Condições de Pagamento | Portal HSE Consulting"; load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("condicoes_pagamento")
      .select("*, parcelas:condicoes_pagamento_parcelas(*)")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }

  function novaCondicao() {
    setCond({ ...emptyCond });
    setParcelas([{ numero: 1, percentual: 100, marco: "aceite_proposta", dias_apos_marco: 0, dia_mes: null, descricao: "" }]);
    setOpen(true);
  }

  function editar(r: any) {
    setCond({
      id: r.id, nome: r.nome, descricao: r.descricao ?? "", texto_complementar: r.texto_complementar ?? "",
      quantidade_parcelas: r.quantidade_parcelas, permite_mensal_recorrente: r.permite_mensal_recorrente,
      is_padrao: r.is_padrao, ativa: r.ativa, em_uso: r.em_uso, ordem: r.ordem,
    });
    const ps = (r.parcelas || []).sort((a: any, b: any) => a.numero - b.numero).map((p: any) => ({
      id: p.id, numero: p.numero, percentual: Number(p.percentual), marco: p.marco as CondPagMarco,
      dias_apos_marco: p.dias_apos_marco ?? 0, dia_mes: p.dia_mes ?? null, descricao: p.descricao ?? "",
    }));
    setParcelas(ps);
    setOpen(true);
  }

  function duplicar(r: any) {
    editar(r);
    setCond((c) => ({ ...c, id: undefined, nome: `${c.nome} (cópia)`, is_padrao: false, em_uso: false }));
    setParcelas((ps) => ps.map(({ id, ...rest }) => rest));
  }

  async function toggleAtiva(r: any) {
    const { error } = await supabase.from("condicoes_pagamento").update({ ativa: !r.ativa }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(!r.ativa ? "Condição ativada" : "Condição inativada");
    load();
  }

  async function remover(r: any) {
    if (!confirm(`Excluir a condição "${r.nome}"? Se estiver em uso, será bloqueado.`)) return;
    const { error } = await supabase.from("condicoes_pagamento").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Condição excluída");
    load();
  }

  function addParcela() {
    setParcelas((ps) => {
      const numero = ps.length + 1;
      return [...ps, { numero, percentual: 0, marco: "aceite_proposta", dias_apos_marco: 0, dia_mes: null, descricao: "" }];
    });
  }
  function removerParcela(idx: number) {
    setParcelas((ps) => ps.filter((_, i) => i !== idx).map((p, i) => ({ ...p, numero: i + 1 })));
  }
  function distribuirIgual() {
    const n = parcelas.length;
    if (!n) return;
    const base = Math.floor((100 / n) * 100) / 100;
    const resto = Math.round((100 - base * n) * 100) / 100;
    setParcelas((ps) => ps.map((p, i) => ({ ...p, percentual: i === n - 1 ? base + resto : base })));
  }

  async function salvar() {
    if (!cond.nome.trim()) return toast.error("Informe o nome");
    const err = validarParcelas(parcelas);
    if (err) return toast.error(err);

    const payload = {
      nome: cond.nome.trim(),
      descricao: cond.descricao?.trim() || null,
      texto_complementar: cond.texto_complementar?.trim() || null,
      quantidade_parcelas: parcelas.length,
      permite_mensal_recorrente: parcelas.some((p) => p.marco === "mensal_recorrente"),
      is_padrao: cond.is_padrao,
      ativa: cond.ativa,
    };

    let condId = cond.id;
    if (condId) {
      const { error } = await supabase.from("condicoes_pagamento").update(payload).eq("id", condId);
      if (error) return toast.error(error.message);
      await supabase.from("condicoes_pagamento_parcelas").delete().eq("condicao_id", condId);
    } else {
      const { data, error } = await supabase.from("condicoes_pagamento").insert(payload).select("id").maybeSingle();
      if (error || !data) return toast.error(error?.message || "Erro ao criar");
      condId = data.id;
    }

    const parcelasPayload = parcelas.map((p, i) => ({
      condicao_id: condId!,
      numero: i + 1,
      ordem: i + 1,
      percentual: p.percentual,
      marco: p.marco,
      dias_apos_marco: p.dias_apos_marco || 0,
      dia_mes: p.marco === "mensal_recorrente" ? p.dia_mes : null,
      descricao: p.descricao?.trim() || null,
    }));
    const { error: perr } = await supabase.from("condicoes_pagamento_parcelas").insert(parcelasPayload);
    if (perr) return toast.error(perr.message);

    toast.success("Condição salva");
    setOpen(false);
    load();
  }

  const soma = somaPercentuais(parcelas);
  const somaOk = Math.abs(soma - 100) < 0.01;

  return (
    <div>
      <PageHeader
        title="Condições de Pagamento"
        subtitle="Modelos parametrizados usados nas propostas comerciais e no financeiro"
        actions={isAdmin ? <Button size="sm" onClick={novaCondicao}><Plus className="h-4 w-4 mr-1" />Nova condição</Button> : undefined}
      />
      <div className="p-6 space-y-4">
        {!isAdmin && (
          <p className="text-sm text-muted-foreground">Somente administradores podem criar ou editar condições. Você pode visualizar os modelos disponíveis.</p>
        )}

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Parcelas</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Descrição</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {r.nome}
                      {r.is_padrao && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                      {r.em_uso && <Badge variant="outline" className="text-[10px]"><Lock className="h-2.5 w-2.5 mr-1" />Em uso</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.quantidade_parcelas}x</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.ativa ? "default" : "secondary"} className="text-[10px]">
                      {r.ativa ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[320px]">{r.descricao || "—"}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {isAdmin && (
                      <>
                        <Button size="icon" variant="ghost" title="Editar" aria-label="Editar" onClick={() => editar(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" title="Duplicar" aria-label="Duplicar" onClick={() => duplicar(r)}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" title={r.ativa ? "Inativar" : "Ativar"} aria-label={r.ativa ? "Inativar" : "Ativar"} onClick={() => toggleAtiva(r)}>
                          <Switch checked={r.ativa} className="pointer-events-none" />
                        </Button>
                        {!r.em_uso && (
                          <Button size="icon" variant="ghost" title="Excluir" aria-label="Excluir" onClick={() => remover(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma condição cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{cond.id ? "Editar condição" : "Nova condição de pagamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Nome *</Label>
                <Input value={cond.nome} onChange={(e) => setCond({ ...cond, nome: e.target.value })} placeholder="Ex: 50% aceite + 50% conclusão" />
              </div>
              <div className="space-y-1.5"><Label>Descrição interna</Label>
                <Input value={cond.descricao || ""} onChange={(e) => setCond({ ...cond, descricao: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Texto complementar (aparece na proposta)</Label>
              <Textarea rows={2} value={cond.texto_complementar || ""} onChange={(e) => setCond({ ...cond, texto_complementar: e.target.value })} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={cond.ativa} onCheckedChange={(v) => setCond({ ...cond, ativa: v })} /> Ativa
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={cond.is_padrao} onCheckedChange={(v) => setCond({ ...cond, is_padrao: v })} /> Definir como padrão
              </label>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label className="text-base">Parcelas / Marcos</Label>
                  <p className="text-xs text-muted-foreground">Soma dos percentuais deve totalizar 100%.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={distribuirIgual}>Distribuir igualmente</Button>
                  <Button type="button" size="sm" onClick={addParcela}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar parcela</Button>
                </div>
              </div>

              <div className="space-y-2">
                {parcelas.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-md border bg-muted/20">
                    <div className="col-span-1"><Label className="text-xs">Nº</Label>
                      <Input value={idx + 1} disabled className="h-9" />
                    </div>
                    <div className="col-span-2"><Label className="text-xs">%</Label>
                      <Input type="number" step="0.01" value={p.percentual}
                        onChange={(e) => setParcelas((ps) => ps.map((x, i) => i === idx ? { ...x, percentual: Number(e.target.value) } : x))} />
                    </div>
                    <div className="col-span-3"><Label className="text-xs">Marco</Label>
                      <Select value={p.marco} onValueChange={(v) => setParcelas((ps) => ps.map((x, i) => i === idx ? { ...x, marco: v as CondPagMarco } : x))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MARCOS.map((m) => <SelectItem key={m} value={m}>{MARCO_LABEL[m]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {p.marco === "mensal_recorrente" ? (
                      <div className="col-span-2"><Label className="text-xs">Dia do mês</Label>
                        <Input type="number" min={1} max={31} value={p.dia_mes ?? ""}
                          onChange={(e) => setParcelas((ps) => ps.map((x, i) => i === idx ? { ...x, dia_mes: e.target.value ? Number(e.target.value) : null } : x))} />
                      </div>
                    ) : (
                      <div className="col-span-2"><Label className="text-xs">Dias após marco</Label>
                        <Input type="number" value={p.dias_apos_marco}
                          onChange={(e) => setParcelas((ps) => ps.map((x, i) => i === idx ? { ...x, dias_apos_marco: Number(e.target.value) } : x))} />
                      </div>
                    )}
                    <div className="col-span-3"><Label className="text-xs">Descrição</Label>
                      <Input value={p.descricao || ""}
                        onChange={(e) => setParcelas((ps) => ps.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x))} />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" size="icon" variant="ghost" aria-label="Remover parcela" onClick={() => removerParcela(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`mt-3 text-sm font-medium ${somaOk ? "text-emerald-600" : "text-rose-600"}`}>
                Total: {soma.toFixed(2)}% {somaOk ? "✓" : "(precisa ser 100%)"}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!somaOk}>Salvar condição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}