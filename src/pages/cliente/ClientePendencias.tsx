import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useClienteAuth } from "@/lib/clienteAuth";
import { registrarLogCliente } from "@/lib/cliente";

export default function ClientePendencias() {
  const { clienteUser } = useClienteAuth();
  const [items, setItems] = useState<any[]>([]);
  const [obs, setObs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { document.title = "Pendências | Portal do Cliente"; load(); }, []);
  async function load() {
    const { data } = await supabase.from("documentos_pendentes")
      .select("id, documento_solicitado, data_solicitacao, prazo, status, observacao")
      .order("prazo", { ascending: true });
    setItems(data || []);
  }

  async function enviar(pid: string, file: File) {
    if (!clienteUser) return;
    setBusy(pid);
    try {
      const path = `${clienteUser.client_id}/${pid}-${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("cliente-uploads").upload(path, file);
      if (up.error) throw up.error;
      await supabase.from("cliente_uploads").insert({
        client_id: clienteUser.client_id, cliente_usuario_id: clienteUser.id,
        pendencia_id: pid, arquivo_url: path, arquivo_nome: file.name,
        mime_type: file.type, tamanho_bytes: file.size, observacao: obs[pid] || null,
      });
      await supabase.from("documentos_pendentes").update({ status: "recebido" as any }).eq("id", pid);
      await registrarLogCliente("arquivo_enviado", file.name);
      toast.success("Arquivo enviado!");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  return (
    <div>
      <PageHeader title="Pendências documentais" subtitle="Documentos solicitados pela HSE" />
      <div className="p-6 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Sem pendências.</div>}
        {items.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.documento_solicitado}</div>
                  <div className="text-xs text-muted-foreground">Solicitado em {p.data_solicitacao || "—"} • Prazo {p.prazo || "—"}</div>
                  {p.observacao && <div className="text-xs mt-1">📝 {p.observacao}</div>}
                </div>
                <Badge variant={p.status === "recebido" ? "secondary" : "outline"}>{p.status}</Badge>
              </div>
              {p.status !== "recebido" && (
                <div className="space-y-2 border-t pt-3">
                  <div className="space-y-1">
                    <Label>Observação (opcional)</Label>
                    <Textarea rows={2} value={obs[p.id] || ""} onChange={e => setObs({ ...obs, [p.id]: e.target.value })} />
                  </div>
                  <Label className="flex items-center gap-2 cursor-pointer text-sm border rounded-md px-3 py-2 w-fit hover:bg-muted">
                    <Upload className="h-4 w-4" /> {busy === p.id ? "Enviando…" : "Anexar arquivo"}
                    <Input type="file" className="hidden" disabled={busy === p.id}
                      onChange={e => { const f = e.target.files?.[0]; if (f) enviar(p.id, f); }} />
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}