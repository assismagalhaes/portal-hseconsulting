import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CLIENTE_PERFIL_LABEL, CLIENTE_STATUS_LABEL } from "@/lib/cliente";
import { Plus, Lock, Unlock, RotateCcw } from "lucide-react";

export default function PortalClienteConfig() {
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [config, setConfig] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [permMap, setPermMap] = useState<Record<string, any>>({});
  const [openNew, setOpenNew] = useState(false);
  const [novo, setNovo] = useState<any>({ nome: "", email: "", cargo: "", telefone: "", whatsapp: "", perfil: "visualizador" });

  useEffect(() => {
    document.title = "Portal do Cliente | Configurações";
    supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social").then(({ data }) => {
      setClients(data || []);
      if (data && data.length && !clientId) setClientId(data[0].id);
    });
  }, []);

  useEffect(() => { if (clientId) loadClient(); }, [clientId]);

  async function loadClient() {
    const [cfg, us] = await Promise.all([
      supabase.from("cliente_configuracoes").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("cliente_usuarios").select("*").eq("client_id", clientId).order("created_at"),
    ]);
    setConfig((cfg.data as any) ?? { client_id: clientId, portal_ativo: false });
    setUsuarios(us.data || []);
    if (us.data?.length) {
      const ids = us.data.map((u: any) => u.id);
      const { data: perms } = await supabase.from("cliente_permissoes").select("*").in("cliente_usuario_id", ids);
      const m: any = {}; (perms || []).forEach((p: any) => { m[p.cliente_usuario_id] = p; });
      setPermMap(m);
    } else setPermMap({});
  }

  async function saveConfig(patch: any) {
    const next = { ...config, ...patch, client_id: clientId };
    const { data, error } = await supabase.from("cliente_configuracoes")
      .upsert(next, { onConflict: "client_id" }).select().maybeSingle();
    if (error) return toast.error(error.message);
    setConfig(data); toast.success("Salvo");
  }

  async function criarUsuario() {
    if (!novo.nome || !novo.email) return toast.error("Nome e e-mail obrigatórios.");
    const { error } = await supabase.from("cliente_usuarios").insert({ ...novo, client_id: clientId });
    if (error) return toast.error(error.message);
    setOpenNew(false); setNovo({ nome: "", email: "", cargo: "", telefone: "", whatsapp: "", perfil: "visualizador" });
    toast.success("Usuário criado. Envie convite manualmente por agora.");
    loadClient();
  }

  async function setStatusUsuario(id: string, status: string) {
    const { error } = await supabase.from("cliente_usuarios").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    loadClient();
  }

  async function setPerm(uid: string, campo: string, val: boolean) {
    const atual = permMap[uid] || { cliente_usuario_id: uid };
    const next = { ...atual, [campo]: val };
    const { error } = await supabase.from("cliente_permissoes").upsert(next, { onConflict: "cliente_usuario_id" });
    if (error) return toast.error(error.message);
    setPermMap({ ...permMap, [uid]: next });
  }

  const permCampos = [
    ["ver_propostas", "Propostas"], ["baixar_propostas", "Baixar propostas"],
    ["ver_servicos", "Serviços"], ["ver_os", "OS"],
    ["ver_documentos", "Documentos"], ["baixar_documentos", "Baixar docs"],
    ["enviar_documentos", "Enviar docs"], ["responder_pendencias", "Pendências"],
    ["ver_financeiro", "Financeiro"], ["abrir_comunicacao", "Comunicação"],
  ] as const;

  return (
    <div>
      <PageHeader title="Portal do Cliente" subtitle="Configure acessos e visibilidade por cliente" />
      <div className="p-6 space-y-4">
        <Card><CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1 min-w-[300px]">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.razao_social || c.nome_fantasia}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
        </CardContent></Card>

        {config && (
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Portal ativo para este cliente</div>
                <div className="text-xs text-muted-foreground">Controla se o cliente consegue acessar o portal.</div>
              </div>
              <Switch checked={!!config.portal_ativo} onCheckedChange={v => saveConfig({ portal_ativo: v })} />
            </div>
            <div className="grid md:grid-cols-3 gap-2 pt-2 border-t">
              {[
                ["mostrar_propostas", "Propostas"], ["mostrar_servicos", "Serviços"],
                ["mostrar_os", "OS"], ["mostrar_documentos", "Documentos"],
                ["mostrar_pendencias", "Pendências"], ["mostrar_comunicacoes", "Comunicações"],
                ["mostrar_financeiro", "Financeiro"],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                  <span>{l}</span>
                  <Switch checked={!!config[k]} onCheckedChange={v => saveConfig({ [k]: v })} />
                </label>
              ))}
            </div>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Usuários do cliente</div>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo usuário</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo usuário do cliente</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <div><Label>Nome</Label><Input value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} /></div>
                  <div><Label>E-mail</Label><Input type="email" value={novo.email} onChange={e => setNovo({ ...novo, email: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Cargo</Label><Input value={novo.cargo} onChange={e => setNovo({ ...novo, cargo: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={novo.telefone} onChange={e => setNovo({ ...novo, telefone: e.target.value })} /></div>
                  </div>
                  <div><Label>WhatsApp</Label><Input value={novo.whatsapp} onChange={e => setNovo({ ...novo, whatsapp: e.target.value })} /></div>
                  <div><Label>Perfil</Label>
                    <Select value={novo.perfil} onValueChange={v => setNovo({ ...novo, perfil: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(CLIENTE_PERFIL_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end pt-2"><Button onClick={criarUsuario}>Criar</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {usuarios.length === 0 && <div className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>}
          <div className="space-y-3">
            {usuarios.map(u => (
              <div key={u.id} className="border rounded-md p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{u.nome} <span className="text-xs text-muted-foreground">({u.email})</span></div>
                    <div className="text-xs text-muted-foreground">{CLIENTE_PERFIL_LABEL[u.perfil]} • {u.cargo || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.status === "ativo" ? "default" : "outline"}>{CLIENTE_STATUS_LABEL[u.status]}</Badge>
                    {u.status !== "bloqueado" ? (
                      <Button size="sm" variant="outline" onClick={() => setStatusUsuario(u.id, "bloqueado")}><Lock className="h-3 w-3 mr-1" />Bloquear</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setStatusUsuario(u.id, "ativo")}><Unlock className="h-3 w-3 mr-1" />Ativar</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setStatusUsuario(u.id, "convite_pendente")}><RotateCcw className="h-3 w-3 mr-1" />Resetar convite</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-1 pt-2 border-t">
                  {permCampos.map(([k, l]) => (
                    <label key={k} className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1">
                      <span>{l}</span>
                      <Switch checked={!!permMap[u.id]?.[k]} onCheckedChange={v => setPerm(u.id, k, v)} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}