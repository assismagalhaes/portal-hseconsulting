import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ArrowLeft, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TIPOS_DOCUMENTO, tipoLabel } from "@/lib/documentos";

export default function DocumentosModelos() {
  const [items, setItems] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>({ tipo: "PGR", ativo: true });

  const load = async () => {
    const [m, p] = await Promise.all([
      supabase.from("documentos_modelos").select("*").order("nome"),
      supabase.from("execucao_profissionais").select("id, nome").order("nome"),
    ]);
    setItems(m.data || []); setProfs(p.data || []);
  };
  useEffect(() => { load(); }, []);

  const salvar = async () => {
    if (!editing.nome?.trim()) return toast.error("Informe o nome");
    const payload: any = {
      nome: editing.nome, tipo: editing.tipo, categoria: editing.categoria || null,
      descricao: editing.descricao || null, texto_padrao: editing.texto_padrao || null,
      responsavel_padrao_id: editing.responsavel_padrao_id || null,
      validade_padrao_dias: editing.validade_padrao_dias ? Number(editing.validade_padrao_dias) : null,
      ativo: editing.ativo !== false,
      secoes_json: editing.secoes_json || [],
      campos_variaveis_json: editing.campos_variaveis_json || [],
    };
    const { error } = editing.id
      ? await supabase.from("documentos_modelos").update(payload).eq("id", editing.id)
      : await supabase.from("documentos_modelos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Modelo salvo"); setOpen(false); setEditing({ tipo: "PGR", ativo: true }); load();
  };

  const duplicar = async (m: any) => {
    const { id, created_at, updated_at, created_by, ...rest } = m;
    await supabase.from("documentos_modelos").insert({ ...rest, nome: m.nome + " (cópia)" });
    load();
  };

  const remover = async (m: any) => {
    if (!confirm("Remover modelo?")) return;
    await supabase.from("documentos_modelos").delete().eq("id", m.id);
    load();
  };

  return (
    <>
      <PageHeader title="Modelos Técnicos" subtitle="Modelos padrão por tipo de documento"
        actions={
          <>
            <Button asChild variant="ghost" size="sm"><Link to="/documentos"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" onClick={() => setEditing({ tipo: "PGR", ativo: true })}><Plus className="h-4 w-4 mr-1" />Novo modelo</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editing.id ? "Editar modelo" : "Novo modelo"}</DialogTitle></DialogHeader>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2"><Label>Nome</Label><Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
                  <div><Label>Tipo</Label>
                    <Select value={editing.tipo} onValueChange={(v) => setEditing({ ...editing, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Categoria</Label><Input value={editing.categoria || ""} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })} /></div>
                  <div><Label>Responsável padrão</Label>
                    <Select value={editing.responsavel_padrao_id || ""} onValueChange={(v) => setEditing({ ...editing, responsavel_padrao_id: v || null })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Validade padrão (dias)</Label><Input type="number" value={editing.validade_padrao_dias || ""} onChange={(e) => setEditing({ ...editing, validade_padrao_dias: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={editing.descricao || ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>Texto padrão (HTML)</Label><Textarea rows={6} value={editing.texto_padrao || ""} onChange={(e) => setEditing({ ...editing, texto_padrao: e.target.value })} /></div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <Switch checked={editing.ativo !== false} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                    <Label>Ativo</Label>
                  </div>
                </div>
                <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <div className="p-6">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead>
              <TableHead>Validade</TableHead><TableHead>Ativo</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum modelo cadastrado.</TableCell></TableRow>}
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>{tipoLabel(m.tipo)}</TableCell>
                  <TableCell>{m.categoria || "—"}</TableCell>
                  <TableCell>{m.validade_padrao_dias ? `${m.validade_padrao_dias}d` : "—"}</TableCell>
                  <TableCell>{m.ativo ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicar(m)}><Copy className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remover(m)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </>
  );
}