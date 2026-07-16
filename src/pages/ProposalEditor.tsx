import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PercentInput } from "@/components/ui/percent-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, Calculator, FileText, Save, History, AlertTriangle, CheckCircle2, Bookmark, FileDown, Users, Eye } from "lucide-react";
import { brl, pct, proposalStatusLabel, proposalOrigemLabel, proposalOrigemColor, formatCnpjCpf, formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
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
import { toast } from "sonner";
import logo from "@/assets/hse-logo-navy.png";
import ProposalDocument from "@/components/proposal/ProposalDocument";
import CnpjLookupField from "@/components/CnpjLookupField";
import CategoryCombobox from "@/components/CategoryCombobox";
import { useIsMobile } from "@/hooks/use-mobile";
import GroupPricingDrawer from "@/components/proposal/GroupPricingDrawer";
import HistoricoPrecificacao from "@/components/proposal/HistoricoPrecificacao";
import AceiteLinkCard from "@/components/proposal/AceiteLinkCard";
import EmpresasProposta from "@/components/proposal/EmpresasProposta";
import CondicaoPagamentoPicker from "@/components/proposal/CondicaoPagamentoPicker";
import ClientCard from "@/components/proposal/ClientCard";
import DatesCard from "@/components/proposal/DatesCard";
import ItemEditor from "@/components/proposal/ItemEditor";
import RevisionsCard from "@/components/proposal/RevisionsCard";
import InlinePricingPanel from "@/components/proposal/InlinePricingPanel";
import ClientPreview from "@/components/proposal/ClientPreview";
import { Row, ResumoValor, InternalSummary, calcDescontoRevisao } from "@/components/proposal/ProposalSummary";

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ProposalEditor() {
  const { id } = useParams<{id:string}>();
  const nav = useNavigate();
  const { isInternal } = useAuth();
  const isMobile = useIsMobile();
  const [proposal, setProposal] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [pricings, setPricings] = useState<Record<string, any>>({});
  const [proposalClients, setProposalClients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [params, setParams] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [clientViewRaw, setClientView] = useState(false);
  // No mobile a visão do cliente fica desligada (evita toque acidental no header)
  const clientView = isMobile ? false : clientViewRaw;
  const [pricingOpen, setPricingOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [groupOpen, setGroupOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirtyTimer = useRef<any>(null);
  const [docReady, setDocReady] = useState(false);

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
    // Pré-popular condições padrão APENAS na primeira abertura (campo nunca preenchido).
    // Usar == null evita re-preencher quando o usuário apagou o texto propositalmente
    // (nesse caso o valor salvo é "" e deve ser respeitado).
    const patch: any = {};
    if (proposalData.condicoes_pagamento == null && pp.data?.condicoes_pagamento_default) patch.condicoes_pagamento = pp.data.condicoes_pagamento_default;
    if (proposalData.outras_condicoes == null && pp.data?.outras_condicoes_default) patch.outras_condicoes = pp.data.outras_condicoes_default;
    if (Object.keys(patch).length) {
      await supabase.from("proposals").update(patch).eq("id", proposalData.id);
      Object.assign(proposalData, patch);
    }
    setProposal(proposalData);
    setClient(proposalData.clients || null);
    setServices(sv.data || []);
    setParams(pp.data || { custo_fixo_mensal:0, horas_produtivas_mes:160, custo_por_vida:0, aliquota_imposto:0.10, margem_minima:0.20, markup_minimo:1.5, arredondamento:1, valor_hora_tecnica: 35 });
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
    const { data: pcs } = await supabase.from("proposal_clients")
      .select("*, clients(id,razao_social,nome_fantasia,cnpj_cpf,cidade,uf,endereco,solicitante,cargo,telefone,email)")
      .eq("proposal_id", id)
      .order("papel", { ascending: true })
      .order("ordem", { ascending: true });
    setProposalClients(pcs || []);
  }

  const total = items.reduce((a,b)=>a+Number(b.valor_total||0), 0);
  const totalItens = items.reduce((a,b)=>a+Number(b.quantidade||0), 0);

  /* ---------------- Autosave helpers ---------------- */
  async function saveProposalField(patch: any): Promise<boolean> {
    if (!proposal) return false;
    setSaving(true);
    const { error } = await supabase.from("proposals").update(patch).eq("id", proposal.id);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    setProposal({ ...proposal, ...patch });
    return true;
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
        qtd_funcionarios: Number(c.qtd_funcionarios)||0, endereco: c.endereco,
        bairro: c.bairro, cep: c.cep, cidade: c.cidade, uf: c.uf,
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
          qtd_funcionarios: Number(c.qtd_funcionarios)||0, endereco: c.endereco,
          bairro: c.bairro, cep: c.cep, cidade: c.cidade, uf: c.uf,
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
    const hasPricingTemplate = !!(fromService?.pricing_configurada);
    const valorUnit = hasPricingTemplate
      ? Number(fromService?.pricing_preco_arredondado || fromService?.valor_referencia || 0)
      : Number(fromService?.valor_referencia || 0);
    const payload = {
      proposal_id: proposal.id, numero_item,
      service_id: fromService?.id || null,
      categoria: fromService?.categoria || null,
      nome: fromService?.nome || "Novo item",
      descricao_comercial: fromService?.descricao_comercial || fromService?.nome || "Novo item",
      escopo_tecnico: fromService?.escopo_tecnico || "",
      entregaveis: fromService?.entregaveis || "",
      observacoes_escopo: fromService?.observacoes_escopo || "",
      quantidade_tecnica: fromService?.quantidade_tecnica || "",
      quantidade: 1,
      valor_unitario: valorUnit,
      valor_total: valorUnit,
    };
    const { data, error } = await supabase.from("proposal_items").insert(payload).select("*").single();
    if (error) return toast.error(error.message);
    const next = [...items, data!];
    setItems(next); updateTotal(next);

    // Se o serviço tem template de precificação, cria proposal_item_pricing automaticamente
    if (hasPricingTemplate && data) {
      const pricingPayload = {
        proposal_item_id: data.id,
        custos: fromService.pricing_custos || [],
        horas: fromService.pricing_horas || [],
        aliquota_imposto: Number(fromService.pricing_aliquota_imposto ?? params?.aliquota_imposto ?? 0.10),
        margem_desejada: Number(fromService.pricing_margem_desejada ?? params?.margem_minima ?? 0.20),
        lucro_desejado: Number(fromService.pricing_lucro_desejado || 0),
        desconto_comercial: Number(fromService.pricing_desconto_comercial || 0),
        preco_sugerido: Number(fromService.pricing_preco_sugerido || 0),
        preco_arredondado: Number(fromService.pricing_preco_arredondado || valorUnit),
        preco_aprovado: Number(fromService.pricing_preco_arredondado || valorUnit),
        indicadores: fromService.pricing_indicadores || {},
      };
      const { data: pr } = await supabase.from("proposal_item_pricing").insert(pricingPayload).select("*").single();
      if (pr) setPricings((prev) => ({ ...prev, [data.id]: pr }));
    }
  }

  async function updateItem(it: any, patch: any) {
    const merged = { ...it, ...patch };
    merged.valor_total = Number(merged.quantidade||0) * Number(merged.valor_unitario||0);
    const { error } = await supabase.from("proposal_items").update({
      categoria: merged.categoria || null,
      nome: merged.nome,
      descricao_comercial: merged.descricao_comercial,
      escopo_tecnico: merged.escopo_tecnico,
      entregaveis: merged.entregaveis ?? null,
      observacoes_escopo: merged.observacoes_escopo ?? null,
      quantidade_tecnica: merged.quantidade_tecnica ?? null,
      quantidade: merged.quantidade,
      valor_unitario: merged.valor_unitario,
      valor_total: merged.valor_total,
      client_id: merged.client_id ?? null,
      rateado: merged.rateado ?? false,
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
    const nomeRef = (it.nome || it.descricao_comercial || "").trim();
    if (!nomeRef) return toast.error("Item sem nome");
    const { data: existing } = await supabase.from("services").select("id").eq("nome", nomeRef).maybeSingle();
    if (existing) {
      await updateItem(it, { service_id: existing.id });
      return toast.info("Já existia no catálogo — vínculo atualizado.");
    }
    const { data, error } = await supabase.from("services").insert({
      nome: nomeRef,
      categoria: it.categoria,
      descricao_comercial: it.descricao_comercial,
      escopo_tecnico: it.escopo_tecnico,
      entregaveis: it.entregaveis,
      observacoes_escopo: it.observacoes_escopo,
      quantidade_tecnica: it.quantidade_tecnica,
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
    const qtd = Math.max(1, Number(item.quantidade||1));
    const valorAnt = Number(item.valor_unitario||0) * qtd;
    const hasExistingId = existing && existing.id;
    const { data: savedRow, error } = hasExistingId
      ? await supabase.from("proposal_item_pricing").update(payload).eq("id", existing.id).select("*").single()
      : await supabase.from("proposal_item_pricing").insert(payload).select("*").single();
    if (error) return toast.error(error.message);
    setPricings({ ...pricings, [item.id]: savedRow || { ...existing, ...payload } });
    await updateItem(item, { valor_unitario: Number((computed.preco_arredondado / qtd).toFixed(2)) });
    // Registra simulação individual + histórico
    try {
      const { data: sim } = await supabase.from("simulacoes_precificacao").insert({
        proposal_id: proposal.id,
        tipo: "individual",
        regra_rateio: "igual",
        aplicada: true,
        aplicada_em: new Date().toISOString(),
        totais: computed as any,
      }).select("id").single();
      if (sim) {
        await supabase.from("simulacao_itens").insert({
          simulacao_id: sim.id,
          proposal_item_id: item.id,
          custos_individuais: draft.custos,
          horas: draft.horas,
          aliquota_imposto: draft.aliquota_imposto,
          margem_desejada: draft.margem_desejada,
          lucro_desejado: draft.lucro_desejado,
          desconto_comercial: draft.desconto_comercial,
          custo_individual: computed.custo_total,
          custo_total: computed.custo_total,
          preco_sugerido: computed.preco_sugerido,
          preco_final: computed.preco_arredondado,
          lucro_estimado: computed.lucro_estimado,
          margem_liquida: computed.margem_liquida,
          markup: computed.markup,
          status_margem: computed.status_margem,
          indicadores: computed as any,
        });
        await supabase.from("historico_precificacao").insert({
          proposal_id: proposal.id,
          simulacao_id: sim.id,
          proposal_item_id: item.id,
          acao: "aplicada_individual",
          valor_anterior: valorAnt,
          valor_novo: computed.preco_arredondado,
          detalhes: { regra: "individual" } as any,
        });
      }
    } catch { /* histórico é best-effort */ }
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
      if (!(it.nome || it.descricao_comercial)) errs.push(`Item ${i+1}: nome vazio`);
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
    const ok = await saveProposalField(patch);
    if (!ok) return;
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

  async function handlePrint() {
    // Padrão de nome do arquivo: "Proposta P-2026-51842 - Zanotti".
    const clienteNome = client?.nome_fantasia || client?.razao_social || "Cliente";
    const safe = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "").trim();
    const numero = String(proposal.numero || "").trim();
    const numeroFmt = /^P-/i.test(numero) ? numero : (numero ? `P-${numero}` : "P-");
    const revNum = Number(proposal.revisao_atual ?? 0);
    const revSuffix = revNum > 0 ? `_Rev${String(revNum).padStart(2, "0")}` : "";
    const printTitle = `Proposta ${numeroFmt} - ${safe(clienteNome)}${revSuffix}`;
    const escapeHtml = (s: string) => s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    // Abrir a janela imediatamente preserva o gesto do clique e evita bloqueio
    // de popup. Como ela é top-level, o Chrome usa este <title> como nome do PDF,
    // não o título do portal/preview onde o app está embutido.
    const printWindow = window.open("", "_blank", "width=980,height=1200");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(printTitle)}</title><style>body{margin:0;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;color:#0f172a}p{font-size:14px}</style></head><body><p>Preparando PDF…</p></body></html>`);
      printWindow.document.close();
    }

    // Aguarda o documento estar totalmente montado (paginado + imagens carregadas).
    const t0 = Date.now();
    while (!docReady) {
      if (Date.now() - t0 > 8000) {
        printWindow?.close();
        toast.error("Não foi possível preparar o documento para impressão.");
        return;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    const t1 = Date.now();
    while (document.querySelectorAll(".proposal-doc .pdf-page").length < 3) {
      if (Date.now() - t1 > 5000) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const srcImgs = Array.from(document.querySelectorAll(".proposal-doc img")) as HTMLImageElement[];
    await Promise.all(srcImgs.map(img => img.complete ? null : new Promise(res => {
      img.onload = img.onerror = () => res(null);
    })));

    const sourceDoc = document.querySelector(".proposal-doc") as HTMLElement | null;
    if (!sourceDoc) {
      printWindow?.close();
      toast.error("Documento da proposta não encontrado para impressão.");
      return;
    }

    if (!printWindow) {
      toast.error("O navegador bloqueou a janela de impressão. Libere pop-ups para gerar o PDF com o nome correto.");
      return;
    }

    const copiedHead = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join("\n");
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(printTitle)}</title>
          ${copiedHead}
          <style>
            @page { size: A4; margin: 0; }
            html, body {
              width: 210mm;
              margin: 0;
              padding: 0;
              background: #fff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .proposal-doc { width: 210mm; margin: 0; padding: 0; }
            .pdf-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; break-after: page; }
            .pdf-page:last-child { page-break-after: auto; break-after: auto; }
            .avoid-break { break-inside: avoid; page-break-inside: avoid; }
            @media screen { body { margin: 0 auto; } }
          </style>
        </head>
        <body>${sourceDoc.outerHTML}</body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = printTitle;

    const targetImgs = Array.from(printWindow.document.images) as HTMLImageElement[];
    await Promise.all(targetImgs.map(img => img.complete ? null : new Promise(res => {
      img.onload = img.onerror = () => res(null);
    })));
    await printWindow.document.fonts?.ready.catch(() => undefined);
    await new Promise<void>((res) => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => res())));

    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="pb-10">
      <PageHeader title={`Proposta ${proposal.numero}`}
        subtitle={client?.nome_fantasia || client?.razao_social || "Cadastre o cliente abaixo"}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild><Link to="/propostas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
            {saving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Save className="h-3 w-3 animate-pulse" /> salvando…</span>}
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!docReady}>
              <FileDown className="h-4 w-4 mr-1" /> Gerar PDF
            </Button>
            <Select value={proposal.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(proposalStatusLabel).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            {isInternal && !isMobile && (
              <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-md bg-muted">
                <Switch checked={clientView} onCheckedChange={setClientView} id="cv" />
              <Label htmlFor="cv" className="text-xs cursor-pointer">Visualizar Proposta</Label>
              </div>
            )}
          </>
        } />

      <div className={`p-6 grid gap-6 ${clientView ? "" : "lg:grid-cols-3"}`}>
        <div className={`${clientView ? "" : "lg:col-span-2"} space-y-6 min-w-0`}>
          {proposal.bloqueada_edicao && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Proposta com revisão <strong>Rev. {String(proposal.revisao_atual ?? 0).padStart(2,"0")}</strong> aprovada — edições comerciais estão bloqueadas. Para alterar valores, crie uma nova revisão na aba <em>Revisões</em>.
              </span>
            </div>
          )}
          {clientView ? (
            <ProposalDocument proposal={proposal} client={client} items={items} revisions={revisions} proposalClients={proposalClients} onReady={()=>setDocReady(true)} />
          ) : (
            <>
            <Tabs defaultValue="cliente">
              <TabsList className="flex flex-wrap h-auto justify-start gap-1">
                <TabsTrigger value="cliente">Cliente</TabsTrigger>
                <TabsTrigger value="empresas"><Users className="h-3.5 w-3.5 mr-1" /> Empresas</TabsTrigger>
                <TabsTrigger value="itens">Itens & escopo</TabsTrigger>
                <TabsTrigger value="datas">Datas & origem</TabsTrigger>
                <TabsTrigger value="comerciais">Condições</TabsTrigger>
                <TabsTrigger value="internas">Notas internas</TabsTrigger>
                <TabsTrigger value="revisoes"><History className="h-3.5 w-3.5 mr-1" /> Revisões</TabsTrigger>
                {isInternal && <TabsTrigger value="historico_prec"><Calculator className="h-3.5 w-3.5 mr-1" /> Histórico de preços</TabsTrigger>}
              </TabsList>

              <TabsContent value="cliente" className="mt-4">
                <ClientCard client={client} setClient={setClient} onSave={persistClient} />
              </TabsContent>

              <TabsContent value="empresas" className="mt-4">
                <EmpresasProposta
                  proposalId={proposal.id}
                  proposal={proposal}
                  onProposalPatch={async (patch) => { await saveProposalField(patch); }}
                  onChange={load}
                />
              </TabsContent>

              <TabsContent value="itens" className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm" onClick={()=>addItem()}><Plus className="h-4 w-4 mr-1" /> Adicionar serviço</Button>
                  <Select onValueChange={(v) => { const s = services.find(x=>x.id===v); if (s) addItem(s); }}>
                    <SelectTrigger className="w-72"><SelectValue placeholder="…ou adicionar do catálogo" /></SelectTrigger>
                    <SelectContent>{services.map(s=><SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  {isInternal && (() => {
                    const count = Object.values(selected).filter(Boolean).length;
                    return (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{count} selecionado(s)</span>
                        <Button size="sm" variant="outline" disabled={count < 1} onClick={()=>setGroupOpen(true)}>
                          <Users className="h-4 w-4 mr-1" /> Calcular em grupo
                        </Button>
                      </div>
                    );
                  })()}
                </div>
                {items.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhum item ainda. Adicione o primeiro serviço.</Card>}
                {items.map(it => (
                  <ItemEditor key={it.id} item={it} pricing={pricings[it.id]}
                    onChange={(patch)=>updateItem(it, patch)}
                    onRemove={()=>removeItem(it)}
                    onOpenPricing={()=>setPricingOpen(it.id)}
                    onSaveToCatalog={()=>saveItemAsService(it)}
                    isInternal={isInternal}
                    proposalClients={proposalClients}
                    modoFaturamento={proposal.modo_faturamento}
                    selected={!!selected[it.id]}
                    onSelect={(v)=>setSelected(s=>({ ...s, [it.id]: v }))} />
                ))}
                <Card>
                  <CardContent className="p-4 space-y-1.5">
                    <Label>Observações técnicas gerais</Label>
                    <p className="text-xs text-muted-foreground">
                      Informações técnicas gerais do serviço como um todo. Aparece no PDF do cliente, após o escopo dos serviços e antes do investimento. Opcional.
                    </p>
                    <Textarea rows={5}
                      value={proposal.observacoes_tecnicas||""}
                      onChange={e=>scheduleProposalSave({ observacoes_tecnicas: e.target.value })}
                      placeholder="Ex.: metodologia adotada, normas de referência, premissas técnicas comuns a todos os itens, exclusões, condições de acesso ao campo…" />
                  </CardContent>
                </Card>
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
                      <Input type="date" value={proposal.validade||""} onChange={e=>scheduleProposalSave({ validade: e.target.value || null })} /></div>
                    <div className="space-y-1.5"><Label>Próximo follow-up</Label>
                      <Input type="date" value={proposal.proximo_followup||""} onChange={e=>scheduleProposalSave({ proximo_followup: e.target.value || null })} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <CondicaoPagamentoPicker
                      proposalId={proposal.id}
                      total={total}
                      legacyTexto={proposal.condicoes_pagamento || null}
                      onSaved={(texto) => setProposal((p: any) => ({ ...p, condicoes_pagamento: texto }))}
                    />
                  </div>
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
                <RevisionsCard
                  proposalId={proposal.id}
                  valorAtual={total}
                  revisions={revisions}
                  onChanged={load}
                />
              </TabsContent>

              {isInternal && (
                <TabsContent value="historico_prec" className="mt-4">
                  <HistoricoPrecificacao proposalId={proposal.id} />
                </TabsContent>
              )}
            </Tabs>
            {/* Documento sempre montado para impressão. Precisa ficar com layout real
                (não display:none) para o paginador dinâmico medir as alturas corretamente.
                Fica posicionado fora da tela e é revelado apenas em @media print. */}
            <div
              className="print-doc-holder"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-100vw",
                top: 0,
                width: "230mm",
                pointerEvents: "none",
              }}
            >
              <ProposalDocument proposal={proposal} client={client} items={items} revisions={revisions} proposalClients={proposalClients} onReady={()=>setDocReady(true)} />
            </div>
            </>
          )}
        </div>

        {!clientView && (<aside className="space-y-4">
          <Card className="shadow-elegant">
            <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Status"><Badge>{proposalStatusLabel[proposal.status]}</Badge></Row>
              <Row label="Cliente">{client?.nome_fantasia || client?.razao_social || "—"}</Row>
              <Row label="Serviços">{items.length}</Row>
              <Row label="Qtd. total de itens">{totalItens}</Row>
              <ResumoValor total={total} revisions={revisions} />
              {isInternal && !clientView && (
                <>
                  <hr/>
                  <InternalSummary items={items} pricings={pricings} descontoRevisao={calcDescontoRevisao(total, revisions)} />
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

          {!clientView && (
            <AceiteLinkCard
              proposalId={proposal.id}
              revisaoAtual={proposal.revisao_atual ?? null}
              proposalNumero={proposal.numero}
              proposalTitulo={proposal.titulo}
              valorTotal={proposal.valor_total}
              validade={proposal.validade}
              clienteNome={client?.nome_fantasia || client?.razao_social}
              clienteEmail={client?.email}
              clienteSolicitante={client?.solicitante}
            />
          )}
        </aside>)}
      </div>

      <Sheet open={!!pricingOpen} onOpenChange={(o)=>!o && setPricingOpen(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader><SheetTitle>Precificação interna do item</SheetTitle></SheetHeader>
          {pricingOpen && (
            <div className="mt-4">
              <InlinePricingPanel
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

      {isInternal && (
        <GroupPricingDrawer
          open={groupOpen}
          onClose={()=>setGroupOpen(false)}
          proposalId={proposal.id}
          clientFuncionarios={client?.qtd_funcionarios || 0}
          items={items.filter(it => selected[it.id])}
          existingPricings={pricings}
          params={params}
          onApplied={()=>{ setSelected({}); load(); }}
        />
      )}
    </div>
  );
}
}