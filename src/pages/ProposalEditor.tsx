import { useEffect, useMemo, useRef, useState } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, Calculator, Printer, FileText, Save, History, AlertTriangle, CheckCircle2, Bookmark, FileDown, Users } from "lucide-react";
import { brl, pct, proposalStatusLabel, proposalOrigemLabel, proposalOrigemColor, formatCnpjCpf, formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { computePricing, statusMargemMeta, type PricingInput } from "@/lib/pricing";
import { toast } from "sonner";
import logo from "@/assets/hse-logo-navy.png";
import ProposalDocument from "@/components/proposal/ProposalDocument";
import GroupPricingDrawer from "@/components/proposal/GroupPricingDrawer";
import HistoricoPrecificacao from "@/components/proposal/HistoricoPrecificacao";

const emptyCustos = { deslocamento:0, alimentacao_hospedagem:0, terceiros:0, exames_laboratorio:0, taxas_art:0, equipamentos:0, materiais_epi:0, taxa_por_funcionario:0, outros:0 };
const emptyHoras = { atendimento:0, analise_documental:0, deslocamento:0, visita_tecnica:0, elaboracao:0, revisao:0, pos_entrega:0, outras:0 };
const horaLabels: Record<string,string> = {
  atendimento: "Atendimento / alinhamento",
  analise_documental: "Análise documental",
  deslocamento: "Deslocamento vinculado",
  visita_tecnica: "Visita técnica / levantamento",
  elaboracao: "Elaboração técnica",
  revisao: "Revisão / ajustes",
  pos_entrega: "Envio / suporte pós-entrega",
  outras: "Outras horas",
};
const custoLabels: Record<string,string> = {
  deslocamento: "Deslocamento",
  alimentacao_hospedagem: "Alimentação / hospedagem",
  terceiros: "Terceiros",
  exames_laboratorio: "Exames / laboratório",
  taxas_art: "Taxas / ART",
  equipamentos: "Equipamentos",
  materiais_epi: "Materiais / EPI",
  taxa_por_funcionario: "Taxa por funcionário",
  outros: "Outros custos",
};

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
  const [revisions, setRevisions] = useState<any[]>([]);
  const [clientView, setClientView] = useState(false);
  const [pricingOpen, setPricingOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirtyTimer = useRef<any>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    if (!id) return;
    const [p, sv, pp] = await Promise.all([
      supabase.from("proposals").select("*, clients(*)").eq("id", id).single(),
      supabase.from("services").select("*").order("nome"),
      supabase.from("pricing_params").select("*").limit(1).maybeSingle(),
    ]);
    if (p.error) { toast.error(p.error.message); return; }
    const proposalData = p.data;
    // Pré-popular condições padrão na primeira abertura
    const patch: any = {};
    if (!proposalData.condicoes_pagamento && pp.data?.condicoes_pagamento_default) patch.condicoes_pagamento = pp.data.condicoes_pagamento_default;
    if (!proposalData.outras_condicoes && pp.data?.outras_condicoes_default) patch.outras_condicoes = pp.data.outras_condicoes_default;
    if (Object.keys(patch).length) {
      await supabase.from("proposals").update(patch).eq("id", proposalData.id);
      Object.assign(proposalData, patch);
    }
    setProposal(proposalData);
    setClient(proposalData.clients || null);
    setServices(sv.data || []);
    setParams(pp.data || { custo_fixo_mensal:0, horas_produtivas_mes:160, custo_por_vida:0, aliquota_imposto:0.10, margem_minima:0.20, markup_minimo:1.5, arredondamento:10 });
    document.title = `${proposalData.numero} | Portal HSE Consulting`;
    const [it, rv] = await Promise.all([
      supabase.from("proposal_items").select("*").eq("proposal_id", id).order("numero_item"),
      supabase.from("proposal_revisions").select("*").eq("proposal_id", id).order("revisao", { ascending: false }),
    ]);
    setItems(it.data || []);
    setRevisions(rv.data || []);
    if (it.data && it.data.length) {
      const pr = await supabase.from("proposal_item_pricing").select("*").in("proposal_item_id", it.data.map(x=>x.id));
      const map: Record<string, any> = {};
      (pr.data || []).forEach(r => { map[r.proposal_item_id] = r; });
      setPricings(map);
    }
  }

  const total = items.reduce((a,b)=>a+Number(b.valor_total||0), 0);
  const totalItens = items.reduce((a,b)=>a+Number(b.quantidade||0), 0);

  /* ---------------- Autosave helpers ---------------- */
  async function saveProposalField(patch: any) {
    if (!proposal) return;
    setSaving(true);
    const { error } = await supabase.from("proposals").update(patch).eq("id", proposal.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setProposal({ ...proposal, ...patch });
  }

  function scheduleProposalSave(patch: any) {
    setProposal((p: any) => ({ ...p, ...patch }));
    if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
    dirtyTimer.current = setTimeout(() => saveProposalField(patch), 700);
  }

  /* ---------------- Cliente (auto-cadastro / upsert) ---------------- */
  async function persistClient(c: any) {
    if (!c) return;
    setSaving(true);
    let saved = c;
    if (c.id) {
      const { error } = await supabase.from("clients").update({
        razao_social: c.razao_social, nome_fantasia: c.nome_fantasia, cnpj_cpf: c.cnpj_cpf,
        qtd_funcionarios: Number(c.qtd_funcionarios)||0, endereco: c.endereco, cidade: c.cidade, uf: c.uf,
        solicitante: c.solicitante, cargo: c.cargo, telefone: c.telefone, whatsapp: c.whatsapp,
        email: c.email, observacoes: c.observacoes,
      }).eq("id", c.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      // Tentar localizar pelo CNPJ — reutilizar / atualizar campos vazios
      let existing: any = null;
      if (c.cnpj_cpf) {
        const { data } = await supabase.from("clients").select("*").eq("cnpj_cpf", c.cnpj_cpf).maybeSingle();
        existing = data;
      }
      if (existing) {
        const merged: any = { ...existing };
        Object.entries(c).forEach(([k,v]) => { if (v && !merged[k]) merged[k] = v; });
        await supabase.from("clients").update(merged).eq("id", existing.id);
        saved = merged;
      } else {
        const { data, error } = await supabase.from("clients").insert({
          razao_social: c.razao_social || "Cliente sem nome",
          nome_fantasia: c.nome_fantasia, cnpj_cpf: c.cnpj_cpf,
          qtd_funcionarios: Number(c.qtd_funcionarios)||0, endereco: c.endereco, cidade: c.cidade, uf: c.uf,
          solicitante: c.solicitante, cargo: c.cargo, telefone: c.telefone, whatsapp: c.whatsapp,
          email: c.email, observacoes: c.observacoes,
        }).select("*").single();
        if (error) { toast.error(error.message); setSaving(false); return; }
        saved = data;
      }
      await supabase.from("proposals").update({ client_id: saved.id }).eq("id", proposal.id);
      setProposal((p:any)=>({ ...p, client_id: saved.id }));
    }
    setClient(saved);
    setSaving(false);
  }

  /* ---------------- Itens ---------------- */
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
      categoria: fromService?.categoria || null,
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
      categoria: merged.categoria || null,
      descricao_comercial: merged.descricao_comercial,
      escopo_tecnico: merged.escopo_tecnico,
      unidade: merged.unidade,
      quantidade: merged.quantidade,
      valor_unitario: merged.valor_unitario,
      valor_total: merged.valor_total,
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

  async function saveItemAsService(it: any) {
    if (!it.descricao_comercial) return toast.error("Item sem nome");
    const { data: existing } = await supabase.from("services").select("id").eq("nome", it.descricao_comercial).maybeSingle();
    if (existing) {
      await updateItem(it, { service_id: existing.id });
      return toast.info("Já existia no catálogo — vínculo atualizado.");
    }
    const { data, error } = await supabase.from("services").insert({
      nome: it.descricao_comercial,
      categoria: it.categoria,
      descricao_comercial: it.descricao_comercial,
      escopo_tecnico: it.escopo_tecnico,
      unidade_padrao: it.unidade,
      valor_referencia: it.valor_unitario,
    }).select("*").single();
    if (error) return toast.error(error.message);
    setServices(s => [...s, data!]);
    await updateItem(it, { service_id: data!.id });
    toast.success("Serviço cadastrado no catálogo");
  }

  /* ---------------- Pricing ---------------- */
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
    const qtd = Math.max(1, Number(item.quantidade||1));
    await updateItem(item, { valor_unitario: Number((computed.preco_arredondado / qtd).toFixed(2)) });
    toast.success("Precificação aplicada ao item");
    setPricingOpen(null);
  }

  /* ---------------- Validação ---------------- */
  function validate(): string[] {
    const errs: string[] = [];
    if (!client?.razao_social) errs.push("Cliente sem razão social");
    if (!client?.cnpj_cpf) errs.push("Cliente sem CNPJ/CPF");
    if (items.length === 0) errs.push("Adicione pelo menos um serviço");
    items.forEach((it,i)=>{
      if (!it.descricao_comercial) errs.push(`Item ${i+1}: descrição vazia`);
      if (!Number(it.valor_unitario)) errs.push(`Item ${i+1}: valor unitário zerado`);
    });
    if (!proposal.validade) errs.push("Defina a validade da proposta");
    if (!proposal.condicoes_pagamento) errs.push("Preencha as condições de pagamento");
    return errs;
  }

  async function changeStatus(novo: string) {
    if (novo === "enviada" || novo === "aprovada") {
      const errs = validate();
      if (errs.length) {
        toast.error("Corrija antes de mudar status", { description: errs.join(" • ") });
        return;
      }
    }
    const patch: any = { status: novo };
    if (novo === "enviada" && !proposal.data_envio) patch.data_envio = new Date().toISOString().slice(0,10);
    if (novo === "aprovada" && !proposal.data_aprovacao) patch.data_aprovacao = new Date().toISOString().slice(0,10);
    if ((novo === "recusada" || novo === "cancelada") && !proposal.data_recusa) patch.data_recusa = new Date().toISOString().slice(0,10);
    await saveProposalField(patch);
    // Recarrega revisões pois o trigger gravou uma nova
    const rv = await supabase.from("proposal_revisions").select("*").eq("proposal_id", proposal.id).order("revisao",{ascending:false});
    setRevisions(rv.data || []);
    toast.success("Status atualizado");
  }

  async function addRevisao(titulo: string, descricao: string) {
    if (!titulo) return;
    await supabase.rpc("add_proposal_revision", { _proposal_id: proposal.id, _titulo: titulo, _descricao: descricao });
    const rv = await supabase.from("proposal_revisions").select("*").eq("proposal_id", proposal.id).order("revisao",{ascending:false});
    setRevisions(rv.data || []);
    toast.success("Revisão registrada");
  }

  if (!proposal || !params) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  const errs = validate();

  return (
    <div className="pb-10">
      <PageHeader title={`Proposta ${proposal.numero}`}
        subtitle={client?.nome_fantasia || client?.razao_social || "Cadastre o cliente abaixo"}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild><Link to="/propostas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
            {saving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Save className="h-3 w-3 animate-pulse" /> salvando…</span>}
            <Button variant="outline" size="sm" onClick={()=>{ setClientView(true); setTimeout(()=>window.print(), 150); }}>
              <FileDown className="h-4 w-4 mr-1" /> Gerar PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={()=>window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
            <Select value={proposal.status} onValueChange={changeStatus}>
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
            <ProposalDocument proposal={proposal} client={client} items={items} revisions={revisions} />
          ) : (
            <Tabs defaultValue="cliente">
              <TabsList>
                <TabsTrigger value="cliente">Cliente</TabsTrigger>
                <TabsTrigger value="itens">Itens & escopo</TabsTrigger>
                <TabsTrigger value="datas">Datas & origem</TabsTrigger>
                <TabsTrigger value="comerciais">Condições</TabsTrigger>
                <TabsTrigger value="internas">Notas internas</TabsTrigger>
                <TabsTrigger value="revisoes"><History className="h-3.5 w-3.5 mr-1" /> Revisões</TabsTrigger>
              </TabsList>

              <TabsContent value="cliente" className="mt-4">
                <ClientCard client={client} setClient={setClient} onSave={persistClient} />
              </TabsContent>

              <TabsContent value="itens" className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm" onClick={()=>addItem()}><Plus className="h-4 w-4 mr-1" /> Adicionar serviço</Button>
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
                    onSaveToCatalog={()=>saveItemAsService(it)}
                    isInternal={isInternal} />
                ))}
              </TabsContent>

              <TabsContent value="datas" className="mt-4">
                <DatesCard proposal={proposal} onSave={saveProposalField} />
              </TabsContent>

              <TabsContent value="comerciais" className="space-y-4 mt-4">
                <Card><CardContent className="p-4 space-y-3">
                  <div className="space-y-1.5"><Label>Escopo geral da proposta</Label>
                    <Textarea rows={3} value={proposal.escopo_geral||""} onChange={e=>scheduleProposalSave({ escopo_geral: e.target.value })} placeholder="Resumo do que está sendo proposto…" /></div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Validade da proposta</Label>
                      <Input type="date" value={proposal.validade||""} onChange={e=>scheduleProposalSave({ validade: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Próximo follow-up</Label>
                      <Input type="date" value={proposal.proximo_followup||""} onChange={e=>scheduleProposalSave({ proximo_followup: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Condições de pagamento</Label>
                    <Textarea rows={4} value={proposal.condicoes_pagamento||""} onChange={e=>scheduleProposalSave({ condicoes_pagamento: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Outras condições</Label>
                    <Textarea rows={6} value={proposal.outras_condicoes||""} onChange={e=>scheduleProposalSave({ outras_condicoes: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Observações para o cliente</Label>
                    <Textarea rows={3} value={proposal.observacoes_comerciais||""} onChange={e=>scheduleProposalSave({ observacoes_comerciais: e.target.value })} /></div>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="internas" className="mt-4">
                <Card><CardContent className="p-4 space-y-2">
                  <Label>Anotações internas (não vai para o cliente)</Label>
                  <Textarea rows={8} value={proposal.observacoes_internas||""} onChange={e=>scheduleProposalSave({ observacoes_internas: e.target.value })} />
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="revisoes" className="mt-4">
                <RevisionsCard revisions={revisions} onAdd={addRevisao} />
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
              <Row label="Serviços">{items.length}</Row>
              <Row label="Qtd. total de itens">{totalItens}</Row>
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
            <CardHeader><CardTitle className="text-base font-display flex items-center gap-2">
              {errs.length ? <AlertTriangle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
              Validação
            </CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {errs.length === 0 ? (
                <p className="text-success">Tudo pronto para enviar ao cliente.</p>
              ) : (
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  {errs.map((e,i)=><li key={i}>{e}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Sheet open={!!pricingOpen} onOpenChange={(o)=>!o && setPricingOpen(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader><SheetTitle>Precificação interna do item</SheetTitle></SheetHeader>
          {pricingOpen && (
            <div className="mt-4">
              <PricingPanel
                item={items.find(i=>i.id===pricingOpen)!}
                existing={pricings[pricingOpen]}
                params={params}
                clientFuncionarios={client?.qtd_funcionarios||0}
                onSave={(draft, computed)=>savePricing(items.find(i=>i.id===pricingOpen)!, draft, computed)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, children }: any) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
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
  const margem = receita > 0 ? lucroTotal / receita : 0;
  return (
    <div className="space-y-2">
      <Row label="Custo total interno"><span className="font-mono">{brl(custoTotal)}</span></Row>
      <Row label="Receita líquida"><span className="font-mono">{brl(receita)}</span></Row>
      <Row label="Lucro estimado"><span className="font-mono">{brl(lucroTotal)}</span></Row>
      <Row label="Margem média"><span className="font-mono">{pct(margem)}</span></Row>
    </div>
  );
}

/* ---------------- Cliente Card ---------------- */
function ClientCard({ client, setClient, onSave }: any) {
  const c = client || {};
  const set = (patch:any) => setClient({ ...c, ...patch });
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Razão social" value={c.razao_social} onChange={v=>set({razao_social:v})} className="sm:col-span-2" />
        <Field label="Nome fantasia" value={c.nome_fantasia} onChange={v=>set({nome_fantasia:v})} />
        <Field label="CNPJ / CPF" value={c.cnpj_cpf} onChange={v=>set({cnpj_cpf:formatCnpjCpf(v)})} />
        <Field label="Qtd. funcionários" type="number" value={c.qtd_funcionarios} onChange={v=>set({qtd_funcionarios:v})} />
        <Field label="Endereço" value={c.endereco} onChange={v=>set({endereco:v})} className="sm:col-span-2" />
        <Field label="Cidade" value={c.cidade} onChange={v=>set({cidade:v})} />
        <Field label="UF" value={c.uf} onChange={v=>set({uf:(v||"").toUpperCase().slice(0,2)})} />
        <Field label="Solicitante" value={c.solicitante} onChange={v=>set({solicitante:v})} />
        <Field label="Cargo" value={c.cargo} onChange={v=>set({cargo:v})} />
        <Field label="Telefone" value={c.telefone} onChange={v=>set({telefone:v})} />
        <Field label="WhatsApp" value={c.whatsapp} onChange={v=>set({whatsapp:v})} />
        <Field label="E-mail" type="email" value={c.email} onChange={v=>set({email:v})} className="sm:col-span-2" />
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Observações internas</Label>
          <Textarea rows={2} value={c.observacoes||""} onChange={e=>set({observacoes:e.target.value})} />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2">
        <p className="text-xs text-muted-foreground">
          {c.id ? "Atualiza o cadastro existente." : "Será cadastrado automaticamente ao salvar (identificador: CNPJ/CPF)."}
        </p>
        <Button onClick={()=>onSave(c)}><Save className="h-4 w-4 mr-1" /> Salvar cliente</Button>
      </div>
    </CardContent></Card>
  );
}

function Field({ label, value, onChange, type="text", className }: any) {
  return (
    <div className={`space-y-1.5 ${className||""}`}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e:any)=>onChange(e.target.value)} />
    </div>
  );
}

/* ---------------- Datas & Origem ---------------- */
function DatesCard({ proposal, onSave }: any) {
  const isRetro = proposal.origem_cadastro === "retroativa" || proposal.origem_cadastro === "importacao_manual";
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Badge className={(proposalOrigemColor[proposal.origem_cadastro]||"") + " border-0"} variant="secondary">
          {proposalOrigemLabel[proposal.origem_cadastro] || "—"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Cadastrada em {formatDateTime(proposal.created_at)}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Origem do cadastro <span className="text-danger">*</span></Label>
          <Select value={proposal.origem_cadastro} onValueChange={(v)=>onSave({ origem_cadastro: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(proposalOrigemLabel).map(([k,v])=>(
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de emissão original <span className="text-danger">*</span></Label>
          <Input type="date" value={proposal.data_emissao||""} onChange={e=>onSave({ data_emissao: e.target.value })} />
          <p className="text-[11px] text-muted-foreground">Referência principal nos relatórios comerciais.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de envio ao cliente</Label>
          <Input type="date" value={proposal.data_envio||""} onChange={e=>onSave({ data_envio: e.target.value })} />
          <p className="text-[11px] text-muted-foreground">Se vazio, assume a data de emissão.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Data de aprovação {proposal.status==="aprovada" && <span className="text-danger">*</span>}
          </Label>
          <Input type="date" value={proposal.data_aprovacao||""} onChange={e=>onSave({ data_aprovacao: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Data de recusa / cancelamento {["recusada","cancelada"].includes(proposal.status) && <span className="text-danger">*</span>}
          </Label>
          <Input type="date" value={proposal.data_recusa||""} onChange={e=>onSave({ data_recusa: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de cadastro no sistema</Label>
          <Input disabled value={formatDateTime(proposal.created_at)} />
        </div>
      </div>

      {isRetro && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Observação retroativa</Label>
            {!proposal.observacao_retroativa && (
              <Button variant="ghost" size="sm" onClick={()=>onSave({ observacao_retroativa: "Proposta cadastrada retroativamente para alimentação inicial do sistema. Data de emissão baseada no documento comercial original." })}>
                Sugerir texto padrão
              </Button>
            )}
          </div>
          <Textarea rows={3} value={proposal.observacao_retroativa||""}
            onChange={e=>onSave({ observacao_retroativa: e.target.value })}
            placeholder="Justificativa do cadastro retroativo (apenas auditoria interna — não vai no PDF do cliente)." />
        </div>
      )}
    </CardContent></Card>
  );
}

/* ---------------- Item Editor ---------------- */
function ItemEditor({ item, pricing, onChange, onRemove, onOpenPricing, onSaveToCatalog, isInternal }: any) {
  const [local, setLocal] = useState(item);
  useEffect(()=>setLocal(item), [item.id, item.valor_unitario, item.valor_total]);
  const margem = pricing?.indicadores?.status_margem;
  const meta = margem ? statusMargemMeta[margem as keyof typeof statusMargemMeta] : null;
  return (
    <Card className="shadow-elegant">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">#{item.numero_item}</Badge>
              {item.categoria && <Badge variant="secondary">{item.categoria}</Badge>}
              {meta && <Badge className={`border ${meta.color}`}>{meta.label}</Badge>}
            </div>
            <Input value={local.descricao_comercial} onChange={e=>setLocal({...local, descricao_comercial:e.target.value})} onBlur={()=>onChange({ descricao_comercial: local.descricao_comercial })} className="font-display font-semibold text-base" placeholder="Nome / descrição comercial" />
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-4 w-4 text-danger" /></Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-xs">Categoria</Label>
            <Input value={local.categoria||""} onChange={e=>setLocal({...local, categoria:e.target.value})} onBlur={()=>onChange({ categoria: local.categoria })} placeholder="PGR, PCMSO, Laudo…" /></div>
          <div className="space-y-1"><Label className="text-xs">Unidade</Label>
            <Input value={local.unidade} onChange={e=>setLocal({...local, unidade:e.target.value})} onBlur={()=>onChange({ unidade: local.unidade })} /></div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Escopo técnico (interno)</Label>
          <Textarea rows={2} value={local.escopo_tecnico||""} onChange={e=>setLocal({...local, escopo_tecnico:e.target.value})} onBlur={()=>onChange({ escopo_tecnico: local.escopo_tecnico })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1"><Label className="text-xs">Qtd</Label>
            <Input type="number" step="0.01" value={local.quantidade} onChange={e=>setLocal({...local, quantidade:e.target.value})} onBlur={()=>onChange({ quantidade: Number(local.quantidade) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Valor unitário</Label>
            <Input type="number" step="0.01" value={local.valor_unitario} onChange={e=>setLocal({...local, valor_unitario:e.target.value})} onBlur={()=>onChange({ valor_unitario: Number(local.valor_unitario) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Total</Label>
            <Input disabled value={brl(Number(local.quantidade||0)*Number(local.valor_unitario||0))} className="font-mono" /></div>
        </div>
        {isInternal && (
          <div className="flex justify-end gap-2">
            {!item.service_id && (
              <Button variant="ghost" size="sm" onClick={onSaveToCatalog}>
                <Bookmark className="h-4 w-4 mr-1" /> Salvar no catálogo
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onOpenPricing}>
              <Calculator className="h-4 w-4 mr-1" /> {pricing ? "Recalcular preço" : "Calcular preço com custos"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Revisões ---------------- */
function RevisionsCard({ revisions, onAdd }: any) {
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Registrar nova revisão</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Título da alteração" value={titulo} onChange={e=>setTitulo(e.target.value)} />
          <Input placeholder="Descrição (opcional)" value={desc} onChange={e=>setDesc(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={()=>{ onAdd(titulo, desc); setTitulo(""); setDesc(""); }} disabled={!titulo}>Adicionar revisão</Button>
        </div>
      </div>
      <hr/>
      {revisions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma revisão ainda. Mudanças de status são registradas automaticamente.</p>}
      <ul className="space-y-2">
        {revisions.map((r:any) => (
          <li key={r.id} className="border border-border rounded-md p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">R{r.revisao}</Badge>
                <span className="font-medium">{r.titulo || "Revisão"}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
            </div>
            {r.descricao && <p className="mt-1 text-muted-foreground">{r.descricao}</p>}
          </li>
        ))}
      </ul>
    </CardContent></Card>
  );
}

/* ---------------- Pricing Panel (Drawer) ---------------- */
function PricingPanel({ item, existing, params, clientFuncionarios, onSave }: any) {
  const custoHora = params.horas_produtivas_mes > 0 ? Number(params.custo_fixo_mensal||0) / Number(params.horas_produtivas_mes) : 0;
  const [draft, setDraft] = useState<any>(() => existing ? {
    custos: { ...emptyCustos, ...(existing.custos||{}) },
    horas: { ...emptyHoras, ...(existing.horas||{}) },
    aliquota_imposto: existing.aliquota_imposto, margem_desejada: existing.margem_desejada,
    lucro_desejado: existing.lucro_desejado, desconto_comercial: existing.desconto_comercial,
  } : {
    custos: {...emptyCustos}, horas: {...emptyHoras},
    aliquota_imposto: Number(params.aliquota_imposto||0.10),
    margem_desejada: Number(params.margem_minima||0.20),
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
    <div className="space-y-5">
      {/* Custos diretos */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Custos diretos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.keys(custoLabels).map(k => (
            <div key={k} className="space-y-1">
              <Label className="text-[11px]">{custoLabels[k]}</Label>
              <Input className="h-8" type="number" step="0.01" value={(draft.custos as any)[k] ?? 0} onChange={e=>setC(k, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="text-right text-xs text-muted-foreground mt-1">Subtotal: <span className="font-mono">{brl(c.custo_direto_total)}</span></div>
      </section>

      {/* Horas */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Horas do serviço / custo hora</h3>
        <div className="text-xs text-muted-foreground mb-2">Custo/hora vindo das configurações: <span className="font-mono font-semibold">{brl(custoHora)}</span></div>
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Atividade</th>
                <th className="text-right px-3 py-2 w-24">Horas</th>
                <th className="text-right px-3 py-2 w-28">Custo/h</th>
                <th className="text-right px-3 py-2 w-32">Custo</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(horaLabels).map(k => {
                const horas = Number((draft.horas as any)[k] || 0);
                const custo = horas * custoHora;
                return (
                  <tr key={k} className="border-t border-border">
                    <td className="px-3 py-1.5">{horaLabels[k]}</td>
                    <td className="px-2 py-1.5"><Input className="h-8 text-right" type="number" step="0.5" value={horas} onChange={e=>setH(k, e.target.value)} /></td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">{brl(custoHora)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{brl(custo)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold">
              <tr className="border-t border-border">
                <td className="px-3 py-2 text-right">Totais</td>
                <td className="px-3 py-2 text-right font-mono">{c.horas_total}h</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right font-mono">{brl(c.custo_horas)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Formação do preço */}
      <section className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Formação do preço</h3>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Imposto (0-1)" v={draft.aliquota_imposto} onChange={v=>setDraft({...draft, aliquota_imposto:Number(v)||0})} />
            <Mini label="Margem desejada (0-1)" v={draft.margem_desejada} onChange={v=>setDraft({...draft, margem_desejada:Number(v)||0})} />
            <Mini label="Lucro adicional (R$)" v={draft.lucro_desejado} onChange={v=>setDraft({...draft, lucro_desejado:Number(v)||0})} />
            <Mini label="Desconto (R$)" v={draft.desconto_comercial} onChange={v=>setDraft({...draft, desconto_comercial:Number(v)||0})} />
          </div>
        </div>
        <Card className="bg-secondary text-secondary-foreground">
          <CardContent className="p-4 space-y-1.5 text-sm">
            <Row label="Custo total"><span className="font-mono">{brl(c.custo_total)}</span></Row>
            <Row label="Preço mínimo"><span className="font-mono">{brl(c.preco_minimo)}</span></Row>
            <Row label="Preço sugerido"><span className="font-mono">{brl(c.preco_sugerido)}</span></Row>
            <Row label="Preço comercial"><span className="font-mono text-primary text-lg font-bold">{brl(c.preco_arredondado)}</span></Row>
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
        <Button onClick={()=>onSave(draft, c)}><Save className="h-4 w-4 mr-1" /> Aplicar preço ao item</Button>
      </div>
    </div>
  );
}

function Mini({ label, v, onChange }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input className="h-8" type="number" step="0.01" value={v ?? 0} onChange={e=>onChange(e.target.value)} />
    </div>
  );
}

/* ---------------- Visão do cliente ---------------- */
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
            {[client?.cnpj_cpf, client?.cidade && `${client.cidade}/${client.uf||""}`, client?.solicitante && `Contato: ${client.solicitante}${client.cargo ? " ("+client.cargo+")" : ""}`].filter(Boolean).join(" · ")}
          </div>
        </section>

        {proposal.escopo_geral && (
          <section>
            <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-1">Escopo</h2>
            <p className="text-sm whitespace-pre-line">{proposal.escopo_geral}</p>
          </section>
        )}

        <section>
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Serviços propostos</h2>
          <ol className="space-y-3">
            {items.map((it:any) => (
              <li key={it.id} className="border border-border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{it.numero_item}. {it.descricao_comercial}</div>
                    {it.categoria && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.categoria}</div>}
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