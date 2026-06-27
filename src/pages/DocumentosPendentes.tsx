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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const STATUS = [
  { value: "solicitado", label: "Solicitado", color: "bg-blue-500/15 text-blue-700" },
  { value: "recebido", label: "Recebido", color: "bg-emerald-500/15 text-emerald-700" },
  { value: "parcial", label: "Parcial", color: "bg-amber-500/15 text-amber-700" },
  { value: "pendente", label: "Pendente", color: "bg-red-500/15 text-red-700" },
  { value: "dispensado", label: "Dispensado", color: "bg-muted text-muted-foreground" },
];

export default function DocumentosPendentes() {
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [execs, setExecs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<any>({ status: "solicitado" });

  const load = async () => {
    const [r, c, e] = await Promise.all([
      supabase.from("documentos_pendentes").select("*, clients(razao_social, nome_fantasia)").order("data_solicitacao", { ascending: false }),
      supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
      supabase.from("execucao_servicos").select("id, titulo").order("created_at", { ascending: false }),
    ]);
    setItems(r.data || []); setClientes(c.data || []); setExecs(e.data || []);
  };
  useEffect(() => { load(); }, []);

  const salvar = async () => {
    if (!novo.documento_solicitado?.trim()) return toast.error("Informe o documento");
    const { error } = await supabase.from("documentos_pendentes").insert({
      documento_solicitado: novo.documento_solicitado,
      client_id: novo.client_id || null, execucao_id: novo.execucao_id || null,
      responsavel_envio: novo.responsavel_envio || null, prazo: novo.prazo || null,
      status: novo.status || "solicitado", observacao: novo.observacao || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pendência registrada"); setOpen(false); setNovo({ status: "solicitado" }); load();
  };

  const atualizarStatus = async (p: any, s: string) => {
    await supabase.from("documentos_pendentes").update({ status: s }).eq("id", p.id);
    load();
  };

  const remover = async (p: any) => {
    if (!confirm("Remover?")) return;
    await supabase.from("documentos_pendentes").delete().eq("id", p.id);
    load();
  };

  return (
    <>
      <PageHeader title="Documentos Pendentes"
        actions={
          <>
            <Button asChild variant="ghost" size="sm"><Link to="/documentos"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova pendência</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova pendência</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>Documento solicitado</Label><Input value={novo.documento_solicitado || ""} onChange={(e) => setNovo({ ...novo, documento_solicitado: e.target.value })} /></div>
                  <div><Label>Cliente</Label>
                    <Select value={novo.client_id || ""} onValueChange={(v) => setNovo({ ...novo, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Execução</Label>
                    <Select value={novo.execucao_id || ""} onValueChange={(v) => setNovo({ ...novo, execucao_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{execs.map((x) => <SelectItem key={x.id} value={x.id}>{x.titulo}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Responsável pelo envio</Label><Input value={novo.responsavel_envio || ""} onChange={(e) => setNovo({ ...novo, responsavel_envio: e.target.value })} /></div>
                  <div><Label>Prazo</Label><Input type="date" value={novo.prazo || ""} onChange={(e) => setNovo({ ...novo, prazo: e.target.value })} /></div>
                  <div><Label>Observação</Label><Textarea value={novo.observacao || ""} onChange={(e) => setNovo({ ...novo, observacao: e.target.value })} /></div>
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
              <TableHead>Documento</TableHead><TableHead>Cliente</TableHead><TableHead>Responsável</TableHead>
              <TableHead>Prazo</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma pendência.</TableCell></TableRow>}
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.documento_solicitado}</TableCell>
                  <TableCell>{p.clients?.nome_fantasia || p.clients?.razao_social || "—"}</TableCell>
                  <TableCell>{p.responsavel_envio || "—"}</TableCell>
                  <TableCell>{p.prazo ? new Date(p.prazo).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Select value={p.status} onValueChange={(v) => atualizarStatus(p, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remover(p)}><Trash2 className="h-4 w-4" /></Button>
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