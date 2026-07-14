import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Link2, Plus, ShieldCheck, XCircle, Trash2, Eye, Mail, Loader2 } from "lucide-react";
import { brl } from "@/lib/format";

type Aceite = {
  id: string;
  token: string;
  status: string;
  revisao: number | null;
  aceito_em: string | null;
  recusado_em: string | null;
  visualizado_em: string | null;
  aceito_por_nome: string | null;
  aceito_por_email: string | null;
  motivo_recusa: string | null;
  created_at: string;
  expires_at: string | null;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Aguardando cliente",  cls: "bg-amber-500/15 text-amber-800" },
  aceito:    { label: "Aceito",              cls: "bg-emerald-500/15 text-emerald-800" },
  recusado:  { label: "Recusado",            cls: "bg-red-500/15 text-red-800" },
  expirado:  { label: "Expirado",            cls: "bg-muted text-muted-foreground" },
  cancelado: { label: "Cancelado",           cls: "bg-muted text-muted-foreground" },
};

export default function AceiteLinkCard({
  proposalId,
  revisaoAtual,
  proposalNumero,
  proposalTitulo,
  valorTotal,
  validade,
  clienteNome,
  clienteEmail,
  clienteSolicitante,
}: {
  proposalId: string;
  revisaoAtual: number | null;
  proposalNumero?: string | null;
  proposalTitulo?: string | null;
  valorTotal?: number | null;
  validade?: string | null;
  clienteNome?: string | null;
  clienteEmail?: string | null;
  clienteSolicitante?: string | null;
}) {
  const [items, setItems] = useState<Aceite[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState<Aceite | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailNome, setEmailNome] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  useEffect(() => { carregar(); }, [proposalId]);

  async function carregar() {
    const { data } = await supabase
      .from("proposal_aceites")
      .select("id, token, status, revisao, aceito_em, recusado_em, visualizado_em, aceito_por_nome, aceito_por_email, motivo_recusa, created_at, expires_at")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
  }

  async function gerarLink() {
    setLoading(true);
    const { error } = await supabase.from("proposal_aceites").insert({
      proposal_id: proposalId,
      revisao: revisaoAtual ?? null,
    } as any);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Link de aceite gerado.");
    carregar();
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar este link? O cliente não conseguirá mais aceitar por ele.")) return;
    const { error } = await supabase.from("proposal_aceites").update({ status: "cancelado" } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Link cancelado.");
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este registro definitivamente?")) return;
    const { error } = await supabase.from("proposal_aceites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    carregar();
  }

  function urlDe(token: string) {
    const origin = window.location.origin;
    // Preview do Lovable exige login — sempre usar a URL publicada (pública) para o aceite.
    const isPreview = /id-preview--.*\.lovable\.app$/i.test(window.location.hostname)
      || /lovableproject\.com$/i.test(window.location.hostname);
    const base = isPreview ? "https://portal.hseconsulting.com.br" : origin;
    return `${base}/aceite/${token}`;
  }

  async function copiar(token: string) {
    const url = urlDe(token);
    // 1) Tenta a Clipboard API moderna (requer contexto seguro + permissão)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado para a área de transferência.");
        return;
      }
    } catch {
      // segue para o fallback
    }
    // 2) Fallback via textarea + execCommand (funciona em iframes sem permissão de clipboard)
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        toast.success("Link copiado para a área de transferência.");
        return;
      }
      throw new Error("execCommand copy retornou false");
    } catch {
      // 3) Último recurso: mostrar prompt para o usuário copiar manualmente
      window.prompt("Copie o link abaixo (Ctrl+C / Cmd+C):", url);
    }
  }

  function abrirEnvioEmail(it: Aceite) {
    setEmailTo(clienteEmail || "");
    setEmailNome(clienteSolicitante || "");
    setEmailMsg("");
    setEmailOpen(it);
  }

  async function enviarEmail() {
    if (!emailOpen) return;
    if (!emailTo.trim() || !/^\S+@\S+\.\S+$/.test(emailTo.trim())) {
      return toast.error("Informe um e-mail válido.");
    }
    setEnviandoEmail(true);
    const link = urlDe(emailOpen.token);
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "proposta-aceite-link",
        recipientEmail: emailTo.trim(),
        idempotencyKey: `aceite-${emailOpen.id}-${Date.now()}`,
        templateData: {
          clienteNome: clienteNome || "",
          destinatarioNome: emailNome.trim() || "",
          propostaNumero: proposalNumero || "",
          propostaTitulo: proposalTitulo || "",
          valorTotal: valorTotal != null ? brl(valorTotal) : "",
          validade: validade ? new Date(validade).toLocaleDateString("pt-BR") : "",
          linkAceite: link,
          remetenteNome: "Equipe HSE Consulting",
          mensagemPersonalizada: emailMsg.trim(),
        },
      },
    });
    setEnviandoEmail(false);
    if (error) return toast.error("Falha ao enviar e-mail: " + error.message);
    toast.success(`E-mail enviado para ${emailTo}.`);
    setEmailOpen(null);
  }

  const temPendente = items.some(i => i.status === "pendente");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Aceite eletrônico</span>
          <Button size="sm" onClick={gerarLink} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" /> Gerar link
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum link gerado ainda. Ao clicar em <strong>Gerar link</strong>, criamos uma URL única que pode ser enviada ao
            cliente por e-mail ou WhatsApp para aceite eletrônico com assinatura desenhada.
          </p>
        )}

        {items.map(it => {
          const cfg = STATUS_CFG[it.status] || STATUS_CFG.pendente;
          return (
            <div key={it.id} className="border rounded-md p-3 space-y-2 bg-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge className={cfg.cls}>{cfg.label}</Badge>
                  {it.revisao != null && <Badge variant="outline" className="font-mono text-xs">Rev. {String(it.revisao).padStart(2, "0")}</Badge>}
                  <span className="text-xs text-muted-foreground">Criado em {new Date(it.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-1">
                  {it.status === "pendente" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copiar(it.token)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEnvioEmail(it)}>
                        <Mail className="h-3.5 w-3.5 mr-1" /> Enviar por e-mail
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => window.open(urlDe(it.token), "_blank")}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Abrir
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelar(it.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </>
                  )}
                  {(it.status === "cancelado" || it.status === "expirado") && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir(it.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {it.status === "pendente" && (
                <div className="flex items-center gap-2 text-xs bg-slate-50 rounded px-2 py-1 border">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate font-mono">{urlDe(it.token)}</span>
                </div>
              )}

              {it.visualizado_em && it.status === "pendente" && (
                <p className="text-xs text-muted-foreground">👁 Cliente visualizou em {new Date(it.visualizado_em).toLocaleString("pt-BR")}</p>
              )}

              {it.status === "pendente" && it.expires_at && (
                <p className="text-xs text-muted-foreground">⏱ Expira em {new Date(it.expires_at).toLocaleString("pt-BR")}</p>
              )}

              {it.status === "aceito" && (
                <p className="text-xs text-emerald-800">
                  Aceito em {new Date(it.aceito_em!).toLocaleString("pt-BR")} por <strong>{it.aceito_por_nome}</strong>
                  {it.aceito_por_email ? ` (${it.aceito_por_email})` : ""}.
                </p>
              )}
              {it.status === "recusado" && (
                <p className="text-xs text-red-800">
                  Recusado em {new Date(it.recusado_em!).toLocaleString("pt-BR")}
                  {it.aceito_por_nome ? ` por ${it.aceito_por_nome}` : ""}.
                  {it.motivo_recusa && <> — <em>{it.motivo_recusa}</em></>}
                </p>
              )}
            </div>
          );
        })}

        {temPendente && (
          <p className="text-xs text-muted-foreground pt-1">
            💡 Envie o link por e-mail ou WhatsApp. O cliente registra o aceite (ou recusa) com assinatura desenhada e a proposta é atualizada automaticamente.
          </p>
        )}
      </CardContent>

      <Dialog open={!!emailOpen} onOpenChange={(o) => !o && setEmailOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Enviar link por e-mail</DialogTitle>
            <DialogDescription>
              O cliente receberá um e-mail com o resumo da proposta e o botão para aceitar ou recusar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Destinatário *</Label>
              <Input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="cliente@empresa.com" />
            </div>
            <div>
              <Label>Nome do destinatário</Label>
              <Input value={emailNome} onChange={e => setEmailNome(e.target.value)} placeholder="Nome de quem receberá" />
            </div>
            <div>
              <Label>Mensagem personalizada (opcional)</Label>
              <Textarea rows={3} value={emailMsg} onChange={e => setEmailMsg(e.target.value)}
                placeholder="Ex.: Conforme conversado, segue proposta para sua análise…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(null)}>Cancelar</Button>
            <Button onClick={enviarEmail} disabled={enviandoEmail}>
              {enviandoEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}