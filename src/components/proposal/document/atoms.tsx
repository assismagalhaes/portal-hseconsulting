import { brl, formatCnpjCpf } from "@/lib/format";
import { ClipboardList, Hash, Info, Package, ShieldCheck } from "lucide-react";
import { MARCO_LABEL, type CondPagMarco } from "@/lib/condicoesPagamento";

/**
 * Átomos visuais do ProposalDocument.
 * Extraídos do arquivo principal para reduzir o tamanho do componente
 * sem alterar aparência ou comportamento.
 */

export const PAGE_STYLE: React.CSSProperties = {
  width: "210mm",
  minHeight: "297mm",
  margin: "0 auto 12px",
  background: "#fff",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 10px 40px -10px rgba(11,31,77,0.18)",
  color: "#0f172a",
};

export const TIPO_REVISAO_LABELS: Record<string, string> = {
  emissao_inicial: "Emissão inicial",
  desconto: "Desconto comercial",
  alteracao_servicos: "Alteração de serviços",
  ajuste_tecnico: "Ajuste técnico",
  renegociacao: "Renegociação",
  outro: "Outro",
};
export const tipoRevisaoLabel = (t?: string) =>
  t ? (TIPO_REVISAO_LABELS[t] || "Revisão") : "—";

export function SectionTitle({ eyebrow, title, accent, primary }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10, textTransform: "uppercase", letterSpacing: 2.5, color: accent, fontWeight: 700 }}>
        <span style={{ width: 24, height: 2, background: accent }} /> {eyebrow}
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: primary, marginTop: 6, letterSpacing: "-0.015em" }}>{title}</h2>
    </div>
  );
}

export function ValueCard({ icon, title, body, accent }: any) {
  return (
    <div className="avoid-break" style={{ padding: 14, border: `1px solid #e5e7eb`, borderRadius: 12, background: "#fff" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: accent, color: "#fff", marginBottom: 10 }}>{icon}</span>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "#475569" }}>{body}</p>
    </div>
  );
}

export function KV({ k, v }: any) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#64748b", fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 13, color: "#0f172a", marginTop: 2 }}>{v || "—"}</div>
    </div>
  );
}

export function Line({ label, value }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", borderBottom: "1px dashed #e5e7eb", fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function ConditionCard({ title, body, icon, primary, accent, neutral, fullWidth }: any) {
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

export function ParcelasCard({ snap, total, primary, accent, neutral, textoPadrao }: any) {
  const parcelas = snap.parcelas || [];
  return (
    <div className="avoid-break" style={{ border: `1px solid ${neutral}`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: primary, color: "#fff" }}>
        <ShieldCheck size={18} />
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, opacity: 0.85 }}>Cronograma de pagamento</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{snap.nome}</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12 }}>Total: <strong>{brl(total || 0)}</strong></div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: neutral, color: "#475569", textTransform: "uppercase", fontSize: 9, letterSpacing: 1 }}>
            <th style={{ textAlign: "left", padding: "8px 12px" }}>Nº</th>
            <th style={{ textAlign: "left", padding: "8px 12px" }}>%</th>
            <th style={{ textAlign: "right", padding: "8px 12px" }}>Valor</th>
            <th style={{ textAlign: "left", padding: "8px 12px" }}>Marco</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((p: any) => (
            <tr key={p.id || p.numero} style={{ borderTop: `1px solid ${neutral}` }}>
              <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.numero}</td>
              <td style={{ padding: "8px 12px" }}>{Number(p.percentual).toFixed(2)}%</td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: primary }}>
                {brl(Number(p.valor ?? (p.percentual / 100) * (total || 0)))}
              </td>
              <td style={{ padding: "8px 12px", color: accent, fontWeight: 600 }}>{MARCO_LABEL[p.marco as CondPagMarco]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {snap.texto_complementar && (
        <div style={{ padding: "10px 16px", fontSize: 11, color: "#475569", background: neutral, borderTop: `1px solid ${neutral}` }}>
          {snap.texto_complementar}
        </div>
      )}
      {textoPadrao && (
        <div style={{ padding: "10px 16px", fontSize: 11, color: "#334155", background: "#fff", borderTop: `1px solid ${neutral}`, whiteSpace: "pre-line", fontStyle: "italic" }}>
          {textoPadrao}
        </div>
      )}
    </div>
  );
}

export function SignatureBlock({ label, name, subtitle, primary }: any) {
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

export function ContactLine({ icon, label, value }: any) {
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

export function Stat({ label, value, accent }: any) {
  return (
    <div>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: accent, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/* ---------- Scope card (technical/commercial, no financials) ---------- */
export function ScopeCard({ item, title, primary, accent, neutral, fontTitulo }: any) {
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

// re-export for consumers that just want the utility
export { formatCnpjCpf };