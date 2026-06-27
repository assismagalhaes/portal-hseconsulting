import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoNavy from "@/assets/hse-logo-navy.png";
import { tipoLabel, statusLabel, resolverVariaveis, montarContexto } from "@/lib/documentos";

export default function DocumentoPDF() {
  const { id } = useParams();
  const [doc, setDoc] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [proposta, setProposta] = useState<any>(null);
  const [execucao, setExecucao] = useState<any>(null);
  const [os, setOs] = useState<any>(null);
  const [prof, setProf] = useState<any>(null);
  const [revisoes, setRevisoes] = useState<any[]>([]);
  const [template, setTemplate] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: d } = await supabase.from("documentos_tecnicos").select("*").eq("id", id).single();
      setDoc(d);
      if (d?.client_id) {
        const { data } = await supabase.from("clients").select("*").eq("id", d.client_id).single(); setCliente(data);
      }
      if (d?.proposal_id) {
        const { data } = await supabase.from("proposals").select("*").eq("id", d.proposal_id).single(); setProposta(data);
      }
      if (d?.execucao_id) {
        const { data } = await supabase.from("execucao_servicos").select("*").eq("id", d.execucao_id).single(); setExecucao(data);
      }
      if (d?.os_id) {
        const { data } = await supabase.from("ordens_servico").select("*").eq("id", d.os_id).single(); setOs(data);
      }
      if (d?.responsavel_tecnico_id) {
        const { data } = await supabase.from("execucao_profissionais").select("*").eq("id", d.responsavel_tecnico_id).single(); setProf(data);
      }
      const { data: rv } = await supabase.from("documentos_revisoes").select("*").eq("documento_id", id).order("numero_revisao");
      setRevisoes(rv || []);
      const { data: tpl } = await supabase.from("proposal_template").select("*").limit(1).maybeSingle();
      setTemplate(tpl);
      setTimeout(() => window.print(), 800);
    })();
  }, [id]);

  if (!doc) return <div className="p-8">Carregando...</div>;

  const ctx = montarContexto({ documento: doc, cliente, proposta, execucao, os, profissional: prof });
  const htmlSrc: string = (doc.conteudo_json as any)?.html || "";
  const htmlResolvido = resolverVariaveis(htmlSrc, ctx);

  return (
    <div className="doc-pdf">
      <style>{`
        @page { size: A4; margin: 18mm 16mm 22mm 16mm; }
        @media print { body { background: white !important; } .no-print { display: none !important; } }
        .doc-pdf { color: #0f172a; font-family: 'Manrope', sans-serif; }
        .page { page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        .hr-band { height: 6px; background: linear-gradient(90deg,#0f1e3a 0%, #00c389 100%); }
        .heading-doc { font-family: 'Sora', sans-serif; }
        .prose-doc { line-height: 1.7; font-size: 11pt; }
        .prose-doc h1 { font-family: 'Sora', sans-serif; font-size: 18pt; margin: 16pt 0 10pt; color: #0f1e3a; border-bottom: 2px solid #00c389; padding-bottom: 4pt; }
        .prose-doc h2 { font-family: 'Sora', sans-serif; font-size: 14pt; margin: 14pt 0 8pt; color: #0f1e3a; }
        .prose-doc h3 { font-family: 'Sora', sans-serif; font-size: 12pt; margin: 12pt 0 6pt; color: #0f1e3a; }
        .prose-doc p { margin: 0 0 8pt; }
        .prose-doc ul, .prose-doc ol { margin: 0 0 8pt 18pt; }
        .prose-doc table { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 10pt; }
        .prose-doc th, .prose-doc td { border: 1px solid #cbd5e1; padding: 6pt 8pt; text-align: left; }
        .prose-doc th { background: #f1f5f9; }
        .prose-doc img { max-width: 100%; }
        .footer-tech { position: fixed; bottom: 8mm; left: 16mm; right: 16mm; font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4pt; display: flex; justify-content: space-between; }
      `}</style>

      {/* CAPA */}
      <div className="page" style={{ minHeight: "260mm", padding: "20mm 6mm 0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <img src={logoNavy} alt="HSE Consulting" style={{ height: 64 }} />
          <div className="hr-band" style={{ marginTop: 20 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#64748b", textTransform: "uppercase" }}>Documento técnico</div>
          <div className="heading-doc" style={{ fontSize: 32, fontWeight: 800, color: "#0f1e3a", marginTop: 6 }}>{tipoLabel(doc.tipo)}</div>
          <div className="heading-doc" style={{ fontSize: 22, color: "#334155", marginTop: 4 }}>{doc.titulo}</div>
          <div style={{ marginTop: 36, fontSize: 11, color: "#475569" }}>
            <div><strong>Cliente:</strong> {cliente?.nome_fantasia || cliente?.razao_social || "—"}</div>
            {cliente?.cnpj && <div><strong>CNPJ:</strong> {cliente.cnpj}</div>}
            <div><strong>Número:</strong> {doc.numero}</div>
            <div><strong>Revisão:</strong> {String(doc.revisao).padStart(2, "0")}</div>
            <div><strong>Emissão:</strong> {doc.data_emissao ? new Date(doc.data_emissao).toLocaleDateString("pt-BR") : "—"}</div>
            {doc.data_vencimento && <div><strong>Validade:</strong> {new Date(doc.data_vencimento).toLocaleDateString("pt-BR")}</div>}
          </div>
        </div>
        <div className="hr-band" />
      </div>

      {/* CORPO TÉCNICO */}
      <div className="page">
        <h1 className="heading-doc" style={{ fontSize: 16, color: "#0f1e3a", borderBottom: "2px solid #00c389", paddingBottom: 6 }}>Identificação</h1>
        <table className="prose-doc" style={{ borderCollapse: "collapse", width: "100%", fontSize: "10pt" }}>
          <tbody>
            <tr><td><strong>Razão social</strong></td><td>{cliente?.razao_social || "—"}</td></tr>
            <tr><td><strong>CNPJ/CPF</strong></td><td>{cliente?.cnpj || "—"}</td></tr>
            <tr><td><strong>Endereço</strong></td><td>{cliente?.endereco || "—"}</td></tr>
            <tr><td><strong>Cidade/UF</strong></td><td>{[cliente?.cidade, cliente?.estado].filter(Boolean).join(" / ") || "—"}</td></tr>
            <tr><td><strong>Proposta</strong></td><td>{proposta?.numero || "—"}</td></tr>
            <tr><td><strong>OS</strong></td><td>{os?.numero || "—"}</td></tr>
            <tr><td><strong>Responsável técnico</strong></td><td>{prof?.nome || "—"} {prof?.registro_profissional ? `— ${prof.registro_profissional}` : ""}</td></tr>
          </tbody>
        </table>

        <div className="prose-doc" style={{ marginTop: 18 }} dangerouslySetInnerHTML={{ __html: htmlResolvido || "<p><em>Sem conteúdo técnico.</em></p>" }} />

        <div className="footer-tech">
          <span>{tipoLabel(doc.tipo)} • {doc.numero} • Rev. {String(doc.revisao).padStart(2, "0")}</span>
          <span>HSE Consulting</span>
        </div>
      </div>

      {/* ASSINATURA */}
      <div className="page">
        <h1 className="heading-doc" style={{ fontSize: 16, color: "#0f1e3a", borderBottom: "2px solid #00c389", paddingBottom: 6 }}>Responsabilidade Técnica</h1>
        <div style={{ marginTop: 60, textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #0f1e3a", width: 320, margin: "80px auto 8px" }} />
          <div style={{ fontWeight: 700 }}>{prof?.nome || "—"}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>{doc.assinatura_cargo || prof?.cargo || ""}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>{doc.assinatura_registro || prof?.registro_profissional || ""}</div>
          {doc.assinatura_art && <div style={{ fontSize: 11, color: "#475569" }}>ART: {doc.assinatura_art}</div>}
        </div>

        {revisoes.length > 0 && (
          <>
            <h2 className="heading-doc" style={{ marginTop: 50, fontSize: 13, color: "#0f1e3a" }}>Histórico de Revisões</h2>
            <table className="prose-doc" style={{ width: "100%", fontSize: "9pt" }}>
              <thead><tr><th>Rev.</th><th>Descrição</th><th>Status</th><th>Data</th></tr></thead>
              <tbody>
                {revisoes.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.numero_revisao).padStart(2, "0")}</td>
                    <td>{r.descricao || "—"}</td>
                    <td>{statusLabel(r.status)}</td>
                    <td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="footer-tech">
          <span>{tipoLabel(doc.tipo)} • {doc.numero}</span>
          <span>{template?.razao_social || "HSE Consulting"}</span>
        </div>
      </div>

      <div className="no-print fixed bottom-4 right-4">
        <button onClick={() => window.print()} className="bg-primary text-primary-foreground px-4 py-2 rounded-md shadow">Imprimir / Salvar PDF</button>
      </div>
    </div>
  );
}