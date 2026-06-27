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
import { ArrowLeft, Plus, Trash2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const STATUS = [
  { value: "recebido", label: "Recebido", color: "bg-emerald-500/15 text-emerald-700" },
  { value: "parcial", label: "Parcial", color: "bg-amber-500/15 text-amber-700" },
  { value: "pendente", label: "Pendente", color: "bg-red-500/15 text-red-700" },
  { value: "dispensado", label: "Dispensado", color: "bg-muted text-muted-foreground" },
];

export default function DocumentosRecebidos() {
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [execs, setExecs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<any>({ status: "recebido" });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const [r, c, e] = await Promise.all([
      supabase.from("documentos_recebidos").select("*, clients(razao_social, nome_fantasia)").order("data_recebimento", { ascending: false }),
      supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
      supabase.from("execucao_servicos").select("id, titulo").order("created_at", { ascending: false }),
    ]);
    setItems(r.data || []); setClientes(c.data || []); setExecs(e.data || []);
  };
  useEffect(() => { load(); }, []);

  const salvar = async () => {
    if (!novo.nome?.trim()) return toast.error("Informe o nome");
    let arquivo_path: string | null = null;
    if (file) {
      const path = `recebidos/${Date.now()}_${file.name}`;
      const up = await supabase.storage.from("documentos-tecnicos").upload(path, file);
      if (up.error) return toast.error(up.error.message);
      arquivo_path = path;
    }
    const { error } = await supabase.from("documentos_recebidos").insert({
      nome: novo.nome, client_id: novo.client_id || null, execucao_id: novo.execucao_id || null,
      status: novo.status || "recebido", observacoes: novo.observacoes || null, arquivo_path,
    });
    if (error) return toast.error(error.message);
    toast.success("Registrado"); setOpen(false); setNovo({ status: "recebido" }); setFile(null); load();
  };

  const baixar = async (a: any) => {
    if (!a.arquivo_path) return;
    const { data } = await supabase.storage.from("documentos-tecnicos").createSignedUrl(a.arquivo_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remover = async (a: any) => {
    if (!confirm("Remover?")) return;
    if (a.arquivo_path) await supabase.storage.from("documentos-tecnicos").remove([a.arquivo_path]);
    await supabase.from("documentos_recebidos").delete().eq("id", a.id);
    load();
  };

  return (
    <>
      <PageHeader title="Documentos Recebidos do Cliente"
        actions={
          <>
            <Button asChild variant="ghost" size="sm"><Link to="/documentos"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Registrar recebimento</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo recebimento</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>Nome do documento</Label><Input value={novo.nome || ""} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: PCMSO anterior, Inventário de riscos..." /></div>
                  <div><Label>Cliente</Label>
                    <Select value={novo.client_id || ""} onValueChange={(v) => setNovo({ ...novo, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Execução vinculada</Label>
                    <Select value={novo.execucao_id || ""} onValueChange={(v) => setNovo({ ...novo, execucao_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{execs.map((x) => <SelectItem key={x.id} value={x.id}>{x.titulo}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={novo.status} onValueChange={(v) => setNovo({ ...novo, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Observações</Label><Textarea value={novo.observacoes || ""} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} /></div>
                  <div><Label>Arquivo</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
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
              <TableHead>Documento</TableHead><TableHead>Cliente</TableHead><TableHead>Recebido em</TableHead>
              <TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nada registrado.</TableCell></TableRow>}
              {items.map((a) => {
                const s = STATUS.find((x) => x.value === a.status);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell>{a.clients?.nome_fantasia || a.clients?.razao_social || "—"}</TableCell>
                    <TableCell>{new Date(a.data_recebimento).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{s && <Badge variant="outline" className={s.color}>{s.label}</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {a.arquivo_path && <Button size="sm" variant="ghost" onClick={() => baixar(a)}><Download className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost" onClick={() => remover(a)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </>
  );
}