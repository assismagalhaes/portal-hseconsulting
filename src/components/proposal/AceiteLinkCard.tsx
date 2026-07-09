import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Link2, Plus, ShieldCheck, XCircle, RefreshCw, Trash2, Eye } from "lucide-react";

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
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Aguardando cliente",  cls: "bg-amber-500/15 text-amber-800" },
  aceito:    { label: "Aceito",              cls: "bg-emerald-500/15 text-emerald-800" },
  recusado:  { label: "Recusado",            cls: "bg-red-500/15 text-red-800" },
  expirado:  { label: "Expirado",            cls: "bg-muted text-muted-foreground" },
  cancelado: { label: "Cancelado",           cls: "bg-muted text-muted-foreground" },
};

export default function AceiteLinkCard({ proposalId, revisaoAtual }: { proposalId: string; revisaoAtual: number | null }) {
  const [items, setItems] = useState<Aceite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { carregar(); }, [proposalId]);

  async function carregar() {
    const { data } = await supabase
      .from("proposal_aceites")
      .select("id, token, status, revisao, aceito_em, recusado_em, visualizado_em, aceito_por_nome, aceito_por_email, motivo_recusa, created_at")
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
    return `${window.location.origin}/aceite/${token}`;
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(urlDe(token));
      toast.success("Link copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
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
    </Card>
  );
}