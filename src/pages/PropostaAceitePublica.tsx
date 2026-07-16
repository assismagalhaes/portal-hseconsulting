import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Eraser, FileSignature, ShieldCheck, Loader2 } from "lucide-react";
import logoNavy from "@/assets/hse-logo-navy.png";
import { brl } from "@/lib/format";

type Aceite = {
  id: string;
  token: string;
  status: "pendente" | "aceito" | "recusado" | "expirado" | "cancelado";
  aceito_em: string | null;
  recusado_em: string | null;
  expires_at: string | null;
  aceito_por_nome: string | null;
  aceito_por_email: string | null;
  aceito_por_cpf: string | null;
  aceito_por_cargo: string | null;
  observacoes: string | null;
  motivo_recusa: string | null;
  revisao: number | null;
};

export default function PropostaAceitePublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aceite, setAceite] = useState<Aceite | null>(null);
  const [proposta, setProposta] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [coligadas, setColigadas] = useState<any[]>([]);

  // form
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [obs, setObs] = useState("");
  const [aceitoTermos, setAceitoTermos] = useState(false);

  // canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [assinado, setAssinado] = useState(false);
  const [modo, setModo] = useState<"aceitar" | "recusar" | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  useEffect(() => { document.title = "Aceite de Proposta | HSE Consulting"; carregar(); }, [token]);

  async function carregar() {
    if (!token) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_proposta_para_aceite", { _token: token });
    setLoading(false);
    if (error || !data || (data as any).error) {
      toast.error("Link inválido ou expirado.");
      return;
    }
    const d: any = data;
    setAceite(d.aceite);
    setProposta(d.proposta);
    setCliente(d.cliente);
    setItens(d.itens || []);
    // Coligadas (multi-CNPJ) — devolvidas pela própria RPC pública (valida token)
    setColigadas(d.coligadas || []);
    setNome(d.aceite?.aceito_por_nome || d.cliente?.solicitante || "");
    setEmail(d.aceite?.aceito_por_email || d.cliente?.email || "");
    setCpf(d.aceite?.aceito_por_cpf || "");
    setCargo(d.aceite?.aceito_por_cargo || d.cliente?.cargo || "");
  }

  // --- canvas de assinatura ---
  useEffect(() => {
    if (modo !== "aceitar") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // HiDPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    let drawing = false;
    let last: { x: number; y: number } | null = null;
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      drawing = true;
      last = pos(e);
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing || !last) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      setAssinado(true);
    };
    const up = () => { drawing = false; last = null; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [modo]);

  function limparAssinatura() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setAssinado(false);
  }

  async function coletarMetadados() {
    let ip: string | null = null;
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      const j = await r.json();
      ip = j.ip;
    } catch { /* ignore */ }
    return { ip, user_agent: navigator.userAgent };
  }

  async function enviarAceite() {
    if (!aceite) return;
    if (!nome.trim()) return toast.error("Informe seu nome completo.");
    if (!email.trim()) return toast.error("Informe seu e-mail.");
    if (!aceitoTermos) return toast.error("Você precisa confirmar a leitura e concordância com a proposta.");
    if (!assinado) return toast.error("Assine no campo abaixo antes de confirmar.");

    const canvas = canvasRef.current;
    const assinaturaBase64 = canvas?.toDataURL("image/png") || null;
    const meta = await coletarMetadados();

    setSaving(true);
    const { data, error } = await supabase.rpc("registrar_aceite_proposta", {
      _token: aceite.token,
      _nome: nome.trim(),
      _email: email.trim(),
      _cpf: cpf.trim() || null,
      _cargo: cargo.trim() || null,
      _observacoes: obs.trim() || null,
      _assinatura_base64: assinaturaBase64,
      _ip: meta.ip,
      _user_agent: meta.user_agent,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao registrar aceite: " + error.message);
    if ((data as any)?.error) return toast.error("Não foi possível registrar o aceite (" + (data as any).error + ").");
    toast.success("Aceite registrado com sucesso!");
    carregar();
  }

  async function enviarRecusa() {
    if (!aceite) return;
    if (!nome.trim()) return toast.error("Informe seu nome.");
    if (!motivoRecusa.trim()) return toast.error("Informe o motivo da recusa.");
    const meta = await coletarMetadados();
    setSaving(true);
    const { data, error } = await supabase.rpc("registrar_recusa_proposta", {
      _token: aceite.token,
      _nome: nome.trim(),
      _email: email.trim() || null,
      _motivo: motivoRecusa.trim(),
      _ip: meta.ip,
      _user_agent: meta.user_agent,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao registrar recusa: " + error.message);
    if ((data as any)?.error) return toast.error("Não foi possível registrar a recusa (" + (data as any).error + ").");
    toast.success("Recusa registrada.");
    carregar();
  }

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
    </div>
  );

  if (!aceite || !proposta) return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <Card className="max-w-md w-full"><CardContent className="p-6 text-center">
        <XCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
        <div className="font-semibold">Link inválido ou expirado</div>
        <p className="text-sm text-muted-foreground mt-1">Solicite ao responsável comercial um novo link de aceite.</p>
      </CardContent></Card>
    </div>
  );

  const jaResolvido = aceite.status === "aceito" || aceite.status === "recusado";
  const expirado = aceite.status === "expirado";
  const cancelado = aceite.status === "cancelado";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between gap-4">
          <img src={logoNavy} alt="HSE Consulting" className="h-10" />
          <Badge variant="outline" className="font-mono">Aceite eletrônico</Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Resumo da proposta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Proposta</div>
                <div className="font-mono text-xl">{proposta.numero}</div>
                {proposta.numero && (
                  <div className="text-sm text-muted-foreground font-normal mt-0.5">Proposta {proposta.numero}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Valor total</div>
                <div className="text-2xl font-bold">{brl(proposta.valor_total || 0)}</div>
                {proposta.revisao_atual ? <div className="text-xs text-muted-foreground">Revisão {String(proposta.revisao_atual).padStart(2, "0")}</div> : null}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid md:grid-cols-2 gap-3">
              <InfoRow label="Cliente" value={cliente?.nome_fantasia || cliente?.razao_social} />
              <InfoRow label="CNPJ/CPF" value={cliente?.cnpj_cpf} mono />
              <InfoRow label="Emissão" value={proposta.data_emissao ? new Date(proposta.data_emissao).toLocaleDateString("pt-BR") : "—"} />
              <InfoRow label="Validade" value={proposta.validade ? new Date(proposta.validade).toLocaleDateString("pt-BR") : "—"} />
              <InfoRow label="Condições de pagamento" value={proposta.condicoes_pagamento} full />
              {proposta.outras_condicoes && <InfoRow label="Outras condições" value={proposta.outras_condicoes} full />}
            </div>

            {coligadas.length > 0 && (
              <div className="mt-2 border rounded-md p-3 bg-muted/40">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Demais empresas contempladas ({coligadas.length})
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {coligadas.map((pc: any) => (
                    <div key={pc.id} className="rounded border bg-white p-2">
                      <div className="text-sm font-medium">
                        {pc.clients?.nome_fantasia || pc.clients?.razao_social || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {pc.clients?.cnpj_cpf || "—"}
                        {pc.clients?.cidade ? ` · ${pc.clients.cidade}/${pc.clients.uf || ""}` : ""}
                      </div>
                      {pc.observacao && (
                        <div className="text-xs text-muted-foreground italic mt-1">{pc.observacao}</div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground italic mt-2">
                  Esta proposta é válida para todas as empresas listadas. O faturamento será emitido em nome da empresa principal.
                </p>
              </div>
            )}

            {itens.length > 0 && (
              <div className="border rounded-md overflow-hidden mt-2">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Serviço</th>
                      <th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-right">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{it.numero_item ?? i + 1}</td>
                        <td className="p-2">{it.nome}</td>
                        <td className="p-2 text-right">{it.quantidade} {it.unidade || ""}</td>
                        <td className="p-2 text-right font-medium">{brl(it.valor_total || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado atual */}
        {expirado || cancelado ? (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-6 text-center space-y-2">
              <XCircle className="h-12 w-12 text-amber-600 mx-auto" />
              <div className="font-bold text-amber-800 text-lg">
                {expirado ? "Link expirado" : "Link cancelado"}
              </div>
              <p className="text-sm text-amber-900">
                {expirado
                  ? <>Este link de aceite expirou {aceite.expires_at ? <>em <strong>{new Date(aceite.expires_at).toLocaleString("pt-BR")}</strong></> : null} e não pode mais ser utilizado.</>
                  : <>Este link foi cancelado e não pode mais ser utilizado.</>}
              </p>
              <p className="text-sm text-amber-900 mt-2">
                Entre em contato com o responsável comercial para receber um novo link.
              </p>
            </CardContent>
          </Card>
        ) : jaResolvido ? (
          <Card className={aceite.status === "aceito" ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}>
            <CardContent className="p-6 text-center space-y-2">
              {aceite.status === "aceito" ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                  <div className="font-bold text-emerald-800 text-lg">Proposta aceita</div>
                  <p className="text-sm text-emerald-900">
                    Aceite registrado em <strong>{new Date(aceite.aceito_em!).toLocaleString("pt-BR")}</strong> por{" "}
                    <strong>{aceite.aceito_por_nome}</strong>{aceite.aceito_por_email ? ` (${aceite.aceito_por_email})` : ""}.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 text-red-600 mx-auto" />
                  <div className="font-bold text-red-800 text-lg">Proposta recusada</div>
                  <p className="text-sm text-red-900">
                    Recusa registrada em <strong>{new Date(aceite.recusado_em!).toLocaleString("pt-BR")}</strong>.
                  </p>
                  {aceite.motivo_recusa && <p className="text-sm mt-2"><strong>Motivo:</strong> {aceite.motivo_recusa}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Ações */}
            {!modo && (
              <div className="grid md:grid-cols-2 gap-3">
                <Button size="lg" className="h-16 text-base bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setModo("aceitar")}>
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Aceitar proposta
                </Button>
                <Button size="lg" variant="outline" className="h-16 text-base border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setModo("recusar")}>
                  <XCircle className="h-5 w-5 mr-2" /> Recusar proposta
                </Button>
              </div>
            )}

            {/* Form ACEITAR */}
            {modo === "aceitar" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" /> Formalização do aceite</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div><Label>Nome completo *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
                    <div><Label>E-mail *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <div><Label>CPF</Label><Input value={cpf} onChange={e => setCpf(e.target.value)} /></div>
                    <div><Label>Cargo</Label><Input value={cargo} onChange={e => setCargo(e.target.value)} /></div>
                  </div>
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Notas ou solicitações complementares…" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Assinatura *</Label>
                      <Button variant="ghost" size="sm" onClick={limparAssinatura}><Eraser className="h-4 w-4 mr-1" /> Limpar</Button>
                    </div>
                    <div className="border-2 border-dashed rounded-md bg-white touch-none" style={{ height: 180 }}>
                      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Assine acima com o mouse ou o dedo (no celular).</p>
                  </div>

                  <label className="flex items-start gap-2 rounded-md border p-3 bg-slate-50 cursor-pointer">
                    <Checkbox checked={aceitoTermos} onCheckedChange={(v) => setAceitoTermos(!!v)} className="mt-0.5" />
                    <span className="text-sm">
                      Declaro que <strong>li e concordo integralmente</strong> com o conteúdo da proposta <strong>{proposta.numero}</strong>,
                      seus valores, prazos e condições comerciais. Este aceite eletrônico produz efeitos jurídicos conforme a
                      Medida Provisória 2.200-2/2001.
                    </span>
                  </label>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Button variant="ghost" onClick={() => setModo(null)}>Voltar</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={enviarAceite} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                      Confirmar aceite
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form RECUSAR */}
            {modo === "recusar" && (
              <Card>
                <CardHeader><CardTitle>Registrar recusa</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div><Label>Seu nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
                    <div><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  </div>
                  <div>
                    <Label>Motivo da recusa *</Label>
                    <Textarea rows={3} value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}
                      placeholder="Ex.: valor acima do orçamento previsto, escopo não atende…" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => setModo(null)}>Voltar</Button>
                    <Button variant="destructive" onClick={enviarRecusa} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                      Confirmar recusa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          HSE Consulting — este link é único e vinculado à proposta. Não compartilhe com terceiros.
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, full }: { label: string; value?: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : ""}>{value || "—"}</div>
    </div>
  );
}