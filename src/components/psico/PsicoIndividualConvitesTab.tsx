import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Copy, Link as LinkIcon, RefreshCw } from "lucide-react";

type ConviteResp = {
  papel: "empregado" | "empregador";
  status: string;
  link: string | null;
  token: string | null;
  expira_em?: string | null;
};

export default function PsicoIndividualConvitesTab({ avaliacaoId }: { avaliacaoId: string }) {
  const [loading, setLoading] = useState(false);
  const [convites, setConvites] = useState<ConviteResp[] | null>(null);

  async function gerar() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("psico-individual-invite-token", {
        body: { avaliacao_id: avaliacaoId },
      });
      if (error) throw error;
      setConvites(((data as any)?.convites || []) as ConviteResp[]);
    } catch (e: any) {
      toast({ title: "Falha ao gerar convites", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function copiar(txt: string) {
    navigator.clipboard.writeText(txt);
    toast({ title: "Link copiado" });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Convites individuais (AQI)</CardTitle>
        <Button size="sm" onClick={gerar} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {convites ? "Atualizar" : "Gerar links"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Envie cada link ao seu respectivo respondente. O tipo (empregado ou empregador) é validado pelo servidor
          e não pode ser alterado pelo destinatário. Cada link é de uso único.
        </p>
        {!convites ? (
          <p className="text-sm text-muted-foreground">Clique em <strong>Gerar links</strong> para criar/atualizar os convites.</p>
        ) : (
          <div className="space-y-4">
            {convites.map((c) => (
              <div key={c.papel} className="rounded-md border p-3 space-y-2">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Convite do {c.papel}
                  {c.expira_em && <> · expira em {new Date(c.expira_em).toLocaleDateString("pt-BR")}</>}
                  {c.status !== "ativo" && <> · status: {c.status}</>}
                </div>
                {c.link ? (
                  <div className="flex gap-2">
                    <Input readOnly value={c.link} className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={() => copiar(c.link!)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Convite indisponível ({c.status}).</div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}