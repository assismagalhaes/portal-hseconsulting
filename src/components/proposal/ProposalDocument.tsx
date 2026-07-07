import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatCnpjCpf } from "@/lib/format";
import logoNavy from "@/assets/hse-logo-navy.png";
import logoGreen from "@/assets/hse-logo-green.png";
import capaImg from "@/assets/proposta-capa.jpg";
import contracapaImg from "@/assets/proposta-contracapa.jpg";
import {
  Phone, Mail, Globe, MapPin, MessageCircle, ShieldCheck, Target, Eye, Heart,
  Award, Users, Zap, Scale, UserCheck, Sparkles, CheckCircle2, Building2, FileSignature,
  ClipboardList, ListChecks, Package, Hash, Info,
} from "lucide-react";

/**
 * Multi-page A4 proposal document, optimized for screen preview and PDF print.
 * Each `.pdf-page` is one A4 page, 210mm × 297mm.
 */

type Props = {
  proposal: any;
  client: any;
  items: any[];
  revisions?: any[];
  onReady?: () => void;
};

const PAGE_STYLE: React.CSSProperties = {
  width: "210mm",
  minHeight: "297mm",
  margin: "0 auto 12px",
  background: "#fff",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 10px 40px -10px rgba(11,31,77,0.18)",
  color: "#0f172a",
};

const TIPO_REVISAO_LABELS: Record<string, string> = {
  emissao_inicial: "Emissão inicial",
  desconto: "Desconto comercial",
  alteracao_servicos: "Alteração de serviços",
  ajuste_tecnico: "Ajuste técnico",
  renegociacao: "Renegociação",
  outro: "Outro",
};
const tipoRevisaoLabel = (t?: string) => (t ? TIPO_REVISAOLABELS_SAFE(t) : "—");
function TIPO_REVISAOLABELS_SAFE(t: string) { return TIPO_REVISAO_LABELS[t] || "Revisão"; }

export default function ProposalDocument({ proposal, client, items, revisions = [], onReady }: Props) {
  const [tpl, setTpl] = useState<any>(null);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [flowReady, setFlowReady] = useState(false);
  useEffect(() => {
    supabase.from("proposal_template").select("*").limit(1).maybeSingle()
      .then(({ data }) => setTpl(data || {}));
  }, []);
  useEffect(() => {
    const ids = Array.from(new Set(items.map((i: any) => i.service_id).filter(Boolean)));
    if (ids.length === 0) { setServiceNames({}); return; }
    supabase.from("services").select("id,nome").in("id", ids).then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.id] = s.nome; });
      setServiceNames(map);
    });
  }, [items]);
  useEffect(() => { if (tpl && flowReady && onReady) onReady(); }, [tpl, flowReady, onReady]);
  if (!tpl) return <div className="p-8 text-sm text-muted-foreground">Carregando modelo…</div>;

  const titleOf = (it: any) => it.nome || serviceNames[it.service_id] || it.descricao_comercial || "Serviço";

  const primary = tpl.cor_primaria || "#0b1f4d";
  const accent = tpl.cor_secundaria || "#16a34a";
  const neutral = tpl.cor_neutra || "#f4f6fb";
  const logoSrc = tpl.logo_url || logoNavy;
  const logoSrcLight = tpl.logo_url || logoGreen;
  const capaSrc = tpl.capa_imagem_url || capaImg;
  const contraSrc = tpl.contracapa_imagem_url || contracapaImg;

  const total = items.reduce((a, b) => a + Number(b.valor_total || 0), 0);
  const subtotal = total;
  // Revisão vigente = última aprovada; se não houver, a última registrada (maior revisão).
  const revisoesOrdenadas = [...revisions].sort((a, b) => Number(b.revisao || 0) - Number(a.revisao || 0));
  const revVigente =
    revisoesOrdenadas.find((r: any) => r.status === "aprovada") ||
    revisoesOrdenadas[0] ||
    null;
  const descontoField = Number(proposal.desconto || 0);
  // desconto efetivo: só quando a própria revisão registrou redução (valor_anterior > valor_novo)
  // e é do tipo "desconto". Evita falso desconto quando itens foram adicionados após a revisão
  // ou quando existe apenas a emissão inicial.
  const isDescontoReal =
    !!revVigente &&
    revVigente.tipo === "desconto" &&
    revVigente.valor_anterior != null &&
    revVigente.valor_novo != null &&
    Number(revVigente.valor_anterior) > Number(revVigente.valor_novo);
  const descontoRev = isDescontoReal
    ? Number(revVigente.valor_anterior) - Number(revVigente.valor_novo)
    : 0;
  const desconto = descontoRev > 0 ? descontoRev : descontoField;
  const valorFinal = Math.max(0, subtotal - desconto);
  const descontoLabel = descontoRev > 0
    ? `Desconto (Rev. ${String(revVigente.revisao).padStart(2, "0")}${revVigente.tipo && revVigente.tipo !== "emissao_inicial" ? " · " + tipoRevisaoLabel(revVigente.tipo) : ""})`
    : "Descontos";

  const diferenciais: string[] = Array.isArray(tpl.diferenciais) ? tpl.diferenciais : [];
  const diffIcons = [Award, Users, Zap, Scale, UserCheck, Sparkles];

  const ctxHeader = { proposal, client, primary, accent, logoSrc, tpl };

  // ============ Blocos de conteúdo com paginação dinâmica ============
  // Cada bloco é medido em runtime; o FlowPages abaixo distribui os blocos
  // em páginas A4 preservando o fluxo (um bloco só quebra pra próxima página
  // se não couber inteiro no espaço restante da página atual).
  const fontTitulo = tpl.font_titulo || "Sora";
  const invChunk = 8;
  const invChunks: any[][] = [];
  for (let i = 0; i < items.length; i += invChunk) invChunks.push(items.slice(i, i + invChunk));

  const revChunk = 20;
  const revChunks: any[][] = [];
  for (let i = 0; i < revisions.length; i += revChunk) revChunks.push(revisions.slice(i, i + revChunk));

  const bodyBlocks: Block[] = [];
  const push = (label: string, key: string, node: React.ReactNode, keepWithNext = false) =>
    bodyBlocks.push({ key, label, node, keepWithNext });

  // -------- Apresentação --------
  push("Apresentação", "ap-title", <SectionTitle eyebrow="Apresentação" title="Quem somos" accent={accent} primary={primary} />, true);
  push("Apresentação", "ap-quem", <p style={{ fontSize: 13, lineHeight: 1.65, color: "#334155" }}>{tpl.quem_somos}</p>);
  push("Apresentação", "ap-values", (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 18 }}>
      <ValueCard icon={<Target size={20} />} title="Missão" body={tpl.missao} accent={accent} />
      <ValueCard icon={<Eye size={20} />} title="Visão" body={tpl.visao} accent={accent} />
      <ValueCard icon={<Heart size={20} />} title="Valores" body={tpl.valores} accent={accent} />
    </div>
  ));
  if (diferenciais.length > 0) {
    push("Apresentação", "ap-dif", (
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: `2px solid ${neutral}` }}>
        <h3 style={{ fontFamily: `${fontTitulo}, sans-serif`, fontSize: 18, color: primary, marginBottom: 14 }}>Por que escolher a HSE?</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {diferenciais.map((d, i) => {
            const Icon = diffIcons[i % diffIcons.length];
            return (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", background: neutral, borderRadius: 8, alignItems: "center" }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: accent, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{d}</span>
              </div>
            );
          })}
        </div>
      </div>
    ));
  }

  // -------- Dados do Cliente --------
  push("Dados do Cliente", "dc-title", <SectionTitle eyebrow="Identificação" title="Dados do cliente" accent={accent} primary={primary} />, true);
  push("Dados do Cliente", "dc-card", (
    <div style={{ border: `1px solid ${neutral}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: primary, color: "#fff", padding: "16px 22px", display: "flex", alignItems: "center", gap: 12 }}>
        <Building2 size={20} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{client?.razao_social || "—"}</div>
          {client?.nome_fantasia && <div style={{ fontSize: 12, opacity: 0.85 }}>{client.nome_fantasia}</div>}
        </div>
      </div>
      <div style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 28px" }}>
        <KV k="CNPJ / CPF" v={formatCnpjCpf(client?.cnpj_cpf || "—")} />
        <KV k="Qtd. funcionários" v={client?.qtd_funcionarios ?? "—"} />
        <KV k="Endereço" v={client?.endereco || "—"} />
        <KV k="Cidade / UF" v={[client?.cidade, client?.uf].filter(Boolean).join("/") || "—"} />
        <KV k="Solicitante" v={[client?.solicitante, client?.cargo].filter(Boolean).join(" — ") || "—"} />
        <KV k="Telefone" v={client?.telefone || "—"} />
        <KV k="E-mail" v={client?.email || "—"} />
        <KV k="Validade da proposta" v={proposal.validade ? new Date(proposal.validade).toLocaleDateString("pt-BR") : "—"} />
      </div>
    </div>
  ));
  if (proposal.observacoes_comerciais) {
    push("Dados do Cliente", "dc-obs", (
      <div style={{ marginTop: 18, padding: "14px 18px", background: `${accent}14`, borderLeft: `4px solid ${accent}`, borderRadius: 6 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: primary, fontWeight: 700, marginBottom: 4 }}>Observação importante</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-line", color: "#334155" }}>{proposal.observacoes_comerciais}</p>
      </div>
    ));
  }
  if (proposal.escopo_geral) {
    push("Dados do Cliente", "dc-esc", (
      <div style={{ marginTop: 18 }}>
        <h3 style={{ fontFamily: `${fontTitulo}, sans-serif`, fontSize: 16, color: primary, marginBottom: 8 }}>Escopo geral</h3>
        <p style={{ fontSize: 12.5, lineHeight: 1.65, color: "#334155", whiteSpace: "pre-line" }}>{proposal.escopo_geral}</p>
      </div>
    ));
  }

  // -------- Escopo dos Serviços (cards) --------
  if (items.length > 0) {
    push("Escopo dos Serviços", "sc-title", <SectionTitle eyebrow="Detalhamento" title="Escopo dos serviços" accent={accent} primary={primary} />, true);
    items.forEach((it) => {
      push("Escopo dos Serviços", "sc-" + it.id, (
        <div style={{ marginTop: 12 }}>
          <ScopeCard item={it} title={titleOf(it)} primary={primary} accent={accent} neutral={neutral} fontTitulo={fontTitulo} />
        </div>
      ));
    });
  }

  // -------- Investimento --------
  push("Investimento", "inv-title", <SectionTitle eyebrow="Resumo financeiro" title="Investimento" accent={accent} primary={primary} />, true);
  invChunks.forEach((chunk, idx) => {
    push("Investimento", "inv-t-" + idx, (
      <div style={{ marginTop: idx === 0 ? 0 : 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: primary, color: "#fff" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", width: 38 }}>#</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Descrição</th>
              <th style={{ padding: "10px 12px", textAlign: "right", width: 60 }}>Qtd</th>
              <th style={{ padding: "10px 12px", textAlign: "right", width: 110 }}>Unitário</th>
              <th style={{ padding: "10px 12px", textAlign: "right", width: 120 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {chunk.map((it: any, i: number) => (
              <tr key={it.id} style={{ background: i % 2 ? neutral : "#fff", verticalAlign: "top" }}>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#64748b" }}>{String(it.numero_item).padStart(2, "0")}</td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{titleOf(it)}</div>
                  {it.categoria && <div style={{ fontSize: 10, color: "#64748b" }}>{it.categoria}</div>}
                  {it.observacoes_escopo && (
                    <div style={{ marginTop: 4, fontSize: 10.5, color: "#64748b", fontStyle: "italic", whiteSpace: "pre-line" }}>
                      Obs.: {it.observacoes_escopo}
                    </div>
                  )}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{it.quantidade}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{brl(it.valor_unitario)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{brl(it.valor_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));
  });
  push("Investimento", "inv-totals", (
    <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ minWidth: 320 }}>
        <Line label="Subtotal dos serviços" value={brl(subtotal)} />
        {desconto > 0 && (
          <>
            <Line label={descontoLabel} value={"- " + brl(desconto)} />
            {revVigente?.motivo && (
              <div style={{ fontSize: 10.5, color: "#64748b", padding: "0 2px 6px", textAlign: "right", fontStyle: "italic" }}>
                Motivo: {revVigente.motivo}
              </div>
            )}
          </>
        )}
        <div style={{ marginTop: 10, background: primary, color: "#fff", borderRadius: 12, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 12px 30px -10px ${primary}66` }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, opacity: 0.85 }}>Investimento total</div>
            {desconto > 0 && (
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                Já com desconto aplicado ({((desconto / subtotal) * 100).toFixed(1)}%)
              </div>
            )}
          </div>
          <div style={{ fontFamily: `${fontTitulo}, sans-serif`, fontSize: 28, fontWeight: 800, color: accent }}>{brl(valorFinal)}</div>
        </div>
      </div>
    </div>
  ));

  // -------- Condições & Aceite --------
  push("Condições & Aceite", "cd-title", <SectionTitle eyebrow="Termos" title="Condições comerciais" accent={accent} primary={primary} />, true);
  push("Condições & Aceite", "cd-grid", (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {proposal.condicoes_pagamento && <ConditionCard title="Forma de pagamento" body={proposal.condicoes_pagamento} icon={<ShieldCheck size={18} />} primary={primary} accent={accent} neutral={neutral} />}
      {proposal.validade && <ConditionCard title="Validade da proposta" body={new Date(proposal.validade).toLocaleDateString("pt-BR")} icon={<CheckCircle2 size={18} />} primary={primary} accent={accent} neutral={neutral} />}
      {proposal.outras_condicoes && <ConditionCard title="Outras condições" body={proposal.outras_condicoes} icon={<FileSignature size={18} />} primary={primary} accent={accent} neutral={neutral} fullWidth />}
    </div>
  ));
  push("Condições & Aceite", "ac-title", (
    <div style={{ marginTop: 24 }}>
      <SectionTitle eyebrow="Formalização" title="Aceite da proposta" accent={accent} primary={primary} />
    </div>
  ), true);
  push("Condições & Aceite", "ac-body", (
    <div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: "#334155", marginBottom: 28, maxWidth: 560 }}>{tpl.texto_aceite}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, marginTop: 24 }}>
        <SignatureBlock label="Cliente" name={client?.razao_social} subtitle={client?.solicitante} primary={primary} />
        <SignatureBlock label="HSE Consulting" name="HSE Consulting" subtitle="Responsável Comercial" primary={primary} />
      </div>
      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ height: 1, background: neutral, flex: 1 }} />
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "#64748b" }}>Data: ___ / ___ / ______</span>
        <div style={{ height: 1, background: neutral, flex: 1 }} />
      </div>
    </div>
  ));

  // -------- Histórico de Revisões --------
  if (revisions.length > 0) {
    push("Histórico de Revisões", "hr-title", (
      <div>
        <SectionTitle eyebrow="Rastreabilidade" title="Histórico de revisões" accent={accent} primary={primary} />
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, maxWidth: 620 }}>
          Registro cronológico das alterações comerciais desta proposta (emissão inicial, descontos, alterações de escopo, ajustes técnicos e renegociações).
        </p>
      </div>
    ), true);
    revChunks.forEach((chunk, idx) => {
      push("Histórico de Revisões", "hr-t-" + idx, (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginTop: idx === 0 ? 0 : 6 }}>
          <thead>
            <tr style={{ background: neutral, color: primary }}>
              <th style={{ padding: "8px 10px", textAlign: "left", width: 60 }}>Rev.</th>
              <th style={{ padding: "8px 10px", textAlign: "left", width: 160 }}>Tipo</th>
              <th style={{ padding: "8px 10px", textAlign: "left" }}>Descrição</th>
              <th style={{ padding: "8px 10px", textAlign: "right", width: 110 }}>Valor</th>
              <th style={{ padding: "8px 10px", textAlign: "left", width: 100 }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {chunk.map((r: any) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${neutral}` }}>
                <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>R{String(r.revisao).padStart(2,"0")}</td>
                <td style={{ padding: "8px 10px", color: "#334155" }}>{tipoRevisaoLabel(r.tipo)}</td>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ fontWeight: 600 }}>{r.titulo || "—"}</div>
                  {r.descricao && r.descricao !== r.titulo && <div style={{ color: "#64748b" }}>{r.descricao}</div>}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>
                  {r.valor_novo != null ? Number(r.valor_novo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "#64748b" }}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ));
    });
  }

  return (
    <div className="proposal-doc" style={{ fontFamily: `${tpl.font_corpo || "Manrope"}, system-ui, sans-serif` }}>
      {/* ============ CAPA ============ */}
      <section className="pdf-page" style={{ ...PAGE_STYLE, background: primary, color: "#fff" }}>
        <img src={capaSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22 }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${primary} 0%, ${primary}cc 55%, ${accent}66 120%)` }} />
        {/* Faixa diagonal */}
        <div style={{ position: "absolute", top: "-40mm", right: "-40mm", width: "120mm", height: "120mm", background: accent, opacity: 0.18, transform: "rotate(35deg)" }} />
        <div style={{ position: "absolute", bottom: "-30mm", left: "-30mm", width: "100mm", height: "100mm", background: accent, opacity: 0.12, transform: "rotate(35deg)" }} />

        <div style={{ position: "relative", height: "297mm", padding: "22mm 22mm", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <img src={logoSrcLight} alt="HSE Consulting" style={{ height: 110, objectFit: "contain" }} />
          </div>

          <div>
            <div style={{ width: 64, height: 4, background: accent, marginBottom: 18 }} />
            <div style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", opacity: 0.9 }}>Proposta Comercial</div>
            <h1 style={{ fontFamily: `${tpl.font_titulo || "Sora"}, sans-serif`, fontSize: 52, fontWeight: 800, lineHeight: 1.05, marginTop: 8, marginBottom: 22, letterSpacing: "-0.02em" }}>
              {client?.nome_fantasia || client?.razao_social || "Cliente"}
            </h1>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", fontSize: 13 }}>
              <Stat label="Nº da proposta" value={proposal.numero} accent={accent} />
              <Stat label="Data" value={new Date(((proposal.data_emissao||proposal.created_at) + "").slice(0,10) + "T00:00:00").toLocaleDateString("pt-BR")} accent={accent} />
              {(client?.cidade || client?.uf) && <Stat label="Cidade" value={`${client?.cidade || ""}${client?.uf ? "/" + client.uf : ""}`} accent={accent} />}
              {proposal.validade && <Stat label="Válida até" value={new Date(proposal.validade).toLocaleDateString("pt-BR")} accent={accent} />}
            </div>
            <p style={{ marginTop: 32, fontSize: 15, maxWidth: 480, fontStyle: "italic", opacity: 0.92 }}>
              "{tpl.slogan}"
            </p>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 12, display: "flex", gap: 24, fontSize: 11, opacity: 0.92, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Phone size={12} /> {tpl.telefone}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mail size={12} /> {tpl.email}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Globe size={12} /> {tpl.site}</span>
          </div>
        </div>
      </section>

      {/* ============ APRESENTAÇÃO ============ */}
      <FlowPages ctx={ctxHeader} blocks={bodyBlocks} onReady={() => setFlowReady(true)} />

      {/* ============ CONTRACAPA ============ */}
      <section className="pdf-page" style={{ ...PAGE_STYLE, background: primary, color: "#fff" }}>
        <img src={contraSrc} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${primary}cc 0%, ${primary}f5 70%, ${primary} 100%)` }} />
        <div style={{ position: "absolute", top: "-30mm", left: "-30mm", width: "100mm", height: "100mm", background: accent, opacity: 0.12, transform: "rotate(35deg)" }} />

        <div style={{ position: "relative", height: "297mm", padding: "30mm 24mm", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <img src={logoSrcLight} alt="HSE Consulting" style={{ height: 56, objectFit: "contain" }} />

          <div style={{ maxWidth: 520 }}>
            <div style={{ width: 80, height: 4, background: accent, marginBottom: 22 }} />
            <h2 style={{ fontFamily: `${tpl.font_titulo || "Sora"}, sans-serif`, fontSize: 38, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              {tpl.mensagem_contracapa}
            </h2>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12 }}>
            <ContactLine icon={<Phone size={14} />} label="Telefone" value={tpl.telefone} />
            <ContactLine icon={<MessageCircle size={14} />} label="WhatsApp" value={tpl.whatsapp} />
            <ContactLine icon={<Mail size={14} />} label="E-mail" value={tpl.email} />
            <ContactLine icon={<Globe size={14} />} label="Site" value={tpl.site} />
            {tpl.endereco && <ContactLine icon={<MapPin size={14} />} label="Endereço" value={tpl.endereco} />}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============== sub-components ============== */

type Block = { key: string; label: string; node: React.ReactNode; keepWithNext?: boolean };

/**
 * FlowPages — paginador dinâmico.
 * Mede a altura real de cada bloco em um container invisível de mesma largura
 * útil das páginas e distribui os blocos em páginas A4, garantindo que:
 *  - blocos entrem em sequência sem espaços forçados;
 *  - se um bloco não couber no restante da página, ele vai inteiro pra próxima;
 *  - se um bloco tem `keepWithNext`, tenta mantê-lo junto do próximo.
 */
function FlowPages({ ctx, blocks, onReady }: { ctx: any; blocks: Block[]; onReady?: () => void }) {
  const [pages, setPages] = useState<number[][] | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // altura útil de uma página (297mm - cabeçalho - rodapé - padding vertical)
  // Cabeçalho ~30mm, rodapé ~22mm, padding 10mm+10mm = 20mm → ~225mm.
  // Usamos margem de segurança para evitar overflow físico durante impressão,
  // que geraria páginas extras sem cabeçalho (sem numeração).
  const MM_TO_PX = 96 / 25.4;
  const CONTENT_H_PX = 210 * MM_TO_PX;

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const children = Array.from(measureRef.current.children) as HTMLElement[];
    if (children.length !== blocks.length) return;
    const heights = children.map((el) => el.getBoundingClientRect().height);

    const result: number[][] = [[]];
    let used = 0;
    for (let i = 0; i < blocks.length; i++) {
      const h = heights[i];
      const current = result[result.length - 1];

      // keepWithNext: se este bloco (ex.: título de seção) e o próximo juntos
      // não couberem no restante da página, força quebra antes.
      let neededH = h;
      if (blocks[i].keepWithNext && i + 1 < blocks.length) {
        neededH = h + heights[i + 1];
      }

      const remaining = CONTENT_H_PX - used;
      if (h > CONTENT_H_PX) {
        // bloco maior que uma página: joga sozinho (vai transbordar; edge case).
        if (current.length > 0) result.push([]);
        result[result.length - 1].push(i);
        result.push([]);
        used = 0;
        continue;
      }
      if (neededH > remaining && current.length > 0) {
        result.push([i]);
        used = h;
      } else {
        current.push(i);
        used += h;
      }
    }
    if (result[result.length - 1].length === 0) result.pop();
    setPages(result);
  }, [blocks.length]);

  // Notify parent when pages are actually rendered in the DOM, so printers
  // can safely snapshot the full document (avoids missing middle pages).
  useEffect(() => {
    if (pages && onReady) {
      // Two RAFs to ensure paint completed after the DocPages mount.
      requestAnimationFrame(() => requestAnimationFrame(() => onReady()));
    }
  }, [pages, onReady]);

  // Rótulo de página = primeira label encontrada nos blocos da página
  const pageLabelFor = (idxs: number[]) => (idxs.length ? blocks[idxs[0]].label : "");

  return (
    <>
      {/* Container de medição: fora da tela, mas com a largura real do conteúdo. */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          width: "174mm", // 210mm - 2*18mm de padding lateral do DocPage
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {blocks.map((b) => (
          <div key={"m-" + b.key}>{b.node}</div>
        ))}
      </div>

      {pages &&
        pages.map((idxs, pi) => (
          <DocPage
            key={"flow-" + pi}
            ctx={ctx}
            pageLabel={pageLabelFor(idxs)}
            pageNum={String(pi + 1).padStart(2, "0")}
          >
            {idxs.map((i) => (
              <div key={blocks[i].key}>{blocks[i].node}</div>
            ))}
          </DocPage>
        ))}
    </>
  );
}

function DocPage({ ctx, pageNum, pageLabel, children }: any) {
  const { proposal, client, primary, accent, logoSrc, tpl } = ctx;
  return (
    <section className="pdf-page" style={PAGE_STYLE}>
      <div style={{ height: "297mm", display: "flex", flexDirection: "column" }}>
        {/* Cabeçalho */}
        <header style={{ padding: "12mm 18mm 6mm", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${primary}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logoSrc} alt="HSE" style={{ height: 32, objectFit: "contain" }} />
            <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 10 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#64748b" }}>{pageLabel}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: primary }}>{client?.nome_fantasia || client?.razao_social || "—"}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>
            <div style={{ fontFamily: "monospace", color: primary, fontWeight: 700 }}>Proposta {proposal.numero}</div>
            <div>Página {pageNum || "01"}</div>
          </div>
        </header>

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: "10mm 18mm", overflow: "hidden" }}>{children}</div>

        {/* Rodapé */}
        <footer style={{ padding: "6mm 18mm 10mm", borderTop: `1px solid #e5e7eb`, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b" }}>
          <span>HSE Consulting · {tpl.site}</span>
          <span>{tpl.telefone} · {tpl.email}</span>
        </footer>
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, accent, primary }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10, textTransform: "uppercase", letterSpacing: 2.5, color: accent, fontWeight: 700 }}>
        <span style={{ width: 24, height: 2, background: accent }} /> {eyebrow}
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: primary, marginTop: 6, letterSpacing: "-0.015em" }}>{title}</h2>
    </div>
  );
}

function ValueCard({ icon, title, body, accent }: any) {
  return (
    <div className="avoid-break" style={{ padding: 14, border: `1px solid #e5e7eb`, borderRadius: 12, background: "#fff" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: accent, color: "#fff", marginBottom: 10 }}>{icon}</span>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "#475569" }}>{body}</p>
    </div>
  );
}

function KV({ k, v }: any) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#64748b", fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 13, color: "#0f172a", marginTop: 2 }}>{v || "—"}</div>
    </div>
  );
}

function Line({ label, value }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", borderBottom: "1px dashed #e5e7eb", fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ConditionCard({ title, body, icon, primary, accent, neutral, fullWidth }: any) {
  return (
    <div className="avoid-break" style={{ gridColumn: fullWidth ? "1 / -1" : "auto", padding: 16, border: `1px solid ${neutral}`, borderRadius: 12, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ width: 34, height: 34, borderRadius: 8, background: primary, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <div style={{ fontWeight: 700, color: primary, fontSize: 13 }}>{title}</div>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#334155", whiteSpace: "pre-line" }}>{body}</p>
    </div>
  );
}

function SignatureBlock({ label, name, subtitle, primary }: any) {
  return (
    <div className="avoid-break">
      <div style={{ height: 50, borderBottom: `1.5px solid ${primary}` }} />
      <div style={{ marginTop: 6, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: primary }}>{name || "—"}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#64748b" }}>{subtitle}</div>}
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function ContactLine({ icon, label, value }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ opacity: 0.7 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: any) {
  return (
    <div>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: accent, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/* ---------- Scope card (technical/commercial, no financials) ---------- */
function ScopeCard({ item, title, primary, accent, neutral, fontTitulo }: any) {
  const toList = (s?: string): string[] =>
    (s || "")
      .split(/\r?\n|;|•/)
      .map((x) => x.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean);

  const entregaveis = toList(item.entregaveis);
  const observacoes = (item.observacoes_escopo || "").trim();
  const qtdTec =
    (item.quantidade_tecnica || "").trim() ||
    (Number(item.quantidade) > 1 ? `${item.quantidade} ${item.quantidade > 1 ? "unidades" : "unidade"}` : "");
  const headerTitle = (title || item.descricao_comercial || "Serviço").trim();
  const descricao = (item.descricao_comercial || "").trim();
  // Evita duplicar a descrição quando ela é igual ao nome do serviço
  const descricaoDistinta = descricao && descricao !== headerTitle ? descricao : "";

  const Block = ({ icon, title, children }: any) => (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ color: accent, display: "inline-flex" }}>{icon}</span>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: primary, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "#334155" }}>{children}</div>
    </div>
  );

  return (
    <div className="avoid-break" style={{ border: `1px solid ${neutral}`, borderRadius: 12, padding: 18, position: "relative", background: "#fff" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: accent, borderRadius: "12px 0 0 12px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: primary, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
          {String(item.numero_item).padStart(2, "0")}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: `${fontTitulo}, sans-serif`, fontWeight: 700, fontSize: 15, color: primary, lineHeight: 1.2 }}>
            {headerTitle}
          </div>
          {item.categoria && (
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: "#64748b", marginTop: 2 }}>
              {item.categoria}
            </div>
          )}
        </div>
      </div>

      {descricaoDistinta && (
        <Block icon={<ClipboardList size={12} />} title="Descrição">
          <p style={{ whiteSpace: "pre-line", margin: 0 }}>{descricaoDistinta}</p>
        </Block>
      )}

      {entregaveis.length > 0 && (
        <Block icon={<Package size={12} />} title="Entregáveis">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {entregaveis.map((e, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{e}</li>
            ))}
          </ul>
        </Block>
      )}

      {observacoes && (
        <Block icon={<Info size={12} />} title="Observações">
          <p style={{ whiteSpace: "pre-line", margin: 0 }}>{observacoes}</p>
        </Block>
      )}

      {qtdTec && (
        <Block icon={<Hash size={12} />} title="Quantidade técnica">
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{qtdTec}</span>
        </Block>
      )}
    </div>
  );
}