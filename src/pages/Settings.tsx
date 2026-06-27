import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Settings() {
  const { isInternal } = useAuth();
  const [p, setP] = useState<any>(null);

  useEffect(() => { document.title = "Configurações | Portal HSE Consulting"; load(); }, []);
  async function load() {
    const { data } = await supabase.from("pricing_params").select("*").limit(1).maybeSingle();
    setP(data || {
      custo_fixo_mensal: 0, horas_produtivas_mes: 160, custo_por_vida: 0,
      aliquota_imposto: 0.06, margem_minima: 0.25, markup_minimo: 1.5,
      arredondamento: 10, condicoes_pagamento_default: "", outras_condicoes_default: "",
    });
  }

  async function save() {
    const payload = { ...p,
      custo_fixo_mensal:+p.custo_fixo_mensal, horas_produtivas_mes:+p.horas_produtivas_mes,
      custo_por_vida:+p.custo_por_vida, aliquota_imposto:+p.aliquota_imposto,
      margem_minima:+p.margem_minima, markup_minimo:+p.markup_minimo, arredondamento:+p.arredondamento };
    const { error } = p.id
      ? await supabase.from("pricing_params").update(payload).eq("id", p.id)
      : await supabase.from("pricing_params").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Parâmetros salvos");
    load();
  }

  if (!p) return null;
  const custoHora = p.horas_produtivas_mes > 0 ? Number(p.custo_fixo_mensal) / Number(p.horas_produtivas_mes) : 0;

  return (
    <div>
      <PageHeader title="Configurações de Precificação" subtitle="Parâmetros usados em todos os cálculos internos" />
      <div className="p-6 max-w-3xl space-y-4">
        {!isInternal && <p className="text-sm text-warning">Apenas admin/comercial pode salvar.</p>}
        <Card className="shadow-elegant">
          <CardHeader><CardTitle className="font-display">Custos internos</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <NumField label="Custo fixo mensal (R$)" v={p.custo_fixo_mensal} set={v=>setP({...p, custo_fixo_mensal:v})} />
            <NumField label="Horas produtivas / mês" v={p.horas_produtivas_mes} set={v=>setP({...p, horas_produtivas_mes:v})} />
            <div className="sm:col-span-2 text-xs text-muted-foreground">Custo-hora interno calculado: <span className="font-mono">R$ {custoHora.toFixed(2)}</span></div>
            <NumField label="Custo por vida (R$)" v={p.custo_por_vida} set={v=>setP({...p, custo_por_vida:v})} />
          </CardContent>
        </Card>
        <Card className="shadow-elegant">
          <CardHeader><CardTitle className="font-display">Regras comerciais</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <NumField label="Alíquota de imposto (0-1)" step="0.01" v={p.aliquota_imposto} set={v=>setP({...p, aliquota_imposto:v})} />
            <NumField label="Margem mínima (0-1)" step="0.01" v={p.margem_minima} set={v=>setP({...p, margem_minima:v})} />
            <NumField label="Markup mínimo" step="0.1" v={p.markup_minimo} set={v=>setP({...p, markup_minimo:v})} />
            <NumField label="Arredondamento (R$)" v={p.arredondamento} set={v=>setP({...p, arredondamento:v})} />
          </CardContent>
        </Card>
        <Card className="shadow-elegant">
          <CardHeader><CardTitle className="font-display">Textos padrão da proposta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>Condições de pagamento</Label>
              <Textarea rows={3} value={p.condicoes_pagamento_default||""} onChange={e=>setP({...p, condicoes_pagamento_default:e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Outras condições</Label>
              <Textarea rows={3} value={p.outras_condicoes_default||""} onChange={e=>setP({...p, outras_condicoes_default:e.target.value})} /></div>
          </CardContent>
        </Card>
        <div className="flex justify-end"><Button onClick={save} disabled={!isInternal}>Salvar parâmetros</Button></div>
      </div>
    </div>
  );
}

function NumField({ label, v, set, step="1" }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" step={step} value={v ?? 0} onChange={e=>set(e.target.value)} />
    </div>
  );
}