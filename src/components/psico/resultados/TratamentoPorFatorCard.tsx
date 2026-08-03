import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PRIORIDADE_COLOR, TRATAMENTO_LABEL,
  atualizarRevisaoFator, criarRevisao, getRevisaoAtiva, getRevisaoFatores, traduzirErro,
} from "@/lib/psicoRevisao";

export default function TratamentoPorFatorCard({ av, onChange }: { av: any; onChange?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [rev, setRev] = useState<any>(null);
  const [fatores, setFatores] = useState<any[]>([]);
  const [orient, setOrient] = useState<Record<string, any>>({});

  async function load() {
    setLoading(true);
    try {
      const r = await getRevisaoAtiva(av.id);
      setRev(r);
      if (r) {
        const fs = await getRevisaoFatores(r.id);
        setFatores(fs);
        const codes = Array.from(new Set(fs.map((f: any) => f.fator_codigo)));
        if (codes.length && r.biblioteca_versao_id) {
          const { data: o } = await (supabase as any).from("psico_fatores_orientacoes")
            .select("*")
            .eq("biblioteca_versao_id", r.biblioteca_versao_id)
            .in("fator_codigo", codes);
          const map: Record<string, any> = {};
          (o || []).forEach((x: any) => { map[x.fator_codigo] = x; });
          setOrient(map);
        }
      } else {
        setFatores([]); setOrient({});
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [av?.id]);

  async function iniciar() {
    setCreating(true);
    const { error } = await criarRevisao(av.id, "rapida");
    setCreating(false);
    if (error) { toast.error(traduzirErro(String(error.message).split(":")[0]) || error.message); return; }
    toast.success("Tratamento por fator inicializado");
    load(); onChange?.();
  }

  async function salvarFator(f: any, patch: Record<string, any>) {
    const { error } = await atualizarRevisaoFator(f.id, patch);
    if (error) { toast.error(error.message); return; }
    setFatores((prev) => prev.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
    onChange?.();
  }

  if (loading) {
    return <Card><CardContent className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando tratamento por fator…</CardContent></Card>;
  }

  const readOnly = rev?.status === "aprovada";

  if (!rev) {
    return (
      <Card>
        <CardHeader><CardTitle>Tratamento por fator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Defina o destino técnico de cada fator (ação recomendada, monitoramento preventivo ou sem ação específica). Essa decisão alimenta o Plano de Ação e a Revisão Técnica.
          </p>
          <Button onClick={iniciar} disabled={creating}>
            <Sparkles className="h-4 w-4 mr-2" /> {creating ? "Inicializando…" : "Iniciar tratamento por fator"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tratamento por fator</CardTitle>
        {readOnly && <span className="text-xs text-muted-foreground">Revisão aprovada · somente leitura</span>}
      </CardHeader>
      <CardContent className="space-y-4">
        {fatores.map((f) => {
          const o = orient[f.fator_codigo];
          return (
            <div key={f.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{f.fator_codigo}</span>
                  <span className="font-medium">{o?.nome || f.fator_codigo}</span>
                  <Badge className={PRIORIDADE_COLOR[f.prioridade_calculada] || "bg-muted"}>{f.prioridade_calculada}</Badge>
                  {f.significativo_calculado ? (
                    <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">Significativo</Badge>
                  ) : (
                    <Badge variant="outline">Não significativo</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Info className="h-3 w-3" /> Cálculo original imutável
                </div>
              </div>

              {o?.definicao_resumida && <p className="text-xs text-muted-foreground">{o.definicao_resumida}</p>}

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Tratamento técnico</Label>
                  <Select
                    value={f.tratamento_tecnico}
                    onValueChange={(v) => salvarFator(f, { tratamento_tecnico: v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRATAMENTO_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Observação técnica</Label>
                  <Textarea
                    rows={2}
                    defaultValue={f.observacao_tecnica || ""}
                    disabled={readOnly}
                    onBlur={(e) => e.target.value !== (f.observacao_tecnica || "") && salvarFator(f, { observacao_tecnica: e.target.value || null })}
                  />
                </div>
              </div>

              {f.tratamento_tecnico === "sem_acao_especifica" && (
                <div>
                  <Label className="text-xs">Justificativa (obrigatória para "sem ação específica")</Label>
                  <Textarea
                    rows={2}
                    defaultValue={f.justificativa || ""}
                    disabled={readOnly}
                    onBlur={(e) => e.target.value !== (f.justificativa || "") && salvarFator(f, { justificativa: e.target.value || null })}
                  />
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground border-t pt-2">
          As definições aqui são a entrada oficial do Plano de Ação e da Revisão Técnica. Cálculos do motor permanecem imutáveis.
        </p>
      </CardContent>
    </Card>
  );
}