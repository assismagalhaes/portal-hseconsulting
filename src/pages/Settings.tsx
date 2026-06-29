import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Settings() {
  const { isInternal } = useAuth();
  const [p, setP] = useState<any>(null);
  const [tpl, setTpl] = useState<any>(null);

  useEffect(() => { document.title = "Configurações | Portal HSE Consulting"; load(); }, []);
  async function load() {
    const [pp, tt] = await Promise.all([
      supabase.from("pricing_params").select("*").limit(1).maybeSingle(),
      supabase.from("proposal_template").select("*").limit(1).maybeSingle(),
    ]);
    setP(pp.data || {
      custo_fixo_mensal: 0, horas_produtivas_mes: 160, custo_por_vida: 0,
      aliquota_imposto: 0.06, margem_minima: 0.25, markup_minimo: 1.5,
      arredondamento: 10, condicoes_pagamento_default: "", outras_condicoes_default: "",
    });
    setTpl(tt.data || {});
  }

  async function save() {
    const payload = { ...p,
      custo_fixo_mensal:+p.custo_fixo_mensal, horas_produtivas_mes:+p.horas_produtivas_mes,
      custo_por_vida:+p.custo_por_vida, aliquota_imposto:+p.aliquota_imposto,
      margem_minima:+p.margem_minima, markup_minimo:+p.markup_minimo, arredondamento:+p.arredondamento,
      valor_hora_tecnica:+p.valor_hora_tecnica };
    // Detecta mudança no valor da hora técnica e registra no histórico
    const valorAntes = p.id ? (await supabase.from("pricing_params").select("valor_hora_tecnica").eq("id", p.id).maybeSingle()).data?.valor_hora_tecnica : null;
    const { error } = p.id
      ? await supabase.from("pricing_params").update(payload).eq("id", p.id)
      : await supabase.from("pricing_params").insert(payload);
    if (error) return toast.error(error.message);
    if (valorAntes != null && Number(valorAntes) !== Number(payload.valor_hora_tecnica)) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("valor_hora_tecnica_historico").insert({
        valor: payload.valor_hora_tecnica,
        vigencia_inicio: new Date().toISOString().slice(0,10),
        observacao: `Alterado de R$ ${valorAntes} para R$ ${payload.valor_hora_tecnica}`,
        user_id: user?.id,
      });
    }
    toast.success("Parâmetros salvos");
    load();
  }

  if (!p) return null;
  const custoHora = p.horas_produtivas_mes > 0 ? Number(p.custo_fixo_mensal) / Number(p.horas_produtivas_mes) : 0;

  async function saveTpl() {
    if (!tpl) return;
    const payload: any = { ...tpl };
    if (typeof payload.diferenciais === "string") {
      payload.diferenciais = payload.diferenciais.split("\n").map((s:string)=>s.trim()).filter(Boolean);
    }
    const { error } = tpl.id
      ? await supabase.from("proposal_template").update(payload).eq("id", tpl.id)
      : await supabase.from("proposal_template").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Modelo da proposta salvo");
    load();
  }
  const setT = (patch:any) => setTpl({ ...tpl, ...patch });
  const difString = Array.isArray(tpl?.diferenciais) ? tpl.diferenciais.join("\n") : (tpl?.diferenciais || "");

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Precificação e modelo da proposta comercial" />
      <div className="p-6 max-w-4xl">
        {!isInternal && <p className="text-sm text-warning">Apenas admin/comercial pode salvar.</p>}
        <Tabs defaultValue="precos">
          <TabsList>
            <TabsTrigger value="precos">Precificação</TabsTrigger>
            <TabsTrigger value="modelo">Modelo da Proposta</TabsTrigger>
          </TabsList>
          <TabsContent value="precos" className="space-y-4 mt-4">
        <Card className="shadow-elegant">
          <CardHeader><CardTitle className="font-display">Custos internos</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <NumField label="Custo fixo mensal (R$)" v={p.custo_fixo_mensal} set={v=>setP({...p, custo_fixo_mensal:v})} />
            <NumField label="Horas produtivas / mês" v={p.horas_produtivas_mes} set={v=>setP({...p, horas_produtivas_mes:v})} />
            <div className="sm:col-span-2 text-xs text-muted-foreground">Custo-hora interno calculado: <span className="font-mono">R$ {custoHora.toFixed(2)}</span></div>
            <NumField label="Custo por vida (R$)" v={p.custo_por_vida} set={v=>setP({...p, custo_por_vida:v})} />
            <div className="sm:col-span-2 border-t border-border pt-3 mt-2">
              <NumField label="Valor da Hora Técnica HSE (R$/h) ★" step="0.01" v={p.valor_hora_tecnica} set={v=>setP({...p, valor_hora_tecnica:v})} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Usado para converter automaticamente horas técnicas em custo nas calculadoras individual e em grupo. Alterações são registradas no histórico — simulações antigas mantêm o valor vigente na época.
              </p>
            </div>
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
          </TabsContent>

          <TabsContent value="modelo" className="space-y-4 mt-4">
            {tpl && (
              <>
                <Card className="shadow-elegant">
                  <CardHeader><CardTitle className="font-display">Identidade visual</CardTitle></CardHeader>
                  <CardContent className="grid sm:grid-cols-3 gap-3">
                    <ColorField label="Cor primária (azul HSE)" v={tpl.cor_primaria} set={v=>setT({cor_primaria:v})} />
                    <ColorField label="Cor secundária (verde HSE)" v={tpl.cor_secundaria} set={v=>setT({cor_secundaria:v})} />
                    <ColorField label="Cor neutra (fundo)" v={tpl.cor_neutra} set={v=>setT({cor_neutra:v})} />
                    <div className="space-y-1.5"><Label>Fonte títulos</Label>
                      <Input value={tpl.font_titulo||""} onChange={e=>setT({font_titulo:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Fonte corpo</Label>
                      <Input value={tpl.font_corpo||""} onChange={e=>setT({font_corpo:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Versão (rodapé)</Label>
                      <Input value={tpl.rodape_versao||""} onChange={e=>setT({rodape_versao:e.target.value})} /></div>
                    <div className="space-y-1.5 sm:col-span-3"><Label>URL do logo (opcional)</Label>
                      <Input value={tpl.logo_url||""} onChange={e=>setT({logo_url:e.target.value})} placeholder="Deixe vazio para usar o logo padrão" /></div>
                    <div className="space-y-1.5 sm:col-span-3"><Label>URL imagem da capa (opcional)</Label>
                      <Input value={tpl.capa_imagem_url||""} onChange={e=>setT({capa_imagem_url:e.target.value})} /></div>
                    <div className="space-y-1.5 sm:col-span-3"><Label>URL imagem da contracapa (opcional)</Label>
                      <Input value={tpl.contracapa_imagem_url||""} onChange={e=>setT({contracapa_imagem_url:e.target.value})} /></div>
                  </CardContent>
                </Card>

                <Card className="shadow-elegant">
                  <CardHeader><CardTitle className="font-display">Slogan e textos institucionais</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5"><Label>Slogan</Label>
                      <Input value={tpl.slogan||""} onChange={e=>setT({slogan:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Quem somos</Label>
                      <Textarea rows={3} value={tpl.quem_somos||""} onChange={e=>setT({quem_somos:e.target.value})} /></div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5"><Label>Missão</Label>
                        <Textarea rows={4} value={tpl.missao||""} onChange={e=>setT({missao:e.target.value})} /></div>
                      <div className="space-y-1.5"><Label>Visão</Label>
                        <Textarea rows={4} value={tpl.visao||""} onChange={e=>setT({visao:e.target.value})} /></div>
                      <div className="space-y-1.5"><Label>Valores</Label>
                        <Textarea rows={4} value={tpl.valores||""} onChange={e=>setT({valores:e.target.value})} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Diferenciais (um por linha)</Label>
                      <Textarea rows={6} value={difString} onChange={e=>setT({diferenciais:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Texto de aceite</Label>
                      <Textarea rows={3} value={tpl.texto_aceite||""} onChange={e=>setT({texto_aceite:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Mensagem da contracapa</Label>
                      <Textarea rows={2} value={tpl.mensagem_contracapa||""} onChange={e=>setT({mensagem_contracapa:e.target.value})} /></div>
                  </CardContent>
                </Card>

                <Card className="shadow-elegant">
                  <CardHeader><CardTitle className="font-display">Contato</CardTitle></CardHeader>
                  <CardContent className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Telefone</Label>
                      <Input value={tpl.telefone||""} onChange={e=>setT({telefone:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>WhatsApp</Label>
                      <Input value={tpl.whatsapp||""} onChange={e=>setT({whatsapp:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>E-mail</Label>
                      <Input value={tpl.email||""} onChange={e=>setT({email:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Site</Label>
                      <Input value={tpl.site||""} onChange={e=>setT({site:e.target.value})} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Endereço</Label>
                      <Input value={tpl.endereco||""} onChange={e=>setT({endereco:e.target.value})} /></div>
                  </CardContent>
                </Card>

                <div className="flex justify-end"><Button onClick={saveTpl} disabled={!isInternal}>Salvar modelo da proposta</Button></div>
              </>
            )}
          </TabsContent>
        </Tabs>
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

function ColorField({ label, v, set }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input type="color" value={v || "#000000"} onChange={e=>set(e.target.value)} className="h-10 w-12 rounded border border-input cursor-pointer" />
        <Input value={v || ""} onChange={e=>set(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}