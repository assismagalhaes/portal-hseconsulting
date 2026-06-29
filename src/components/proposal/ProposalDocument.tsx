import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatCnpjCpf } from "@/lib/format";
import logoNavy from "@/assets/hse-logo-navy.png";
import logoGreen from "@/assets/hse-logo-green.png";
import capaImg from "@/assets/proposta-capa.jpg";
import contracapaImg from "@/assets/proposta-contracapa.jpg";
import {
  Phone, Mail, Globe, MapPin, MessageCircle, ShieldCheck, Target, Eye, Heart,
  Award, Users, Zap, Scale, UserCheck, Sparkles, CheckCircle2, Building2, FileSignature,
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

export default function ProposalDocument({ proposal, client, items, revisions = [], onReady }: Props) {
  const [tpl, setTpl] = useState<any>(null);
  useEffect(() => {
    supabase.from("proposal_template").select("*").limit(1).maybeSingle()
      .then(({ data }) => setTpl(data || {}));
  }, []);
  useEffect(() => { if (tpl && onReady) onReady(); }, [tpl, onReady]);
  if (!tpl) return <div className="p-8 text-sm text-muted-foreground">Carregando modelo…</div>;

  const primary = tpl.cor_primaria || "#0b1f4d";
  const accent = tpl.cor_secundaria || "#16a34a";
  const neutral = tpl.cor_neutra || "#f4f6fb";
  const logoSrc = tpl.logo_url || logoNavy;
  const logoSrcLight = tpl.logo_url || logoGreen;
  const capaSrc = tpl.capa_imagem_url || capaImg;
  const contraSrc = tpl.contracapa_imagem_url || contracapaImg;

  const total = items.reduce((a, b) => a + Number(b.valor_total || 0), 0);
  const desconto = Number(proposal.desconto || 0);
  const subtotal = total;
  const valorFinal = subtotal - desconto;

  const diferenciais: string[] = Array.isArray(tpl.diferenciais) ? tpl.diferenciais : [];
  const diffIcons = [Award, Users, Zap, Scale, UserCheck, Sparkles];

  // ITEMS pagination — 6 cards per page in scope, 12 rows per page in investment table
  const SCOPE_PER_PAGE = 4;
  const scopePages: any[][] = [];
  for (let i = 0; i < items.length; i += SCOPE_PER_PAGE)
    scopePages.push(items.slice(i, i + SCOPE_PER_PAGE));
  if (scopePages.length === 0) scopePages.push([]);

  const INVEST_PER_PAGE = 14;
  const investPages: any[][] = [];
  for (let i = 0; i < items.length; i += INVEST_PER_PAGE)
    investPages.push(items.slice(i, i + INVEST_PER_PAGE));
  if (investPages.length === 0) investPages.push([]);

  const ctxHeader = { proposal, client, primary, accent, logoSrc, tpl };

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
            <img src={logoSrcLight} alt="HSE Consulting" style={{ height: 64, objectFit: "contain" }} />
            <div style={{ marginTop: 4, fontSize: 11, letterSpacing: 2, opacity: 0.85, textTransform: "uppercase" }}>HSE Consulting</div>
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
      <DocPage ctx={ctxHeader} pageLabel="Apresentação" pageNum="01">
        <SectionTitle eyebrow="Apresentação" title="Quem somos" accent={accent} primary={primary} />
        <p style={{ fontSize: 13, lineHeight: 1.65, color: "#334155", marginBottom: 22 }}>{tpl.quem_somos}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          <ValueCard icon={<Target size={20} />} title="Missão" body={tpl.missao} accent={accent} />
          <ValueCard icon={<Eye size={20} />} title="Visão" body={tpl.visao} accent={accent} />
          <ValueCard icon={<Heart size={20} />} title="Valores" body={tpl.valores} accent={accent} />
        </div>

        <div style={{ marginTop: 8, paddingTop: 16, borderTop: `2px solid ${neutral}` }}>
          <h3 style={{ fontFamily: `${tpl.font_titulo || "Sora"}, sans-serif`, fontSize: 18, color: primary, marginBottom: 14 }}>Por que escolher a HSE?</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {diferenciais.map((d, i) => {
              const Icon = diffIcons[i % diffIcons.length];
              return (
                <div key={i} className="avoid-break" style={{ display: "flex", gap: 10, padding: "10px 12px", background: neutral, borderRadius: 8, alignItems: "center" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: accent, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={16} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{d}</span>
                </div>
              );
            })}
          </div>
        </div>
      </DocPage>

      {/* ============ DADOS DO CLIENTE ============ */}
      <DocPage ctx={ctxHeader} pageLabel="Dados do Cliente" pageNum="02">
        <SectionTitle eyebrow="Identificação" title="Dados do cliente" accent={accent} primary={primary} />
        <div className="avoid-break" style={{ border: `1px solid ${neutral}`, borderRadius: 14, overflow: "hidden" }}>
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

        {proposal.observacoes_comerciais && (
          <div className="avoid-break" style={{ marginTop: 18, padding: "14px 18px", background: `${accent}14`, borderLeft: `4px solid ${accent}`, borderRadius: 6 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: primary, fontWeight: 700, marginBottom: 4 }}>Observação importante</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-line", color: "#334155" }}>{proposal.observacoes_comerciais}</p>
          </div>
        )}

        {proposal.escopo_geral && (
          <div style={{ marginTop: 22 }}>
            <h3 style={{ fontFamily: `${tpl.font_titulo || "Sora"}, sans-serif`, fontSize: 16, color: primary, marginBottom: 8 }}>Escopo geral</h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.65, color: "#334155", whiteSpace: "pre-line" }}>{proposal.escopo_geral}</p>
          </div>
        )}
      </DocPage>

      {/* ============ ESCOPO DOS SERVIÇOS (cards) ============ */}
      {scopePages.map((page, idx) => (
        <DocPage key={"scope-" + idx} ctx={ctxHeader} pageLabel="Escopo dos Serviços" pageNum={String(3 + idx).padStart(2, "0")}>
          {idx === 0 && <SectionTitle eyebrow="Detalhamento" title="Escopo dos serviços" accent={accent} primary={primary} />}
          {page.length === 0 && <p style={{ color: "#64748b", fontSize: 12 }}>Nenhum serviço adicionado.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {page.map((it: any) => (
              <div key={it.id} className="avoid-break" style={{ border: `1px solid ${neutral}`, borderRadius: 12, padding: 16, position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: accent, borderRadius: "12px 0 0 12px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: primary, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                      {String(it.numero_item).padStart(2, "0")}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: primary }}>{it.descricao_comercial}</div>
                      {it.categoria && <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>{it.categoria}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Valor</div>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 16, color: primary }}>{brl(it.valor_total)}</div>
                  </div>
                </div>
                {it.escopo_tecnico && (
                  <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "#475569", whiteSpace: "pre-line", marginTop: 6, marginBottom: 8 }}>{it.escopo_tecnico}</p>
                )}
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", borderTop: `1px dashed ${neutral}`, paddingTop: 8 }}>
                  <span><strong style={{ color: "#0f172a" }}>Qtd:</strong> {it.quantidade}</span>
                  <span><strong style={{ color: "#0f172a" }}>Unitário:</strong> {brl(it.valor_unitario)}</span>
                </div>
              </div>
            ))}
          </div>
        </DocPage>
      ))}

      {/* ============ INVESTIMENTO ============ */}
      {investPages.map((page, idx) => (
        <DocPage key={"invest-" + idx} ctx={ctxHeader} pageLabel="Investimento" pageNum={String(3 + scopePages.length + idx).padStart(2, "0")}>
          {idx === 0 && <SectionTitle eyebrow="Resumo financeiro" title="Investimento" accent={accent} primary={primary} />}
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
              {page.map((it: any, i: number) => (
                <tr key={it.id} style={{ background: i % 2 ? neutral : "#fff" }}>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#64748b" }}>{String(it.numero_item).padStart(2, "0")}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{it.descricao_comercial}</div>
                    {it.categoria && <div style={{ fontSize: 10, color: "#64748b" }}>{it.categoria}</div>}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{it.quantidade}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{brl(it.valor_unitario)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{brl(it.valor_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {idx === investPages.length - 1 && (
            <div className="avoid-break" style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ minWidth: 320 }}>
                <Line label="Subtotal" value={brl(subtotal)} />
                {desconto > 0 && <Line label="Descontos" value={"- " + brl(desconto)} />}
                <div style={{ marginTop: 10, background: primary, color: "#fff", borderRadius: 12, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 12px 30px -10px ${primary}66` }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, opacity: 0.85 }}>Investimento total</div>
                  </div>
                  <div style={{ fontFamily: `${tpl.font_titulo || "Sora"}, sans-serif`, fontSize: 28, fontWeight: 800, color: accent }}>{brl(valorFinal)}</div>
                </div>
              </div>
            </div>
          )}
        </DocPage>
      ))}

      {/* ============ CONDIÇÕES COMERCIAIS ============ */}
      <DocPage ctx={ctxHeader} pageLabel="Condições Comerciais" pageNum="—">
        <SectionTitle eyebrow="Termos" title="Condições comerciais" accent={accent} primary={primary} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {proposal.condicoes_pagamento && <ConditionCard title="Forma de pagamento" body={proposal.condicoes_pagamento} icon={<ShieldCheck size={18} />} primary={primary} accent={accent} neutral={neutral} />}
          {proposal.validade && <ConditionCard title="Validade da proposta" body={new Date(proposal.validade).toLocaleDateString("pt-BR")} icon={<CheckCircle2 size={18} />} primary={primary} accent={accent} neutral={neutral} />}
          {proposal.outras_condicoes && <ConditionCard title="Outras condições" body={proposal.outras_condicoes} icon={<FileSignature size={18} />} primary={primary} accent={accent} neutral={neutral} fullWidth />}
        </div>
      </DocPage>

      {/* ============ ACEITE ============ */}
      <DocPage ctx={ctxHeader} pageLabel="Aceite" pageNum="—">
        <SectionTitle eyebrow="Formalização" title="Aceite da proposta" accent={accent} primary={primary} />
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#334155", marginBottom: 40, maxWidth: 560 }}>{tpl.texto_aceite}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, marginTop: 60 }}>
          <SignatureBlock label="Cliente" name={client?.razao_social} subtitle={client?.solicitante} primary={primary} />
          <SignatureBlock label="HSE Consulting" name="HSE Consulting" subtitle="Responsável Comercial" primary={primary} />
        </div>

        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ height: 1, background: neutral, flex: 1 }} />
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "#64748b" }}>Data: ___ / ___ / ______</span>
          <div style={{ height: 1, background: neutral, flex: 1 }} />
        </div>

        {revisions.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h3 style={{ fontFamily: `${tpl.font_titulo || "Sora"}, sans-serif`, fontSize: 14, color: primary, marginBottom: 10 }}>Histórico de revisões</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: neutral, color: primary }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", width: 60 }}>Revisão</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Descrição</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", width: 120 }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${neutral}` }}>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>R{r.revisao}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 600 }}>{r.titulo || "—"}</div>
                      {r.descricao && <div style={{ color: "#64748b" }}>{r.descricao}</div>}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DocPage>

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
            <div>Página {pageNum}</div>
          </div>
        </header>

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: "10mm 18mm", overflow: "hidden" }}>{children}</div>

        {/* Rodapé */}
        <footer style={{ padding: "6mm 18mm 10mm", borderTop: `1px solid #e5e7eb`, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b" }}>
          <span>HSE Consulting · {tpl.site}</span>
          <span>{tpl.telefone} · {tpl.email}</span>
          <span>{tpl.rodape_versao}</span>
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