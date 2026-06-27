import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import logoNavy from "@/assets/hse-logo-navy.png";
import { formatDate, formatCnpjCpf } from "@/lib/format";
import { osStatusLabel, osPrioridadeLabel, osVisitaSituacaoLabel } from "@/lib/os";

const PAGE: React.CSSProperties = { width: "210mm", minHeight: "297mm", margin: "0 auto 12px", background: "#fff", color: "#0f172a", padding: "18mm", boxShadow: "0 10px 40px -10px rgba(11,31,77,0.18)" };

export default function OrdemServicoPrint() {
  const { id } = useParams();
  const [os, setOs] = useState<any>(null);
  const [eq, setEq] = useState<any[]>([]);
  const [ck, setCk] = useState<any[]>([]);
  const [vi, setVi] = useState<any[]>([]);
  const [qr, setQr] = useState<string>("");

  useEffect(() => { (async () => {
    if (!id) return;
    const { data } = await supabase.from("ordens_servico")
      .select("*, clients(*), execucao_servicos(numero_interno, titulo), services(nome), execucao_profissionais!ordens_servico_responsavel_tecnico_id_fkey(*)")
      .eq("id", id).maybeSingle();
    setOs(data);
    const [e, c, v] = await Promise.all([
      supabase.from("os_equipe").select("*, execucao_profissionais(*)").eq("os_id", id),
      supabase.from("os_checklist").select("*").eq("os_id", id).order("ordem"),
      supabase.from("os_visitas").select("*, execucao_profissionais(nome)").eq("os_id", id).order("data"),
    ]);
    setEq((e.data as any) || []); setCk((c.data as any) || []); setVi((v.data as any) || []);
    if (data?.qr_token) {
      const url = `${window.location.origin}/os/qr/${data.qr_token}`;
      QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#0b1f4d", light: "#ffffff" } }).then(setQr);
    }
  })(); }, [id]);

  if (!os) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  const cli = os.clients || {};
  const tec = os.execucao_profissionais;

  return (
    <div style={{ background: "#eef2f7", padding: 16, minHeight: "100vh" }}>
      <div className="no-print sticky top-0 z-10 flex justify-end gap-2 mb-3">
        <button onClick={() => window.print()} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium">Imprimir / PDF</button>
      </div>
      <section style={PAGE}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #0b1f4d", paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={logoNavy} alt="HSE" style={{ height: 50 }} />
            <div>
              <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 800, fontSize: 18, color: "#0b1f4d" }}>HSE Consulting</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5 }}>Ordem de Serviço</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#0b1f4d" }}>{os.numero}</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Abertura: {formatDate(os.data_abertura)}</div>
          </div>
        </div>

        {/* Identificação */}
        <Sec title="Identificação">
          <Grid>
            <KV k="Cliente" v={cli.razao_social || "—"} />
            <KV k="CNPJ/CPF" v={formatCnpjCpf(cli.cnpj_cpf || "")} />
            <KV k="Endereço" v={cli.endereco || "—"} />
            <KV k="Cidade/UF" v={[cli.cidade, cli.uf].filter(Boolean).join("/") || "—"} />
            <KV k="Solicitante" v={cli.solicitante || "—"} />
            <KV k="Telefone" v={cli.telefone || "—"} />
          </Grid>
        </Sec>

        {/* Serviço */}
        <Sec title="Serviço">
          <Grid>
            <KV k="Título" v={os.titulo} />
            <KV k="Serviço" v={os.servico_nome || os.services?.nome || "—"} />
            <KV k="Status" v={osStatusLabel[os.status]} />
            <KV k="Prioridade" v={osPrioridadeLabel[os.prioridade]} />
            <KV k="Previsão início" v={formatDate(os.data_prevista_inicio)} />
            <KV k="Previsão conclusão" v={formatDate(os.data_prevista_conclusao)} />
          </Grid>
          {os.objetivo && <P label="Objetivo">{os.objetivo}</P>}
          {os.escopo_contratado && <P label="Escopo contratado">{os.escopo_contratado}</P>}
          {os.descricao && <P label="Descrição">{os.descricao}</P>}
        </Sec>

        {/* Equipe */}
        <Sec title="Equipe técnica">
          {tec && (
            <div style={{ background: "#f4f6fb", padding: 12, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Responsável Técnico</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{tec.nome}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{[tec.cargo, tec.registro_profissional, tec.area].filter(Boolean).join(" • ")}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{[tec.email, tec.telefone].filter(Boolean).join(" • ")}</div>
            </div>
          )}
          {eq.length > 0 && (
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#0b1f4d", color: "#fff" }}><th style={th}>Nome</th><th style={th}>Papel</th></tr></thead>
              <tbody>{eq.map((e, i) => <tr key={e.id} style={{ background: i%2 ? "#f4f6fb" : "#fff" }}><td style={td}>{e.execucao_profissionais?.nome}</td><td style={td}>{e.papel}</td></tr>)}</tbody>
            </table>
          )}
        </Sec>

        {/* Checklist */}
        {ck.length > 0 && <Sec title="Checklist">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {ck.map(c => (
              <div key={c.id} style={{ fontSize: 11, padding: "4px 8px", borderLeft: "3px solid " + (c.concluido ? "#16a34a" : "#cbd5e1") }}>
                {c.concluido ? "☑" : "☐"} {c.descricao} {c.obrigatorio && <span style={{ color: "#94a3b8", fontSize: 9 }}>(obrig.)</span>}
              </div>
            ))}
          </div>
        </Sec>}

        {/* Cronograma */}
        {vi.length > 0 && <Sec title="Cronograma de visitas">
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#0b1f4d", color: "#fff" }}><th style={th}>Data</th><th style={th}>Horário</th><th style={th}>Responsável</th><th style={th}>Objetivo</th><th style={th}>Situação</th></tr></thead>
            <tbody>{vi.map((v, i) => (
              <tr key={v.id} style={{ background: i%2 ? "#f4f6fb" : "#fff" }}>
                <td style={td}>{formatDate(v.data)}</td>
                <td style={td}>{v.hora_inicio?.slice(0,5)}–{v.hora_fim?.slice(0,5)}</td>
                <td style={td}>{v.execucao_profissionais?.nome || "—"}</td>
                <td style={td}>{v.objetivo || "—"}</td>
                <td style={td}>{osVisitaSituacaoLabel[v.situacao]}</td>
              </tr>
            ))}</tbody>
          </table>
        </Sec>}

        {/* Assinaturas + QR */}
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 16, alignItems: "end" }}>
          <Sign label="Responsável Técnico HSE" />
          <Sign label="Cliente / Responsável" />
          <div style={{ textAlign: "center" }}>
            {qr && <img src={qr} alt="QR" style={{ width: 130, height: 130 }} />}
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>Leitura mobile</div>
          </div>
        </div>

        <div style={{ marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 8, fontSize: 9, color: "#94a3b8", textAlign: "center" }}>
          HSE Consulting • {os.numero} • Gerado em {new Date().toLocaleString("pt-BR")}
        </div>
      </section>
    </div>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 };
const td: React.CSSProperties = { padding: "6px 8px", borderTop: "1px solid #e2e8f0" };

function Sec({ title, children }: any) {
  return <div style={{ marginBottom: 14 }}>
    <div style={{ fontFamily: "Sora, sans-serif", fontSize: 12, color: "#0b1f4d", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>{title}</div>
    {children}
  </div>;
}
function Grid({ children }: any) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{children}</div>; }
function KV({ k, v }: any) { return <div><div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{k}</div><div style={{ fontSize: 12, fontWeight: 500 }}>{v}</div></div>; }
function P({ label, children }: any) { return <div style={{ marginTop: 8 }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>{label}</div><div style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-line" }}>{children}</div></div>; }
function Sign({ label }: any) { return <div><div style={{ borderTop: "1px solid #0f172a", paddingTop: 4, fontSize: 10, textAlign: "center" }}>{label}</div></div>; }