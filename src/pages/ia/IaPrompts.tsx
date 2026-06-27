import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Prompt = { id: string; nome: string; modulo: string; objetivo: string | null; prompt_base: string; versao: number; ativo: boolean };

export default function IaPrompts() {
  const [items, setItems] = useState<Prompt[]>([]);
  const [editing, setEditing] = useState<Record<string, Prompt>>({});

  async function load() {
    const { data } = await supabase.from("ia_prompts").select("*").order("modulo").order("versao", { ascending: false });
    setItems((data ?? []) as Prompt[]);
  }
  useEffect(() => { load(); }, []);

  function set(id: string, patch: Partial<Prompt>) {
    setEditing((e) => ({ ...e, [id]: { ...(e[id] ?? items.find((i) => i.id === id)!), ...patch } }));
  }

  async function save(id: string) {
    const p = editing[id]; if (!p) return;
    const { error } = await supabase.from("ia_prompts").update({
      nome: p.nome, objetivo: p.objetivo, prompt_base: p.prompt_base, ativo: p.ativo,
    }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Prompt salvo"); load(); }
  }

  async function toggle(id: string, ativo: boolean) {
    await supabase.from("ia_prompts").update({ ativo }).eq("id", id);
    load();
  }

  return (
    <div>
      <PageHeader title="Biblioteca de Prompts" subtitle="Prompts padrão usados pelo copiloto HSE em cada módulo." />
      <div className="p-6 space-y-4">
        {items.map((p) => {
          const e = editing[p.id] ?? p;
          return (
            <div key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{p.modulo}</Badge>
                    <Badge variant="secondary">v{p.versao}</Badge>
                    <Input value={e.nome} onChange={(ev) => set(p.id, { nome: ev.target.value })} className="font-semibold max-w-md" />
                  </div>
                  <Input value={e.objetivo ?? ""} onChange={(ev) => set(p.id, { objetivo: ev.target.value })} placeholder="Objetivo" className="mt-2 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Ativo</span>
                  <Switch checked={e.ativo} onCheckedChange={(v) => { set(p.id, { ativo: v }); toggle(p.id, v); }} />
                </div>
              </div>
              <Textarea value={e.prompt_base} onChange={(ev) => set(p.id, { prompt_base: ev.target.value })} rows={5} className="font-mono text-xs" />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(p.id)}>Salvar</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}