import { Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PAGE_STYLE, ContactLine, Stat } from "./atoms";

/** Capa (primeira página) do PDF da proposta. */
export function CapaPage({ proposal, client, tpl, primary, accent, logoSrcLight, capaSrc, tituloOverride, subtituloOverride }: any) {
  const titulo = tituloOverride || client?.nome_fantasia || client?.razao_social || "Cliente";
  return (
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
            {titulo}
          </h1>
          {subtituloOverride && (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: -12, marginBottom: 18, letterSpacing: 0.3 }}>
              {subtituloOverride}
            </div>
          )}
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", fontSize: 13 }}>
            <Stat label="Nº da proposta" value={proposal.numero} accent={accent} />
            <Stat label="Data" value={new Date(((proposal.data_emissao || proposal.created_at) + "").slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")} accent={accent} />
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
  );
}

/** Contracapa (última página) do PDF da proposta. */
export function ContracapaPage({ tpl, primary, accent, logoSrcLight, contraSrc }: any) {
  return (
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
  );
}