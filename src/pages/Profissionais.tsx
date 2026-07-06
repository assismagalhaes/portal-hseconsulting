import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { profissionalSituacaoLabel } from "@/lib/format";

type Prof = {
  id: string;
  nome: string;
  cargo: string | null;
  area: string | null;
  especialidade: string | null;
  registro_profissional: string | null;
  email: string | null;
  telefone: string | null;
  situacao: "ativo" | "inativo" | "ferias" | "afastado";
  observacoes: string | null;
  auth_user_id: string | null;
};

const empty: Partial<Prof> = { situacao: "ativo" };

export default function Profissionais() {
  const [items, setItems] = useState<Prof[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Prof>>(empty);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string | null; email: string | null }[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("execucao_profissionais")
      .select("*")
      .order("nome");
    if (error) toast.error(error.message);
    else setItems((data || []) as Prof[]);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("id, nome, email").order("nome");
      setUsuarios((data as any) || []);
    })();
  }, []);

  const save = async () => {
    if (!editing.nome?.trim()) return toast.error("Informe o nome");
    const payload: any = {
      nome: editing.nome,
      cargo: editing.cargo || null,
      area: editing.area || null,
      especialidade: editing.especialidade || null,
      registro_profissional: editing.registro_profissional || null,
      email: editing.email || null,
      telefone: editing.telefone || null,
      situacao: editing.situacao || "ativo",
      observacoes: editing.observacoes || null,
      auth_user_id: editing.auth_user_id || null,
    };
    const { error } = editing.id
      ? await supabase.from("execucao_profissionais").update(payload).eq("id", editing.id)
      : await supabase.from("execucao_profissionais").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Profissional salvo");
    setOpen(false); setEditing(empty); load();
  };

  const filtered = items.filter(p =>
    !q || [p.nome, p.cargo, p.area, p.especialidade, p.email].some(s => (s || "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <>
      <PageHeader
        title="Profissionais"
        subtitle="Cadastro de responsáveis técnicos e equipe de apoio"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(empty); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(empty)}><Plus className="h-4 w-4 mr-2" /> Novo profissional</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing.id ? "Editar profissional" : "Novo profissional"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nome *</Label><Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
                <div><Label>Cargo</Label><Input value={editing.cargo || ""} onChange={(e) => setEditing({ ...editing, cargo: e.target.value })} /></div>
                <div><Label>Área</Label><Input value={editing.area || ""} onChange={(e) => setEditing({ ...editing, area: e.target.value })} /></div>
                <div><Label>Especialidade</Label><Input value={editing.especialidade || ""} onChange={(e) => setEditing({ ...editing, especialidade: e.target.value })} /></div>
                <div><Label>Registro Profissional</Label><Input value={editing.registro_profissional || ""} onChange={(e) => setEditing({ ...editing, registro_profissional: e.target.value })} /></div>
                <div><Label>E-mail</Label><Input type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={editing.telefone || ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} /></div>
                <div>
                  <Label>Situação</Label>
                  <Select value={editing.situacao || "ativo"} onValueChange={(v: any) => setEditing({ ...editing, situacao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(profissionalSituacaoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Observações</Label><Textarea value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>Usuário do sistema (login)</Label>
                  <Select
                    value={editing.auth_user_id || "__none__"}
                    onValueChange={(v) => setEditing({ ...editing, auth_user_id: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Não vinculado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem login vinculado</SelectItem>
                      {usuarios.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome || u.email || u.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Vincula o profissional a um usuário. Técnicos vêem no portal apenas os projetos em que estão alocados via esse vínculo.
                  </p>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
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
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.cargo || "—"}</TableCell>
                  <TableCell>{p.area || "—"}</TableCell>
                  <TableCell>{p.especialidade || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{profissionalSituacaoLabel[p.situacao]}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum profissional cadastrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}