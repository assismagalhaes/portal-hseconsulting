import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useClienteAuth } from "@/lib/clienteAuth";
import { registrarLogCliente } from "@/lib/cliente";

export default function ClienteComunicacoes() {
  const { clienteUser } = useClienteAuth();
  const [items, setItems] = useState<any[]>([]);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  useEffect(() => { document.title = "Comunicações | Portal do Cliente"; load(); }, []);
  async function load() {
    const { data } = await supabase.from("cliente_comunicacoes")
      .select("*").order("created_at", { ascending: false });
    setItems(data || []);
  }
  async function enviar() {
    if (!clienteUser || !mensagem.trim()) return;
    const { error } = await supabase.from("cliente_comunicacoes").insert({
      client_id: clienteUser.client_id, cliente_usuario_id: clienteUser.id,
      autor_tipo: "cliente", autor_nome: clienteUser.nome,
      assunto: assunto || null, mensagem,
    });
    if (error) return toast.error(error.message);
    await registrarLogCliente("mensagem_enviada");
    setAssunto(""); setMensagem(""); toast.success("Mensagem enviada!"); load();
  }
  return (
    <div>
      <PageHeader title="Comunicações" subtitle="Mural de mensagens entre você e a HSE" />
      <div className="p-6 space-y-4">
        <Card><CardContent className="p-4 space-y-2">
          <div className="space-y-1"><Label>Assunto</Label>
            <Input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Sobre o que é?" /></div>
          <div className="space-y-1"><Label>Mensagem</Label>
            <Textarea rows={3} value={mensagem} onChange={e => setMensagem(e.target.value)} /></div>
          <div className="flex justify-end"><Button onClick={enviar}>Enviar</Button></div>
        </CardContent></Card>
        <div className="space-y-2">
          {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma mensagem.</div>}
          {items.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={m.autor_tipo === "hse" ? "default" : "outline"}>
                      {m.autor_tipo === "hse" ? "HSE Consulting" : m.autor_nome || "Você"}
                    </Badge>
                    {m.assunto && <span className="text-sm font-medium">{m.assunto}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{m.mensagem}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}