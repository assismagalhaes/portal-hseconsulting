import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, Plus, Trash2, Calculator, FileText, Save, History, AlertTriangle, CheckCircle2, Bookmark, FileDown, Users, Eye, Check, ChevronsDownUp, ChevronsUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import PremissasPicker from "@/components/proposal/PremissasPicker";
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
import {
  loadProposalBundle,
  updateProposal,
  updateProposalTotal,
  upsertProposalClient,
  insertProposalItem,
  updateProposalItem as updateProposalItemDb,
  deleteProposalItem,
  findServiceByName,
  insertService,
  insertItemPricing,
  upsertItemPricing,
  recordIndividualPricingHistory,
  listRevisions,
  addRevisao as addRevisaoDb,
} from "@/lib/propostas";

const newId = () => Math.random().toString(36).slice(2, 10);

function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="absolute -left-1 top-3 z-10 p-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 transition"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="pl-5">{children}</div>
    </div>
  );
}

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
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  const [groupOpen, setGroupOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<any | null>(null);
  const [duplicatePickServiceId, setDuplicatePickServiceId] = useState<string | "__blank__" | "__keep__">("__keep__");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("proposal.internalSummary.open") !== "0";
  });
  useEffect(() => {
    try { window.localStorage.setItem("proposal.internalSummary.open", internalOpen ? "1" : "0"); } catch {}
  }, [internalOpen]);
  const [, setSavedTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const t = setTimeout(() => setSavedTick((x) => x + 1), 4100);
    return () => clearTimeout(t);
  }, [lastSavedAt]);
  const dirtyTimer = useRef<any>(null);
  const [docReady, setDocReady] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((x) => x.id === active.id);
    const newIndex = items.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((x, i) => ({ ...x, numero_item: i + 1 }));
    setItems(reordered);
    try {
      await Promise.all(
        reordered.map((x) => updateProposalItemDb(x.id, { numero_item: x.numero_item })),
      );
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reordenar itens");
      load();
    }
  }

  useEffect(() => { load(); }, [id]);

  // Atalhos de teclado (somente na edição interna, evita conflito com formulários do cliente)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isField = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      // Alt+N — novo item (funciona mesmo dentro de campos)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        addItem();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isField) return;
      if (e.key === "p" || e.key === "P") { e.preventDefault(); setPreviewOpen(true); }
      else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        const allCollapsed = items.length > 0 && items.every(i => collapsedItems[i.id]);
        if (allCollapsed) setCollapsedItems({});
        else setCollapsedItems(Object.fromEntries(items.map(i => [i.id, true])));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, collapsedItems, proposal?.id]);

  async function load() {
    if (!id) return;
    try {
      const bundle = await loadProposalBundle(id);
      setProposal(bundle.proposal);
      setClient(bundle.client);
      setServices(bundle.services);
      setParams(bundle.params);
      setItems(bundle.items);
      setRevisions(bundle.revisions);
      setPricings(bundle.pricings);
      setProposalClients(bundle.proposalClients);
      document.title = `${bundle.proposal.numero} | Portal HSE Consulting`;
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar proposta");
    }
  }

  const total = items.reduce((a,b)=>a+Number(b.valor_total||0), 0);
  const totalItens = items.reduce((a,b)=>a+Number(b.quantidade||0), 0);

  /* ---------------- Autosave helpers ---------------- */
  async function saveProposalField(patch: any): Promise<boolean> {
    if (!proposal) return false;
    setSaving(true);
    try {
      await updateProposal(proposal.id, patch);
      setProposal({ ...proposal, ...patch });
      setLastSavedAt(Date.now());
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
      return false;
    } finally {
      setSaving(false);
    }
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
    try {
      const saved = await upsertProposalClient(proposal.id, c);
      if (!c.id) setProposal((p: any) => ({ ...p, client_id: saved.id }));
      setClient(saved);
      setLastSavedAt(Date.now());
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar cliente");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Itens ---------------- */
  async function updateTotal(newItems: any[]) {
    const t = newItems.reduce((a,b)=>a+Number(b.valor_total||0),0);
    await updateProposalTotal(proposal.id, t);
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
    let data: any;
    try {
      data = await insertProposalItem(payload);
    } catch (e: any) {
      return toast.error(e?.message || "Falha ao adicionar item");
    }
    const next = [...items, data];
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
      try {
        const pr = await insertItemPricing(pricingPayload);
        if (pr) setPricings((prev) => ({ ...prev, [data.id]: pr }));
      } catch { /* pricing template é best-effort */ }
    }
  }

  async function updateItem(it: any, patch: any) {
    const merged = { ...it, ...patch };
    merged.valor_total = Number(merged.quantidade||0) * Number(merged.valor_unitario||0);
    setSaving(true);
    try {
      await updateProposalItemDb(it.id, {
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
      });
    } catch (e: any) {
      setSaving(false);
      return toast.error(e?.message || "Falha ao salvar item");
    }
    setSaving(false);
    setLastSavedAt(Date.now());
    const next = items.map(x => x.id === it.id ? merged : x);
    setItems(next); updateTotal(next);
  }

  async function removeItem(it: any) {
    await deleteProposalItem(it.id);
    const remaining = items.filter(x => x.id !== it.id);
    const next = remaining.map((x, i) => ({ ...x, numero_item: i + 1 }));
    await Promise.all(
      next
        .filter((x, i) => x.numero_item !== remaining[i].numero_item)
        .map(x => updateProposalItemDb(x.id, { numero_item: x.numero_item }))
    );
    setItems(next); updateTotal(next);
  }

  async function duplicateItem(it: any, mode: "keep" | "blank" | string = "keep") {
    const numero_item = (items[items.length - 1]?.numero_item || 0) + 1;
    // `mode` = "keep"  → copia dados do item original com sufixo "(cópia)"
    //         "blank" → cria item em branco (usuário digita depois)
    //         <uuid>  → usa dados de um serviço do catálogo
    const svc = mode !== "keep" && mode !== "blank" ? services.find((s) => s.id === mode) : null;
    const base: any = svc
      ? {
          service_id: svc.id,
          categoria: svc.categoria || null,
          nome: svc.nome || "Novo item",
          descricao_comercial: svc.descricao_comercial || svc.nome || "",
          escopo_tecnico: svc.escopo_tecnico || "",
          entregaveis: svc.entregaveis || "",
          observacoes_escopo: svc.observacoes_escopo || "",
          quantidade_tecnica: svc.quantidade_tecnica || "",
        }
      : mode === "blank"
        ? {
            service_id: null, categoria: null, nome: "Novo item",
            descricao_comercial: "", escopo_tecnico: "",
            entregaveis: "", observacoes_escopo: "", quantidade_tecnica: "",
          }
        : {
            service_id: it.service_id || null,
            categoria: it.categoria || null,
            nome: it.nome ? `${it.nome} (cópia)` : "Novo item",
            descricao_comercial: it.descricao_comercial || "",
            escopo_tecnico: it.escopo_tecnico || "",
            entregaveis: it.entregaveis || "",
            observacoes_escopo: it.observacoes_escopo || "",
            quantidade_tecnica: it.quantidade_tecnica || "",
          };
    const payload: any = {
      proposal_id: proposal.id,
      numero_item,
      ...base,
      quantidade: Number(it.quantidade) || 1,
      valor_unitario: Number(it.valor_unitario) || 0,
      valor_total: Number(it.valor_total) || 0,
      client_id: it.client_id || null,
      rateado: !!it.rateado,
    };
    let data: any;
    try {
      data = await insertProposalItem(payload);
    } catch (e: any) {
      return toast.error(e?.message || "Falha ao duplicar item");
    }
    const next = [...items, data];
    setItems(next);
    updateTotal(next);

    // Copia a precificação interna, se existir no item original (essa é a razão
    // principal do "duplicar" no fluxo real — reaproveitar custos/margem já
    // calculados independentemente do serviço escolhido).
    const src = pricings[it.id];
    if (src && data) {
      try {
        const pr = await insertItemPricing({
          proposal_item_id: data.id,
          custos: src.custos || [],
          horas: src.horas || [],
          aliquota_imposto: src.aliquota_imposto,
          margem_desejada: src.margem_desejada,
          lucro_desejado: src.lucro_desejado,
          desconto_comercial: src.desconto_comercial,
          preco_sugerido: src.preco_sugerido,
          preco_arredondado: src.preco_arredondado,
          preco_aprovado: src.preco_aprovado,
          indicadores: src.indicadores || {},
        });
        if (pr) setPricings((prev) => ({ ...prev, [data.id]: pr }));
      } catch { /* best-effort */ }
    }
    toast.success(svc ? `Item duplicado com dados de "${svc.nome}"` : "Item duplicado");
  }

  async function saveItemAsService(it: any) {
    const nomeRef = (it.nome || it.descricao_comercial || "").trim();
    if (!nomeRef) return toast.error("Item sem nome");
    const existing = await findServiceByName(nomeRef);
    if (existing) {
      await updateItem(it, { service_id: existing.id });
      return toast.info("Já existia no catálogo — vínculo atualizado.");
    }
    let data: any;
    try {
      data = await insertService({
        nome: nomeRef,
        categoria: it.categoria,
        descricao_comercial: it.descricao_comercial,
        escopo_tecnico: it.escopo_tecnico,
        entregaveis: it.entregaveis,
        observacoes_escopo: it.observacoes_escopo,
        quantidade_tecnica: it.quantidade_tecnica,
        valor_referencia: it.valor_unitario,
      });
    } catch (e: any) {
      return toast.error(e?.message || "Falha ao cadastrar serviço");
    }
    setServices(s => [...s, data]);
    await updateItem(it, { service_id: data.id });
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
    let savedRow: any;
    try {
      savedRow = await upsertItemPricing(existing?.id, payload);
    } catch (e: any) {
      return toast.error(e?.message || "Falha ao salvar precificação");
    }
    setPricings({ ...pricings, [item.id]: savedRow || { ...existing, ...payload } });
    // Arredonda o valor UNITÁRIO para cima (R$1) quando há mais de 1 unidade,
    // para manter o mesmo padrão do valor total (que já vem arredondado).
    const unitBruto = computed.preco_arredondado / qtd;
    const novoUnit = qtd > 1 ? Math.ceil(unitBruto) : Number(unitBruto.toFixed(2));
    await updateItem(item, { valor_unitario: novoUnit });
    await recordIndividualPricingHistory({
      proposalId: proposal.id,
      item,
      draft,
      computed,
      valorAnterior: valorAnt,
    });
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
    setRevisions(await listRevisions(proposal.id));
    toast.success("Status atualizado");
  }

  async function addRevisao(titulo: string, descricao: string) {
    if (!titulo) return;
    await addRevisaoDb(proposal.id, titulo, descricao);
    setRevisions(await listRevisions(proposal.id));
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
            .pdf-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; page-break-after: always; break-after: page; overflow: hidden; }
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
            {!saving && lastSavedAt && (Date.now() - lastSavedAt) < 4000 && (
              <span className="text-xs text-success flex items-center gap-1"><Check className="h-3 w-3" /> salvo</span>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!docReady}>
              <FileDown className="h-4 w-4 mr-1" /> Gerar PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={!docReady} title="Pré-visualizar (Ctrl/⌘+P)">
              <Eye className="h-4 w-4 mr-1" /> Pré-visualizar
            </Button>
            <Select value={proposal.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(proposalStatusLabel).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
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
                  {items.length > 1 && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setCollapsedItems(Object.fromEntries(items.map(i => [i.id, true])))}>
                        <ChevronsDownUp className="h-4 w-4 mr-1" /> Recolher todos
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCollapsedItems({})}>
                        <ChevronsUpDown className="h-4 w-4 mr-1" /> Expandir todos
                      </Button>
                    </>
                  )}
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
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {items.map((it, idx) => (
                      <SortableItemRow key={it.id} id={it.id}>
                        <ItemEditor item={it} numero={idx + 1} pricing={pricings[it.id]}
                          onChange={(patch)=>updateItem(it, patch)}
                          onRemove={()=>removeItem(it)}
                          onDuplicate={()=>{ setDuplicatePickServiceId("__keep__"); setDuplicateSource(it); }}
                          onOpenPricing={()=>setPricingOpen(it.id)}
                          onSaveToCatalog={()=>saveItemAsService(it)}
                          isInternal={isInternal}
                          proposalClients={proposalClients}
                          modoFaturamento={proposal.modo_faturamento}
                          selected={!!selected[it.id]}
                          onSelect={(v)=>setSelected(s=>({ ...s, [it.id]: v }))}
                          collapsed={!!collapsedItems[it.id]}
                          onToggleCollapsed={(v: boolean) => setCollapsedItems(s => ({ ...s, [it.id]: v }))} />
                      </SortableItemRow>
                    ))}
                  </SortableContext>
                </DndContext>
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
                  <button
                    type="button"
                    onClick={() => setInternalOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition"
                    aria-expanded={internalOpen}
                  >
                    <span className="flex items-center gap-1">
                      <Calculator className="h-3.5 w-3.5" /> Resumo interno
                    </span>
                    {internalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {internalOpen && (
                    <InternalSummary items={items} pricings={pricings} descontoRevisao={calcDescontoRevisao(total, revisions)} />
                  )}
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
          <SheetHeader>
            <SheetTitle>
              Precificação interna do item
              {pricingOpen && (() => {
                const it = items.find(i => i.id === pricingOpen);
                const nome = it?.nome || it?.descricao_comercial;
                return nome ? <span className="block text-sm font-normal text-muted-foreground mt-1">#{it?.numero_item} · {nome}</span> : null;
              })()}
            </SheetTitle>
          </SheetHeader>
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

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 overflow-hidden flex flex-col">
          <SheetHeader className="px-6 py-3 border-b flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base">Pré-visualização da proposta</SheetTitle>
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={!docReady}>
              <FileDown className="h-4 w-4 mr-1" /> Gerar PDF
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-auto bg-muted/40 p-4">
            <div className="mx-auto shadow-elegant bg-white" style={{ width: "210mm", transformOrigin: "top center" }}>
              <ProposalDocument
                proposal={proposal}
                client={client}
                items={items}
                revisions={revisions}
                proposalClients={proposalClients}
                onReady={() => setDocReady(true)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!duplicateSource} onOpenChange={(o) => { if (!o) setDuplicateSource(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Duplicar item</DialogTitle>
            <DialogDescription>
              A precificação interna (custos, horas, margem e valor) do item
              <strong> #{duplicateSource?.numero_item} {duplicateSource?.nome}</strong> será copiada.
              Escolha qual serviço aplicar ao novo item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <Label className="text-xs">Serviço para o novo item</Label>
            <Command className="border rounded-md flex-1 min-h-0">
              <CommandInput placeholder="Buscar no catálogo…" />
              <CommandList className="max-h-none flex-1 overflow-y-auto">
                <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                <CommandGroup heading="Opções">
                  <CommandItem value="keep manter copia mesmo item" onSelect={() => setDuplicatePickServiceId("__keep__")}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>Manter o mesmo serviço <span className="text-muted-foreground">(cópia)</span></span>
                      {duplicatePickServiceId === "__keep__" && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </CommandItem>
                  <CommandItem value="blank novo em branco vazio" onSelect={() => setDuplicatePickServiceId("__blank__")}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>Item novo em branco <span className="text-muted-foreground">(cadastrar depois)</span></span>
                      {duplicatePickServiceId === "__blank__" && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Catálogo de serviços">
                  {services.map((s) => (
                    <CommandItem key={s.id} value={`${s.nome} ${s.categoria || ""}`} onSelect={() => setDuplicatePickServiceId(s.id)}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="min-w-0">
                          <div className="truncate">{s.nome}</div>
                          {s.categoria && <div className="text-xs text-muted-foreground truncate">{s.categoria}</div>}
                        </div>
                        {duplicatePickServiceId === s.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDuplicateSource(null)}>Cancelar</Button>
            <Button onClick={async () => {
              const src = duplicateSource;
              const pick = duplicatePickServiceId;
              setDuplicateSource(null);
              if (src) await duplicateItem(src, pick === "__keep__" ? "keep" : pick === "__blank__" ? "blank" : pick);
            }}>
              <Plus className="h-4 w-4 mr-1" /> Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
