import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface T {
  id: string; titulo: string; descricao: string | null; status: string; prioridade: string;
  data_prevista: string | null; modulo_origem: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída",
  cancelada: "Cancelada", atrasada: "Atrasada",
};
const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_andamento: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  concluida: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
  atrasada: "bg-red-500/10 text-red-700 dark:text-red-300",
};
type TStatus = "pendente" | "em_andamento" | "concluida" | "cancelada" | "atrasada";
type TPrio = "baixa" | "normal" | "alta" | "critica";

export default function Tarefas() {
  const [list, setList] = useState<T[]>([]);
  const [filtro, setFiltro] = useState("todas");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", prioridade: "normal" as TPrio, data_prevista: "" });

  async function load() {
    const { data } = await supabase.from("tarefas").select("*").order("created_at", { ascending: false });
    setList((data as T[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function criar() {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("tarefas").insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      data_prevista: form.data_prevista || null,
      responsavel_id: user?.id ?? null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setOpen(false);
    setForm({ titulo: "", descricao: "", prioridade: "normal", data_prevista: "" });
    load();
  }

  async function mudarStatus(id: string, status: string) {
    await supabase.from("tarefas").update({ status: status as TStatus }).eq("id", id);
    load();
  }

  const filtered = list.filter((t) => filtro === "todas" || t.status === filtro);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Tarefas"
        subtitle="Tarefas internas vinculadas a clientes e registros"
        actions={(
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova tarefa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                <Textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as TPrio })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} />
                </div>
              </div>
              <DialogFooter><Button onClick={criar}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Select value={filtro} onValueChange={setFiltro}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.titulo}</div>
                    {t.descricao && <div className="text-xs text-muted-foreground line-clamp-1">{t.descricao}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{t.modulo_origem}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{t.prioridade}</Badge></TableCell>
                  <TableCell className="text-xs">{t.data_prevista ? new Date(t.data_prevista).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[t.status] ?? ""}>{STATUS_LABEL[t.status] ?? t.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Select value={t.status} onValueChange={(v) => mudarStatus(t.id, v)}>
                      <SelectTrigger className="w-40 inline-flex"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma tarefa</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}