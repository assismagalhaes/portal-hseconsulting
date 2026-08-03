import { useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChecklistCard({ osId, items, onChange }: any) {
  const [desc, setDesc] = useState("");
  const [obrig, setObrig] = useState(true);
  const [presets, setPresets] = useState<string[]>([]);
  const [newPresetOpen, setNewPresetOpen] = useState(false);
  const [newPreset, setNewPreset] = useState("");
  const [presetOpen, setPresetOpen] = useState(false);
  const obrigId = useId();
  const loadPresets = async () => {
    const { data } = await supabase
      .from("os_checklist_sugestoes" as any)
      .select("descricao")
      .eq("ativo", true)
      .order("descricao");
    setPresets(((data as any[]) || []).map((r) => r.descricao));
  };
  useEffect(() => { loadPresets(); }, []);
  const savePreset = async () => {
    const d = newPreset.trim();
    if (!d) return;
    const { error } = await supabase.from("os_checklist_sugestoes" as any).insert({ descricao: d });
    if (error) return toast.error(error.message);
    toast.success("Item sugerido cadastrado");
    setNewPreset(""); setNewPresetOpen(false); await loadPresets();
  };
  const add = async () => {
    if (!desc) return;
    const ord = (items[items.length - 1]?.ordem || 0) + 1;
    const { error } = await supabase.from("os_checklist").insert({ os_id: osId, descricao: desc, obrigatorio: obrig, ordem: ord });
    if (error) return toast.error(error.message);
    setDesc(""); onChange();
  };
  const addPreset = async (descricao: string) => {
    if (items.some((i: any) => (i.descricao || "").trim().toLowerCase() === descricao.trim().toLowerCase())) {
      return toast.info("Item já adicionado");
    }
    const ord = (items[items.length - 1]?.ordem || 0) + 1;
    const { error } = await supabase.from("os_checklist").insert({ os_id: osId, descricao, obrigatorio: true, ordem: ord });
    if (error) return toast.error(error.message);
    toast.success("Item adicionado"); onChange();
  };
  const addAllPresets = async () => {
    const existing = new Set(items.map((i: any) => (i.descricao || "").trim().toLowerCase()));
    const toInsert = presets.filter(p => !existing.has(p.toLowerCase()));
    if (!toInsert.length) return toast.info("Todos os itens sugeridos já estão no checklist");
    let ord = (items[items.length - 1]?.ordem || 0);
    const rows = toInsert.map(descricao => ({ os_id: osId, descricao, obrigatorio: true, ordem: ++ord }));
    const { error } = await supabase.from("os_checklist").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} itens adicionados`); onChange();
  };
  const toggle = async (it: any) => {
    await supabase.from("os_checklist").update({ concluido: !it.concluido, concluido_em: !it.concluido ? new Date().toISOString() : null }).eq("id", it.id);
    onChange();
  };
  const del = async (id: string) => { await supabase.from("os_checklist").delete().eq("id", id); onChange(); };
  const total = items.length, done = items.filter((i: any) => i.concluido).length;
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between"><div className="text-sm font-semibold">Checklist obrigatório</div><div className="text-sm text-muted-foreground">{done}/{total}</div></div>
      <Progress value={total ? (done / total) * 100 : 0} />
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2">
        <span className="text-xs text-muted-foreground">Itens sugeridos:</span>
        <Popover open={presetOpen} onOpenChange={setPresetOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={presetOpen}
              className={cn("h-9 w-[280px] justify-between font-normal text-muted-foreground")}
            >
              <span className="truncate">Adicionar item sugerido…</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[320px]" align="start">
            <Command>
              <CommandInput placeholder="Buscar item…" />
              <CommandList>
                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                <CommandGroup>
                  {presets.map((p) => (
                    <CommandItem key={p} value={p} onSelect={() => { addPreset(p); setPresetOpen(false); }}>
                      {p}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button type="button" size="sm" variant="secondary" onClick={addAllPresets}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar todos
        </Button>
        <Dialog open={newPresetOpen} onOpenChange={setNewPresetOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar novo item sugerido
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo item sugerido</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={newPreset} onChange={(e) => setNewPreset(e.target.value)} placeholder="Ex.: Envio do relatório final" autoFocus />
              <p className="text-xs text-muted-foreground">O item ficará disponível na lista de sugestões para todas as OS.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewPresetOpen(false)}>Cancelar</Button>
              <Button onClick={savePreset}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-2">
        <Input placeholder="Item do checklist" value={desc} onChange={e => setDesc(e.target.value)} />
        <label htmlFor={obrigId} className="flex items-center gap-2 text-xs">
          <input id={obrigId} type="checkbox" checked={obrig} onChange={e => setObrig(e.target.checked)} />
          Obrigatório
        </label>
        <Button onClick={add} aria-label="Adicionar item"><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1">
        {items.map((it: any) => (
          <div key={it.id} className={`flex items-center gap-2 px-3 py-2 rounded ${it.concluido ? "bg-primary/5" : "bg-muted/30"}`}>
            <input
              id={`chk-${it.id}`}
              type="checkbox"
              checked={it.concluido}
              onChange={() => toggle(it)}
              aria-label={`Marcar item "${it.descricao}" como ${it.concluido ? "pendente" : "concluído"}`}
            />
            <label htmlFor={`chk-${it.id}`} className={`flex-1 text-sm cursor-pointer ${it.concluido ? "line-through text-muted-foreground" : ""}`}>{it.descricao}</label>
            {it.obrigatorio && <Badge variant="secondary" className="text-xs">Obrig.</Badge>}
            <Button size="sm" variant="ghost" onClick={() => del(it.id)} aria-label="Excluir item"><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
        {!items.length && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
      </div>
    </CardContent></Card>
  );
}