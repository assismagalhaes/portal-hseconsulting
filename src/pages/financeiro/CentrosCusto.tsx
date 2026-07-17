import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CentrosCusto() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ codigo: "", nome: "", descricao: "" });
  const load = async () => { const { data } = await supabase.from("financeiro_centros_custo").select("*").order("nome"); setRows(data||[]); };
  useEffect(() => { document.title = "Centros de Custo"; load(); }, []);

  const salvar = async () => {
    if (!form.nome) return toast.error("Informe o nome");
    const { error } = await supabase.from("financeiro_centros_custo").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Centro de custo criado"); setOpen(false); setForm({ codigo: "", nome: "", descricao: "" }); load();
  };
  const remover = async (id: string) => { if (!confirm("Excluir?")) return; await supabase.from("financeiro_centros_custo").delete().eq("id", id); load(); };

  return (
    <div>
      <PageHeader title="Centros de Custo" subtitle="Categorias para rateio de despesas"
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo centro de custo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Código</Label><Input value={form.codigo} onChange={e=>setForm({...form, codigo: e.target.value})}/></div>
                <div><Label>Nome *</Label><Input value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})}/></div>
              </div>
              <div><Label>Descrição</Label><Input value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})}/></div>
            </div>
            <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>} />
      <div className="p-6">
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="text-left px-4 py-2">Código</th><th className="text-left px-4 py-2">Nome</th><th className="text-left px-4 py-2">Descrição</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t"><td className="px-4 py-2 font-mono">{r.codigo||"—"}</td><td className="px-4 py-2 font-medium">{r.nome}</td><td className="px-4 py-2 text-muted-foreground">{r.descricao||"—"}</td><td className="px-4 py-2 text-right"><Button size="icon" variant="ghost" aria-label="Remover" onClick={()=>remover(r.id)}><Trash2 className="h-3 w-3"/></Button></td></tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum centro de custo cadastrado.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}