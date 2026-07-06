import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Search, MoreHorizontal, KeyRound, Send, Ban, Unlock, Trash2, History, ShieldCheck, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import PermissoesDialog from "@/components/usuarios/PermissoesDialog";

type Role = "admin" | "comercial" | "tecnico" | "financeiro";
type Row = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  area: string | null;
  registro_profissional: string | null;
  foto_url: string | null;
  status: string;
  role: Role;
};

const empty: any = { status: "ativo", role: "tecnico" };

const statusLabel: Record<string, string> = { ativo: "Ativo", inativo: "Inativo", bloqueado: "Bloqueado", excluido: "Excluído" };
const statusColor: Record<string, string> = {
  ativo: "bg-success/15 text-success",
  inativo: "bg-muted text-muted-foreground",
  bloqueado: "bg-danger/15 text-danger",
  excluido: "bg-danger/15 text-danger line-through",
};
const roleLabel: Record<Role, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  financeiro: "Financeiro",
  tecnico: "Profissional Técnico",
};

export default function Usuarios() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(empty);
  const [permOpen, setPermOpen] = useState(false);
  const [permUser, setPermUser] = useState<Row | null>(null);
  const [credOpen, setCredOpen] = useState(false);
  const [cred, setCred] = useState<{ email: string; senha: string } | null>(null);

  const load = async () => {
    const { data: profiles, error } = await supabase
      .from("profiles").select("*").neq("status", "excluido").order("nome");
    if (error) return toast.error(error.message);
    const { data: rolesRows } = await supabase.from("user_roles").select("user_id, role");
    const rolesMap = new Map<string, Role>();
    for (const r of rolesRows || []) rolesMap.set((r as any).user_id, (r as any).role);
    setRows((profiles || []).map((p: any) => ({ ...p, role: rolesMap.get(p.id) || "tecnico" })));
  };
  useEffect(() => { document.title = "Usuários | Portal HSE Consulting"; load(); }, []);

  const save = async () => {
    if (!editing.nome?.trim()) return toast.error("Informe o nome");
    if (!editing.email?.trim()) return toast.error("Informe o e-mail");

    if (creating) {
      // criar via edge function
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: editing.email, nome: editing.nome, role: editing.role,
          telefone: editing.telefone, cargo: editing.cargo, area: editing.area,
          registro_profissional: editing.registro_profissional,
        },
      });
      if (error) return toast.error(error.message);
      if ((data as any)?.error) return toast.error((data as any).error);
      const senha = (data as any)?.senha_provisoria;
      if (senha) {
        setCred({ email: (data as any).email, senha });
        setCredOpen(true);
      }
      toast.success("Usuário criado com senha provisória.");
    } else {
      const payload: any = {
        nome: editing.nome, telefone: editing.telefone, cargo: editing.cargo,
        area: editing.area, registro_profissional: editing.registro_profissional,
        status: editing.status,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);

      // Atualiza papel se mudou
      const { data: curRoles } = await supabase.from("user_roles").select("role").eq("user_id", editing.id);
      const cur = (curRoles || []).map((r: any) => r.role);
      if (!cur.includes(editing.role)) {
        await supabase.from("user_roles").delete().eq("user_id", editing.id);
        await supabase.from("user_roles").insert({ user_id: editing.id, role: editing.role });
      }
      toast.success("Usuário atualizado");
    }
    setOpen(false); setEditing(empty); setCreating(false); load();
  };

  const filtered = rows.filter((r) => !q || [r.nome, r.email, r.cargo, r.area].some((s) => (s || "").toLowerCase().includes(q.toLowerCase())));

  async function runAction(action: string, r: Row) {
    const confirmMsg: Record<string, string> = {
      reset_password: `Gerar nova senha provisória para ${r.email}?`,
      resend_invite: `Gerar nova senha provisória e reenviar credenciais para ${r.email}?`,
      block: `Bloquear ${r.nome || r.email}? O usuário não conseguirá mais entrar.`,
      unblock: `Desbloquear ${r.nome || r.email}?`,
      delete: `Excluir DEFINITIVAMENTE ${r.nome || r.email}? Esta ação não pode ser desfeita.`,
    };
    if (!confirm(confirmMsg[action])) return;
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action, user_id: r.id, redirect_to: `${window.location.origin}/auth` },
    });
    if (error) {
      // supabase-js swallows the response body on non-2xx; tenta ler o contexto
      const ctx: any = (error as any).context;
      let msg = error.message;
      try {
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          if (body?.error) msg = body.error;
        }
      } catch { /* ignore */ }
      return toast.error(msg);
    }
    if ((data as any)?.error) return toast.error((data as any).error);
    const senha = (data as any)?.senha_provisoria;
    if (senha) {
      setCred({ email: (data as any).email, senha });
      setCredOpen(true);
    }
    toast.success("Ação executada");
    load();
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Cadastro e permissões de acesso ao Portal HSE Consulting"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/usuarios/logs"><History className="h-4 w-4 mr-2" /> Trilha de acessos</Link>
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(empty); setCreating(false); } }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setCreating(true); setEditing(empty); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{creating ? "Novo usuário" : "Editar usuário"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nome completo *</Label><Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
                <div><Label>E-mail *</Label><Input type="email" disabled={!creating} value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={editing.telefone || ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} /></div>
                <div><Label>Cargo</Label><Input value={editing.cargo || ""} onChange={(e) => setEditing({ ...editing, cargo: e.target.value })} /></div>
                <div><Label>Área</Label><Input value={editing.area || ""} onChange={(e) => setEditing({ ...editing, area: e.target.value })} /></div>
                <div><Label>Registro profissional</Label><Input value={editing.registro_profissional || ""} onChange={(e) => setEditing({ ...editing, registro_profissional: e.target.value })} /></div>
                <div>
                  <Label>Perfil de acesso *</Label>
                  <Select value={editing.role || "tecnico"} onValueChange={(v) => setEditing({ ...editing, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="tecnico">Profissional Técnico</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!creating && (
                  <div>
                    <Label>Status</Label>
                    <Select value={editing.status || "ativo"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={save}>{creating ? "Criar usuário" : "Salvar"}</Button></DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Cargo / Área</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={r.foto_url || undefined} />
                        <AvatarFallback>{(r.nome || r.email || "U")[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.nome || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.cargo || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.area || "—"}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{roleLabel[r.role]}</Badge></TableCell>
                  <TableCell><Badge className={statusColor[r.status] + " border-0"}>{statusLabel[r.status] || r.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setCreating(false); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => runAction("reset_password", r)}>
                            <KeyRound className="h-4 w-4 mr-2" /> Redefinir senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => runAction("resend_invite", r)}>
                            <Send className="h-4 w-4 mr-2" /> Reenviar convite
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setPermUser(r); setPermOpen(true); }}>
                            <ShieldCheck className="h-4 w-4 mr-2" /> Permissões granulares
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {r.status === "bloqueado" ? (
                            <DropdownMenuItem onClick={() => runAction("unblock", r)}>
                              <Unlock className="h-4 w-4 mr-2" /> Desbloquear
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => runAction("block", r)}>
                              <Ban className="h-4 w-4 mr-2" /> Bloquear
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-danger" onClick={() => runAction("delete", r)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
      <PermissoesDialog open={permOpen} onOpenChange={setPermOpen} user={permUser} />
      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Credenciais de acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Envie estas credenciais ao usuário. No primeiro acesso, ele será obrigado a definir uma nova senha pessoal.
              <strong className="text-danger block mt-1">
                Esta senha só é exibida uma vez — copie agora.
              </strong>
            </p>
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <div>
                <div className="text-xs text-muted-foreground">E-mail</div>
                <div className="font-mono text-sm">{cred?.email}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Senha provisória</div>
                <div className="font-mono text-sm break-all">{cred?.senha}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!cred) return;
                navigator.clipboard.writeText(
                  `Acesso Portal HSE Consulting\nURL: ${window.location.origin}/auth\nE-mail: ${cred.email}\nSenha provisória: ${cred.senha}\n\nNo primeiro acesso será solicitado que você defina uma nova senha.`
                );
                toast.success("Credenciais copiadas!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Copiar tudo
            </Button>
            <Button onClick={() => setCredOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}