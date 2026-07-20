import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatCnpjCpf } from "@/lib/format";
import logoNavy from "@/assets/hse-logo-navy.png";
import logoGreen from "@/assets/hse-logo-green.png";
import capaImg from "@/assets/proposta-capa.jpg";
import contracapaImg from "@/assets/proposta-contracapa.jpg";
import {
  ShieldCheck, Target, Eye, Heart,
  Award, Users, Zap, Scale, UserCheck, Sparkles, CheckCircle2, Building2, FileSignature,
} from "lucide-react";
import {
  KV, Line, ConditionCard, ParcelasCard, ScopeCard, SectionTitle, SignatureBlock, ValueCard,
  tipoRevisaoLabel,
} from "./document/atoms";
import { FlowPages, type Block } from "./document/FlowPages";
import { CapaPage, ContracapaPage } from "./document/CoverPages";

/**
 * Multi-page A4 proposal document, optimized for screen preview and PDF print.
 * Each `.pdf-page` is one A4 page, 210mm × 297mm.
 *
 * Estrutura extraída em módulos irmãos:
 *  - ./document/atoms          — cards, títulos, tabelas, PAGE_STYLE
 *  - ./document/FlowPages      — paginador dinâmico + DocPage (header/footer)
 *  - ./document/CoverPages     — capa e contracapa
 */

type Props = {
  proposal: any;
  client: any;
  items: any[];
  revisions?: any[];
  proposalClients?: any[];
  onReady?: () => void;
};

export default function ProposalDocument({ proposal, client, items, revisions = [], proposalClients = [], onReady }: Props) {
  const [tpl, setTpl] = useState<any>(null);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [flowReady, setFlowReady] = useState(false);
  const [condSnap, setCondSnap] = useState<any>(null);
  const [textoPadraoPag, setTextoPadraoPag] = useState<string>("");

  useEffect(() => {
    supabase.from("proposal_template").select("*").limit(1).maybeSingle()
      .then(({ data }) => setTpl(data || {}));
    supabase.from("financeiro_configuracoes").select("texto_padrao_pagamento").limit(1).maybeSingle()
      .then(({ data }) => setTextoPadraoPag((data as any)?.texto_padrao_pagamento || ""));
  }, []);
  useEffect(() => {
    if (!proposal?.id) return;
    supabase.from("proposal_condicao_pagamento")
      .select("*, parcelas:proposal_condicao_parcelas(*)")
      .eq("proposal_id", proposal.id).maybeSingle()
      .then(({ data }) => {
        if (data?.parcelas) data.parcelas.sort((a: any, b: any) => a.numero - b.numero);
        setCondSnap(data || null);
      });
  }, [proposal?.id]);
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
  const coligadas = (proposalClients || [])
    .filter((pc: any) => pc.papel === "coligada" && pc.clients)
    .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0));

  push("Dados do Cliente", "dc-card", (
    <div style={{ border: `1px solid ${neutral}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: primary, color: "#fff", padding: "16px 22px", display: "flex", alignItems: "center", gap: 12 }}>
        <Building2 size={20} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{client?.razao_social || "—"}</div>
          {client?.nome_fantasia && <div style={{ fontSize: 12, opacity: 0.85 }}>{client.nome_fantasia}</div>}
          {coligadas.length > 0 && (
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
              Empresa principal — proposta emitida para grupo com {coligadas.length + 1} empresas
            </div>
          )}
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
  if (coligadas.length > 0) {
    push("Dados do Cliente", "dc-coligadas", (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: primary, fontWeight: 700, marginBottom: 8 }}>
          Demais empresas contempladas nesta proposta
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {coligadas.map((pc: any) => {
            const cc = pc.clients || {};
            return (
              <div key={pc.id} style={{ border: `1px solid ${neutral}`, borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  {cc.nome_fantasia || cc.razao_social || "—"}
                </div>
                {cc.nome_fantasia && cc.razao_social && (
                  <div style={{ fontSize: 10.5, color: "#64748b" }}>{cc.razao_social}</div>
                )}
                <div style={{ fontSize: 11, color: "#334155", marginTop: 6, fontFamily: "monospace" }}>
                  {formatCnpjCpf(cc.cnpj_cpf || "—")}
                </div>
                {(cc.cidade || cc.uf) && (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {[cc.cidade, cc.uf].filter(Boolean).join("/")}
                  </div>
                )}
                {pc.observacao && (
                  <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>
                    {pc.observacao}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 10.5, color: "#64748b", marginTop: 10, fontStyle: "italic" }}>
          {proposal.modo_faturamento === "por_cnpj"
            ? "Esta proposta contempla todas as empresas do grupo listadas acima. O faturamento e a nota fiscal serão emitidos separadamente por CNPJ, conforme indicado em cada item."
            : "Esta proposta é válida para todas as empresas do grupo listadas acima. O faturamento e a nota fiscal serão emitidos em nome da empresa principal."}
        </p>
      </div>
    ));
  }
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
    items.forEach((it, idx) => {
      push("Escopo dos Serviços", "sc-" + it.id, (
        <div style={{ marginTop: 12 }}>
          <ScopeCard item={it} numero={idx + 1} title={titleOf(it)} primary={primary} accent={accent} neutral={neutral} fontTitulo={fontTitulo} />
        </div>
      ));
    });
  }

  // -------- Investimento --------
  push("Investimento", "inv-title", <SectionTitle eyebrow="Resumo financeiro" title="Investimento" accent={accent} primary={primary} />, true);
  let invOffset = 0;
  invChunks.forEach((chunk, idx) => {
    const baseOffset = invOffset;
    invOffset += chunk.length;
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
                <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#64748b" }}>{String(baseOffset + i + 1).padStart(2, "0")}</td>
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

  // -------- Observações técnicas gerais (opcional) --------
  if (proposal.observacoes_tecnicas && String(proposal.observacoes_tecnicas).trim()) {
    push("Observações Técnicas", "ot-title",
      <SectionTitle eyebrow="Notas do serviço" title="Observações técnicas" accent={accent} primary={primary} />,
      true);
    push("Observações Técnicas", "ot-body", (
      <div style={{ padding: "16px 20px", background: neutral, borderLeft: `4px solid ${accent}`, borderRadius: 8 }}>
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "#334155", whiteSpace: "pre-line", margin: 0 }}>
          {proposal.observacoes_tecnicas}
        </p>
      </div>
    ));
  }

  // -------- Condições & Aceite --------
  push("Condições & Aceite", "cd-title", <SectionTitle eyebrow="Termos" title="Condições comerciais" accent={accent} primary={primary} />, true);
  if (condSnap && condSnap.parcelas?.length) {
    push("Condições & Aceite", "cd-parc", (
      <ParcelasCard snap={condSnap} total={total} primary={primary} accent={accent} neutral={neutral} textoPadrao={textoPadraoPag} />
    ));
  } else if (textoPadraoPag && proposal.condicoes_pagamento) {
    push("Condições & Aceite", "cd-padrao", (
      <div className="avoid-break" style={{ padding: "10px 14px", border: `1px dashed ${neutral}`, borderRadius: 10, fontSize: 11.5, color: "#475569", background: "#fff", whiteSpace: "pre-line" }}>
        {textoPadraoPag}
      </div>
    ));
  }
  push("Condições & Aceite", "cd-grid", (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: condSnap ? 12 : 0 }}>
      {!condSnap && proposal.condicoes_pagamento && <ConditionCard title="Forma de pagamento" body={proposal.condicoes_pagamento} icon={<ShieldCheck size={18} />} primary={primary} accent={accent} neutral={neutral} />}
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
      <CapaPage
        proposal={proposal} client={client} tpl={tpl}
        primary={primary} accent={accent}
        logoSrcLight={logoSrcLight} capaSrc={capaSrc}
      />

      <FlowPages ctx={ctxHeader} blocks={bodyBlocks} onReady={() => setFlowReady(true)} />

      <ContracapaPage
        tpl={tpl} primary={primary} accent={accent}
        logoSrcLight={logoSrcLight} contraSrc={contraSrc}
      />
    </div>
  );
}