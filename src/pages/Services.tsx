import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calculator } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import CategoryCombobox from "@/components/CategoryCombobox";
import PricingPanel from "@/components/proposal/PricingPanel";

const empty = {
  nome: "", categoria: "", descricao_comercial: "", escopo_tecnico: "", valor_referencia: 0,
  pricing_custos: [] as any[], pricing_horas: [] as any[],
  pricing_aliquota_imposto: null as number | null,
  pricing_margem_desejada: null as number | null,
  pricing_lucro_desejado: 0, pricing_desconto_comercial: 0,
  pricing_preco_sugerido: null as number | null,
  pricing_preco_arredondado: null as number | null,
  pricing_indicadores: {} as any,
  pricing_configurada: false,
};

export default function Services() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [params, setParams] = useState<any>(null);

  useEffect(() => { document.title = "Serviços | Portal HSE Consulting"; load(); loadParams(); }, []);
  async function load() {
    const { data } = await supabase.from("services").select("*").order("nome");
    setList(data || []);
  }
  async function loadParams() {
    const { data } = await supabase.from("pricing_params").select("*").limit(1).maybeSingle();
    setParams(data || {});
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(s:any) { setEditing(s); setForm({ ...empty, ...s }); setOpen(true); }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const payload = { ...form, valor_referencia: Number(form.valor_referencia) || 0 };
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Serviço atualizado" : "Serviço criado");
    setOpen(false); load();
  }

  function applyPricing(draft: any, computed: any) {
    setForm((f: any) => ({
      ...f,
      pricing_custos: draft.custos,
      pricing_horas: draft.horas,
      pricing_aliquota_imposto: draft.aliquota_imposto,
      pricing_margem_desejada: draft.margem_desejada,
      pricing_lucro_desejado: draft.lucro_desejado,
      pricing_desconto_comercial: draft.desconto_comercial,
      pricing_preco_sugerido: computed.preco_sugerido,
      pricing_preco_arredondado: computed.preco_arredondado,
      pricing_indicadores: computed,
      pricing_configurada: true,
      valor_referencia: computed.preco_arredondado || f.valor_referencia,
    }));
    toast.success("Precificação aplicada. Salve o serviço para persistir.");
  }

  const filtered = list.filter(s => !q || s.nome.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Catálogo de Serviços" subtitle="Templates reutilizáveis para montar propostas mais rápido"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo serviço</Button></DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
              <Tabs defaultValue="geral" className="mt-2">
                <TabsList>
                  <TabsTrigger value="geral">Dados gerais</TabsTrigger>
                  <TabsTrigger value="pricing">
                    <Calculator className="h-4 w-4 mr-1" /> Precificação
                    {form.pricing_configurada && <Badge className="ml-2" variant="secondary">Configurada</Badge>}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="geral">
                  <form onSubmit={save} className="space-y-3">
                    <div className="space-y-1.5"><Label>Nome *</Label>
                      <Input required value={form.nome} onChange={e=>setForm({...form, nome:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Categoria</Label>
                      <CategoryCombobox value={form.categoria||""} onChange={(v)=>setForm({...form, categoria:v})} /></div>
                    <div className="space-y-1.5"><Label>Valor de referência</Label>
                      <Input type="number" step="0.01" value={form.valor_referencia} onChange={e=>setForm({...form, valor_referencia:e.target.value})} />
                      {form.pricing_configurada && (
                        <p className="text-xs text-muted-foreground">
                          Este valor é atualizado automaticamente pela precificação. Preço comercial calculado: <span className="font-mono">{brl(form.pricing_preco_arredondado)}</span>.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5"><Label>Descrição comercial (vai para o cliente)</Label>
                      <Textarea rows={3} value={form.descricao_comercial||""} onChange={e=>setForm({...form, descricao_comercial:e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Escopo técnico (uso interno)</Label>
                      <Textarea rows={4} value={form.escopo_tecnico||""} onChange={e=>setForm({...form, escopo_tecnico:e.target.value})} /></div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
                      <Button type="submit">Salvar</Button>
                    </div>
                  </form>
                </TabsContent>
                <TabsContent value="pricing" className="pt-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Defina custos diretos, horas técnicas e formação de preço padrão. Quando este serviço for adicionado a uma proposta, esses valores serão puxados automaticamente como precificação inicial do item.
                  </p>
                  {params ? (
                    <PricingPanel
                      params={params}
                      existing={form.pricing_configurada ? {
                        custos: form.pricing_custos,
                        horas: form.pricing_horas,
                        aliquota_imposto: form.pricing_aliquota_imposto,
                        margem_desejada: form.pricing_margem_desejada,
                        lucro_desejado: form.pricing_lucro_desejado,
                        desconto_comercial: form.pricing_desconto_comercial,
                      } : null}
                      saveLabel="Aplicar precificação ao serviço"
                      onSave={applyPricing}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Carregando parâmetros de precificação…</p>
                  )}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Fechar</Button>
                    <Button type="button" onClick={()=>save()}>Salvar serviço</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        } />
      <div className="p-6 space-y-4">
        <Input placeholder="Buscar serviço…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-md" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <Card key={s.id} className="p-4 shadow-elegant hover:shadow-glow transition-shadow cursor-pointer" onClick={()=>openEdit(s)}>
              <h3 className="font-display font-semibold">{s.nome}</h3>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{s.descricao_comercial || "Sem descrição comercial."}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="text-sm font-mono text-primary">{brl(s.valor_referencia)}</div>
                {s.pricing_configurada && <Badge variant="secondary" className="text-[10px]"><Calculator className="h-3 w-3 mr-1" />Precificado</Badge>}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-10">Nenhum serviço cadastrado.</div>}
        </div>
      </div>
    </div>
  );
}