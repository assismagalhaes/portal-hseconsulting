import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export type Premissa = {
  id?: string;
  titulo: string;
  texto: string;
  categorias: string[];
  sempre_aplicavel: boolean;
  ativa: boolean;
  ordem: number;
};

const empty: Premissa = { titulo: "", texto: "", categorias: [], sempre_aplicavel: false, ativa: true, ordem: 0 };

export default function PremissasProposta() {
  const { isInternal } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Premissa>(empty);

  useEffect(() => { document.title = "Premissas e Condições | Portal HSE Consulting"; load(); }, []);

  async function load() {
    const [{ data: pr }, { data: c }] = await Promise.all([
      supabase.from("proposta_premissas").select("*").order("ordem").order("titulo"),
      supabase.from("service_categories").select("id,nome").order("nome"),
    ]);
    setRows(pr || []);
    setCats(c || []);
  }

  function novo() { setForm({ ...empty, ordem: (rows.at(-1)?.ordem ?? 0) + 1 }); setOpen(true); }
  function editar(r: any) {
    setForm({
      id: r.id, titulo: r.titulo, texto: r.texto, categorias: r.categorias || [],
      sempre_aplicavel: r.sempre_aplicavel, ativa: r.ativa, ordem: r.ordem,
    });
    setOpen(true);
  }

  async function salvar() {
    if (!form.titulo.trim() || !form.texto.trim()) return toast.error("Informe título e texto");
    const payload = { ...form, titulo: form.titulo.trim(), texto: form.texto.trim() };
    const { error } = form.id
      ? await supabase.from("proposta_premissas").update(payload).eq("id", form.id)
      : await supabase.from("proposta_premissas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Cláusula salva");
    setOpen(false); load();
  }

  async function toggleAtiva(r: any) {
    const { error } = await supabase.from("proposta_premissas").update({ ativa: !r.ativa }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remover(r: any) {
    if (!confirm(`Excluir a cláusula "${r.titulo}"?`)) return;
    const { error } = await supabase.from("proposta_premissas").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Cláusula excluída"); load();
  }

  function toggleCat(nome: string) {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(nome) ? f.categorias.filter((x) => x !== nome) : [...f.categorias, nome],
    }));
  }

  return (
    <div>
      <PageHeader
        title="Premissas e Condições do Serviço"
        subtitle="Cláusulas reutilizáveis que aparecem nas propostas comerciais"
        actions={isInternal ? <Button size="sm" onClick={novo}><Plus className="h-4 w-4 mr-1" />Nova cláusula</Button> : undefined}
      />
      <div className="p-6 space-y-4">
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Título</th>
                <th className="text-left px-4 py-2">Aplicação</th>
                <th className="text-left px-4 py-2">Categorias</th>
                <th className="text-left px-4 py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.titulo}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{r.texto}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.sempre_aplicavel
                      ? <Badge variant="secondary" className="text-[10px]">Sempre aplicável</Badge>
                      : <span className="text-xs text-muted-foreground">Por categoria</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.categorias || []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {(r.categorias || []).map((c: string) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.ativa ? "default" : "secondary"} className="text-[10px]">{r.ativa ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {isInternal && <>
                      <Button size="icon" variant="ghost" title="Editar" aria-label="Editar" onClick={() => editar(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" title={r.ativa ? "Inativar" : "Ativar"} aria-label={r.ativa ? "Inativar" : "Ativar"} onClick={() => toggleAtiva(r)}>
                        <Switch checked={r.ativa} className="pointer-events-none" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" aria-label="Excluir" onClick={() => remover(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma cláusula cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar cláusula" : "Nova cláusula"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Equipamentos calibrados" />
            </div>
            <div className="space-y-1.5"><Label>Texto que aparece na proposta *</Label>
              <Textarea rows={3} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: v })} /> Ativa
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.sempre_aplicavel} onCheckedChange={(v) => setForm({ ...form, sempre_aplicavel: v })} /> Sempre aplicável (auto-marcada em toda proposta)
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Categorias que sugerem esta cláusula automaticamente</Label>
              <p className="text-xs text-muted-foreground">Quando a proposta tiver itens em qualquer dessas categorias, a cláusula será pré-marcada.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {cats.map((c) => {
                  const on = form.categorias.includes(c.nome);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleCat(c.nome)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent"}`}>
                      {c.nome}
                    </button>
                  );
                })}
                {cats.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma categoria cadastrada ainda.</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar cláusula</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}