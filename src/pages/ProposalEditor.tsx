import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Calculator, Printer, FileText } from "lucide-react";
import { brl, pct, proposalStatusLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { computePricing, statusMargemMeta, type PricingInput } from "@/lib/pricing";
import { toast } from "sonner";
import logo from "@/assets/hse-logo.png";

const emptyCustos = { deslocamento:0, alimentacao_hospedagem:0, terceiros:0, exames_laboratorio:0, taxas_art:0, equipamentos:0, materiais_epi:0, taxa_por_funcionario:0, outros:0 };
const emptyHoras = { atendimento:0, analise_documental:0, deslocamento:0, visita_tecnica:0, elaboracao:0, revisao:0, pos_entrega:0, outras:0 };

export default function ProposalEditor() {
  const { id } = useParams<{id:string}>();
  const nav = useNavigate();
  const { isInternal } = useAuth();
  const [proposal, setProposal] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [pricings, setPricings] = useState<Record<string, any>>({});
  const [services, setServices] = useState<any[]>([]);
  const [params, setParams] = useState<any>(null);
  const [clientView, setClientView] = useState(false);
  const [pricingOpen, setPricingOpen] = useState<string | null>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    if (!id) return;
    const [p, sv, pp] = await Promise.all([
      supabase.from("proposals").select("*, clients(*)").eq("id", id).single(),
      supabase.from("services").select("*").order("nome"),
      supabase.from("pricing_params").select("*").limit(1).maybeSingle(),
    ]);
    if (p.error) { toast.error(p.error.message); return; }
    setProposal(p.data);
    setClient(p.data.clients);
    setServices(sv.data || []);
    setParams(pp.data || {
      custo_fixo_mensal:0, horas_produtivas_mes:160, custo_por_vida:0,
      aliquota_imposto:0.06, margem_minima:0.25, markup_minimo:1.5, arredondamento:10,
    });
    document.title = `${p.data.numero} | Portal HSE Consulting`;
    const it = await supabase.from("proposal_items").select("*").eq("proposal_id", id).order("numero_item");
    setItems(it.data || []);
    if (it.data && it.data.length) {
      const pr = await supabase.from("proposal_item_pricing").select("*").in("proposal_item_id", it.data.map(x=>x.id));
      const map: Record<string, any> = {};
      (pr.data || []).forEach(r => { map[r.proposal_item_id] = r; });
      setPricings(map);
    }
  }

  const total = items.reduce((a,b)=>a+Number(b.valor_total||0), 0);

  async function saveProposalField(patch: any) {
    if (!proposal) return;
    const { error } = await supabase.from("proposals").update(patch).eq("id", proposal.id);
    if (error) return toast.error(error.message);
    setProposal({ ...proposal, ...patch });
  }

  async function updateTotal(newItems: any[]) {
    const t = newItems.reduce((a,b)=>a+Number(b.valor_total||0),0);
    await supabase.from("proposals").update({ valor_total: t }).eq("id", proposal.id);
    setProposal((p:any) => ({...p, valor_total:t }));
  }

  async function addItem(fromService?: any) {
    const numero_item = (items[items.length-1]?.numero_item || 0) + 1;
    const payload = {
      proposal_id: proposal.id, numero_item,
      service_id: fromService?.id || null,
      descricao_comercial: fromService?.descricao_comercial || fromService?.nome || "Novo item",
      escopo_tecnico: fromService?.escopo_tecnico || "",
      unidade: fromService?.unidade_padrao || "serviço",
      quantidade: 1,
      valor_unitario: Number(fromService?.valor_referencia || 0),
      valor_total: Number(fromService?.valor_referencia || 0),
    };
    const { data, error } = await supabase.from("proposal_items").insert(payload).select("*").single();
    if (error) return toast.error(error.message);
    const next = [...items, data!];
    setItems(next); updateTotal(next);
  }

  async function updateItem(it: any, patch: any) {
    const merged = { ...it, ...patch };
    merged.valor_total = Number(merged.quantidade||0) * Number(merged.valor_unitario||0);
    const { error } = await supabase.from("proposal_items").update({
      descricao_comercial: merged.descricao_comercial, escopo_tecnico: merged.escopo_tecnico,
      unidade: merged.unidade, quantidade: merged.quantidade,
      valor_unitario: merged.valor_unitario, valor_total: merged.valor_total,
    }).eq("id", it.id);
    if (error) return toast.error(error.message);
    const next = items.map(x => x.id === it.id ? merged : x);
    setItems(next); updateTotal(next);
  }

  async function removeItem(it: any) {
    await supabase.from("proposal_items").delete().eq("id", it.id);
    const next = items.filter(x => x.id !== it.id);
    setItems(next); updateTotal(next);
  }

  async function savePricing(item: any, draft: any, computed: any) {
    const payload = {
      proposal_item_id: item.id,
      custos: draft.custos, horas: draft.horas,
      aliquota_imposto: draft.aliquota_imposto, margem_desejada: draft.margem_desejada,
      lucro_desejado: draft.lucro_desejado, desconto_comercial: draft.desconto_comercial,
      preco_sugerido: computed.preco_sugerido, preco_arredondado: computed.preco_arredondado,
      preco_aprovado: computed.preco_arredondado, indicadores: computed,
    };
    const existing = pricings[item.id];
    const { error } = existing
      ? await supabase.from("proposal_item_pricing").update(payload).eq("id", existing.id)
      : await supabase.from("proposal_item_pricing").insert(payload);
    if (error) return toast.error(error.message);
    setPricings({ ...pricings, [item.id]: { ...existing, ...payload }});
    await updateItem(item, { valor_unitario: computed.preco_arredondado / Math.max(1, Number(item.quantidade||1)) });
    toast.success("Precificação salva e aplicada ao item");
    setPricingOpen(null);
  }

  if (!proposal || !params) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  return (
    <div className="pb-10">
      <PageHeader title={`Proposta ${proposal.numero}`}
        subtitle={client?.nome_fantasia || client?.razao_social || "Sem cliente"}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild><Link to="/propostas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
            <Button variant="outline" size="sm" onClick={()=>window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
            <Select value={proposal.status} onValueChange={(v)=>saveProposalField({ status: v, ...(v==="enviada" && !proposal.data_envio ? { data_envio: new Date().toISOString() } : {}) })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(proposalStatusLabel).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            {isInternal && (
              <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-md bg-muted">
                <Switch checked={clientView} onCheckedChange={setClientView} id="cv" />
                <Label htmlFor="cv" className="text-xs cursor-pointer">Visão do cliente</Label>
              </div>
            )}
          </>
        } />

      <div className="p-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {clientView ? (
            <ClientPreview proposal={proposal} client={client} items={items} />
          ) : (
            <Tabs defaultValue="itens">
              <TabsList>
                <TabsTrigger value="itens">Itens & escopo</TabsTrigger>
                <TabsTrigger value="comerciais">Condições comerciais</TabsTrigger>
                <TabsTrigger value="internas">Notas internas</TabsTrigger>
              </TabsList>

              <TabsContent value="itens" className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm" onClick={()=>addItem()}><Plus className="h-4 w-4 mr-1" /> Item em branco</Button>
                  <Select onValueChange={(v) => { const s = services.find(x=>x.id===v); if (s) addItem(s); }}>
                    <SelectTrigger className="w-72"><SelectValue placeholder="…ou adicionar do catálogo" /></SelectTrigger>
                    <SelectContent>{services.map(s=><SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {items.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhum item ainda. Adicione o primeiro serviço.</Card>}
                {items.map(it => (
                  <ItemEditor key={it.id} item={it} pricing={pricings[it.id]}
                    onChange={(patch)=>updateItem(it, patch)}
                    onRemove={()=>removeItem(it)}
                    onOpenPricing={()=>setPricingOpen(it.id)}
                    isInternal={isInternal} />
                ))}
              </TabsContent>

              <TabsContent value="comerciais" className="space-y-4 mt-4">
                <Card><CardContent className="p-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Validade da proposta</Label>
                      <Input type="date" value={proposal.validade||""} onChange={e=>setProposal({...proposal, validade:e.target.value})} onBlur={()=>saveProposalField({ validade: proposal.validade })} /></div>
                    <div className="space-y-1.5"><Label>Próximo follow-up</Label>
                      <Input type="date" value={proposal.proximo_followup||""} onChange={e=>setProposal({...proposal, proximo_followup:e.target.value})} onBlur={()=>saveProposalField({ proximo_followup: proposal.proximo_followup })} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Condições de pagamento</Label>
                    <Textarea rows={3} value={proposal.condicoes_pagamento||""} onChange={e=>setProposal({...proposal, condicoes_pagamento:e.target.value})} onBlur={()=>saveProposalField({ condicoes_pagamento: proposal.condicoes_pagamento })} /></div>
                  <div className="space-y-1.5"><Label>Outras condições</Label>
                    <Textarea rows={3} value={proposal.outras_condicoes||""} onChange={e=>setProposal({...proposal, outras_condicoes:e.target.value})} onBlur={()=>saveProposalField({ outras_condicoes: proposal.outras_condicoes })} /></div>
                  <div className="space-y-1.5"><Label>Observações para o cliente</Label>
                    <Textarea rows={3} value={proposal.observacoes_comerciais||""} onChange={e=>setProposal({...proposal, observacoes_comerciais:e.target.value})} onBlur={()=>saveProposalField({ observacoes_comerciais: proposal.observacoes_comerciais })} /></div>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="internas" className="mt-4">
                <Card><CardContent className="p-4 space-y-2">
                  <Label>Anotações internas (não vai para o cliente)</Label>
                  <Textarea rows={8} value={proposal.observacoes_internas||""} onChange={e=>setProposal({...proposal, observacoes_internas:e.target.value})} onBlur={()=>saveProposalField({ observacoes_internas: proposal.observacoes_internas })} />
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="shadow-elegant">
            <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Status"><Badge>{proposalStatusLabel[proposal.status]}</Badge></Row>
              <Row label="Cliente">{client?.nome_fantasia || client?.razao_social || "—"}</Row>
              <Row label="Itens">{items.length}</Row>
              <Row label="Valor total"><span className="font-mono font-semibold text-primary">{brl(total)}</span></Row>
              {isInternal && !clientView && (
                <>
                  <hr/>
                  <InternalSummary items={items} pricings={pricings} />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Cliente</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1 text-muted-foreground">
              <div className="font-medium text-foreground">{client?.razao_social}</div>
              {client?.cnpj_cpf && <div className="font-mono text-xs">{client.cnpj_cpf}</div>}
              {client?.solicitante && <div>Contato: {client.solicitante}</div>}
              {client?.email && <div>{client.email}</div>}
              {(client?.cidade || client?.uf) && <div>{[client.cidade, client.uf].filter(Boolean).join(" / ")}</div>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={!!pricingOpen} onOpenChange={(o)=>!o && setPricingOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Precificação do item</DialogTitle></DialogHeader>
          {pricingOpen && (
            <PricingPanel item={items.find(i=>i.id===pricingOpen)!} existing={pricings[pricingOpen]}
              params={params} clientFuncionarios={client?.qtd_funcionarios||0}
              onSave={(draft, computed)=>savePricing(items.find(i=>i.id===pricingOpen)!, draft, computed)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: any) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span>{children}</span></div>;
}

function InternalSummary({ items, pricings }: any) {
  let custoTotal = 0, lucroTotal = 0, receita = 0;
  items.forEach((it:any) => {
    const p = pricings[it.id];
    if (p?.indicadores) {
      custoTotal += Number(p.indicadores.custo_total||0);
      lucroTotal += Number(p.indicadores.lucro_estimado||0);
      receita += Number(p.indicadores.receita_liquida||0);
    }
  });
  const margem = receita > 0 ? lucroTotal / (receita + (custoTotal*0)) : 0;
  return (
    <div className="space-y-2">
      <Row label="Custo total interno"><span className="font-mono">{brl(custoTotal)}</span></Row>
      <Row label="Receita líquida"><span className="font-mono">{brl(receita)}</span></Row>
      <Row label="Lucro estimado"><span className="font-mono">{brl(lucroTotal)}</span></Row>
      <Row label="Margem média"><span className="font-mono">{pct(margem)}</span></Row>
    </div>
  );
}

function ItemEditor({ item, pricing, onChange, onRemove, onOpenPricing, isInternal }: any) {
  const [local, setLocal] = useState(item);
  useEffect(()=>setLocal(item), [item.id]);
  const margem = pricing?.indicadores?.status_margem;
  const meta = margem ? statusMargemMeta[margem as keyof typeof statusMargemMeta] : null;
  return (
    <Card className="shadow-elegant">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">#{item.numero_item}</Badge>
              {meta && <Badge className={`border ${meta.color}`}>{meta.label}</Badge>}
            </div>
            <Input value={local.descricao_comercial} onChange={e=>setLocal({...local, descricao_comercial:e.target.value})} onBlur={()=>onChange({ descricao_comercial: local.descricao_comercial })} className="font-display font-semibold text-base" />
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-4 w-4 text-danger" /></Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Escopo técnico (interno)</Label>
          <Textarea rows={2} value={local.escopo_tecnico||""} onChange={e=>setLocal({...local, escopo_tecnico:e.target.value})} onBlur={()=>onChange({ escopo_tecnico: local.escopo_tecnico })} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1"><Label className="text-xs">Unidade</Label>
            <Input value={local.unidade} onChange={e=>setLocal({...local, unidade:e.target.value})} onBlur={()=>onChange({ unidade: local.unidade })} /></div>
          <div className="space-y-1"><Label className="text-xs">Qtd</Label>
            <Input type="number" step="0.01" value={local.quantidade} onChange={e=>setLocal({...local, quantidade:e.target.value})} onBlur={()=>onChange({ quantidade: Number(local.quantidade) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Valor unitário</Label>
            <Input type="number" step="0.01" value={local.valor_unitario} onChange={e=>setLocal({...local, valor_unitario:e.target.value})} onBlur={()=>onChange({ valor_unitario: Number(local.valor_unitario) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Total</Label>
            <Input disabled value={brl(Number(local.quantidade||0)*Number(local.valor_unitario||0))} /></div>
        </div>
        {isInternal && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onOpenPricing}>
              <Calculator className="h-4 w-4 mr-1" /> {pricing ? "Recalcular preço" : "Calcular preço com custos"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PricingPanel({ item, existing, params, clientFuncionarios, onSave }: any) {
  const custoHora = params.horas_produtivas_mes > 0 ? Number(params.custo_fixo_mensal||0) / Number(params.horas_produtivas_mes) : 0;
  const [draft, setDraft] = useState<any>(() => existing ? {
    custos: { ...emptyCustos, ...(existing.custos||{}) },
    horas: { ...emptyHoras, ...(existing.horas||{}) },
    aliquota_imposto: existing.aliquota_imposto, margem_desejada: existing.margem_desejada,
    lucro_desejado: existing.lucro_desejado, desconto_comercial: existing.desconto_comercial,
  } : {
    custos: {...emptyCustos}, horas: {...emptyHoras},
    aliquota_imposto: Number(params.aliquota_imposto||0.06),
    margem_desejada: Number(params.margem_minima||0.25),
    lucro_desejado: 0, desconto_comercial: 0,
  });

  const input: PricingInput = useMemo(() => ({
    custos: draft.custos, horas: draft.horas,
    qtd_funcionarios: clientFuncionarios,
    custo_hora_interno: custoHora,
    custo_por_vida: Number(params.custo_por_vida||0),
    aliquota_imposto: Number(draft.aliquota_imposto||0),
    margem_desejada: Number(draft.margem_desejada||0),
    lucro_desejado: Number(draft.lucro_desejado||0),
    desconto_comercial: Number(draft.desconto_comercial||0),
    arredondamento: Number(params.arredondamento||1),
    markup_minimo: Number(params.markup_minimo||1),
    margem_minima: Number(params.margem_minima||0),
  }), [draft, params, custoHora, clientFuncionarios]);
  const c = computePricing(input);
  const meta = statusMargemMeta[c.status_margem];

  const setC = (k:string, v:any) => setDraft({...draft, custos:{...draft.custos, [k]: Number(v)||0 }});
  const setH = (k:string, v:any) => setDraft({...draft, horas:{...draft.horas, [k]: Number(v)||0 }});

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Section title="Custos diretos">
          <Mini label="Deslocamento" v={draft.custos.deslocamento} onChange={v=>setC("deslocamento",v)} />
          <Mini label="Aliment. / hosp." v={draft.custos.alimentacao_hospedagem} onChange={v=>setC("alimentacao_hospedagem",v)} />
          <Mini label="Terceiros" v={draft.custos.terceiros} onChange={v=>setC("terceiros",v)} />
          <Mini label="Exames / lab." v={draft.custos.exames_laboratorio} onChange={v=>setC("exames_laboratorio",v)} />
          <Mini label="Taxas / ART" v={draft.custos.taxas_art} onChange={v=>setC("taxas_art",v)} />
          <Mini label="Equipamentos" v={draft.custos.equipamentos} onChange={v=>setC("equipamentos",v)} />
          <Mini label="Materiais / EPI" v={draft.custos.materiais_epi} onChange={v=>setC("materiais_epi",v)} />
          <Mini label="Taxa por funcionário" v={draft.custos.taxa_por_funcionario} onChange={v=>setC("taxa_por_funcionario",v)} />
          <Mini label="Outros" v={draft.custos.outros} onChange={v=>setC("outros",v)} />
        </Section>
        <Section title="Horas (h)">
          <Mini label="Atendimento" v={draft.horas.atendimento} onChange={v=>setH("atendimento",v)} />
          <Mini label="Análise documental" v={draft.horas.analise_documental} onChange={v=>setH("analise_documental",v)} />
          <Mini label="Deslocamento" v={draft.horas.deslocamento} onChange={v=>setH("deslocamento",v)} />
          <Mini label="Visita técnica" v={draft.horas.visita_tecnica} onChange={v=>setH("visita_tecnica",v)} />
          <Mini label="Elaboração" v={draft.horas.elaboracao} onChange={v=>setH("elaboracao",v)} />
          <Mini label="Revisão" v={draft.horas.revisao} onChange={v=>setH("revisao",v)} />
          <Mini label="Pós-entrega" v={draft.horas.pos_entrega} onChange={v=>setH("pos_entrega",v)} />
        </Section>
      </div>
      <div className="space-y-3">
        <Section title="Parâmetros comerciais">
          <Mini label="Alíquota imp. (0-1)" step="0.01" v={draft.aliquota_imposto} onChange={v=>setDraft({...draft, aliquota_imposto:Number(v)||0})} />
          <Mini label="Margem desejada (0-1)" step="0.01" v={draft.margem_desejada} onChange={v=>setDraft({...draft, margem_desejada:Number(v)||0})} />
          <Mini label="Lucro desejado (R$)" v={draft.lucro_desejado} onChange={v=>setDraft({...draft, lucro_desejado:Number(v)||0})} />
          <Mini label="Desconto (R$)" v={draft.desconto_comercial} onChange={v=>setDraft({...draft, desconto_comercial:Number(v)||0})} />
        </Section>
        <Card className="bg-secondary text-secondary-foreground">
          <CardContent className="p-4 space-y-2 text-sm">
            <Row label="Custo direto"><span className="font-mono">{brl(c.custo_direto_total)}</span></Row>
            <Row label={`Custo horas (${c.horas_total}h)`}><span className="font-mono">{brl(c.custo_horas)}</span></Row>
            <Row label="Custo vidas"><span className="font-mono">{brl(c.custo_vidas)}</span></Row>
            <Row label="Custo total"><span className="font-mono">{brl(c.custo_total)}</span></Row>
            <hr className="border-white/20" />
            <Row label="Preço mínimo"><span className="font-mono">{brl(c.preco_minimo)}</span></Row>
            <Row label="Preço sugerido"><span className="font-mono">{brl(c.preco_sugerido)}</span></Row>
            <Row label="Preço arredondado"><span className="font-mono text-primary text-lg font-bold">{brl(c.preco_arredondado)}</span></Row>
            <hr className="border-white/20" />
            <Row label="Imposto"><span className="font-mono">{brl(c.imposto_estimado)}</span></Row>
            <Row label="Receita líquida"><span className="font-mono">{brl(c.receita_liquida)}</span></Row>
            <Row label="Lucro estimado"><span className="font-mono">{brl(c.lucro_estimado)}</span></Row>
            <Row label="Margem líquida"><span className="font-mono">{pct(c.margem_liquida)}</span></Row>
            <Row label="Markup"><span className="font-mono">{c.markup.toFixed(2)}x</span></Row>
            <div className="pt-2"><Badge className={`border ${meta.color}`}>{meta.label}</Badge></div>
          </CardContent>
        </Card>
        <Button className="w-full" onClick={()=>onSave(draft, c)}>Aplicar preço ao item</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
function Mini({ label, v, onChange, step="0.01" }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input className="h-8" type="number" step={step} value={v ?? 0} onChange={e=>onChange(e.target.value)} />
    </div>
  );
}

function ClientPreview({ proposal, client, items }: any) {
  const total = items.reduce((a:number,b:any)=>a+Number(b.valor_total||0),0);
  return (
    <Card className="shadow-elegant print-page">
      <CardContent className="p-8 space-y-6">
        <header className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <img src={logo} className="h-14 w-14 rounded-md bg-secondary p-1.5" alt="HSE Consulting" />
            <div>
              <div className="font-display text-xl font-bold">HSE Consulting</div>
              <div className="text-xs text-muted-foreground">Saúde, Segurança e Meio Ambiente</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono">Proposta {proposal.numero}</div>
            <div className="text-muted-foreground">{new Date(proposal.created_at).toLocaleDateString("pt-BR")}</div>
            {proposal.validade && <div className="text-muted-foreground">Válida até {new Date(proposal.validade).toLocaleDateString("pt-BR")}</div>}
          </div>
        </header>

        <section>
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-1">Cliente</h2>
          <div className="font-semibold">{client?.razao_social}</div>
          <div className="text-sm text-muted-foreground">
            {[client?.cnpj_cpf, client?.cidade && `${client.cidade}/${client.uf||""}`, client?.solicitante].filter(Boolean).join(" · ")}
          </div>
        </section>

        <section>
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Escopo proposto</h2>
          <ol className="space-y-3">
            {items.map((it:any) => (
              <li key={it.id} className="border border-border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{it.numero_item}. {it.descricao_comercial}</div>
                    <div className="text-xs text-muted-foreground">{it.quantidade} {it.unidade}</div>
                  </div>
                  <div className="font-mono text-right">
                    <div className="text-sm">{brl(it.valor_unitario)}</div>
                    <div className="font-semibold">{brl(it.valor_total)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex justify-end">
          <div className="bg-secondary text-secondary-foreground rounded-md px-6 py-4 text-right">
            <div className="text-xs uppercase tracking-wider opacity-80">Investimento total</div>
            <div className="font-display text-3xl font-bold text-primary">{brl(total)}</div>
          </div>
        </section>

        {(proposal.condicoes_pagamento || proposal.outras_condicoes || proposal.observacoes_comerciais) && (
          <section className="space-y-3 text-sm">
            {proposal.condicoes_pagamento && <div><div className="font-semibold mb-0.5">Condições de pagamento</div><p className="text-muted-foreground whitespace-pre-line">{proposal.condicoes_pagamento}</p></div>}
            {proposal.outras_condicoes && <div><div className="font-semibold mb-0.5">Outras condições</div><p className="text-muted-foreground whitespace-pre-line">{proposal.outras_condicoes}</p></div>}
            {proposal.observacoes_comerciais && <div><div className="font-semibold mb-0.5">Observações</div><p className="text-muted-foreground whitespace-pre-line">{proposal.observacoes_comerciais}</p></div>}
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground border-t border-border pt-4">
          HSE Consulting — Esta proposta é confidencial e dirigida exclusivamente ao destinatário.
        </footer>
      </CardContent>
    </Card>
  );
}