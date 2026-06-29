import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Combobox de categorias de serviço. Lê de public.service_categories e permite
 * criar uma nova categoria on-the-fly (auto-cadastro). A nova categoria é
 * persistida para reutilização em futuras propostas/serviços.
 */
export default function CategoryCombobox({ value, onChange, placeholder = "Selecionar categoria…", className }: Props) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<{ id: string; nome: string }[]>([]);
  const [query, setQuery] = useState("");

  async function load() {
    const { data } = await supabase.from("service_categories").select("id,nome").order("nome");
    setList(data || []);
  }
  useEffect(() => { load(); }, []);

  const exactMatch = useMemo(
    () => list.find((c) => c.nome.trim().toLowerCase() === query.trim().toLowerCase()),
    [list, query]
  );

  async function create(nome: string) {
    const clean = nome.trim();
    if (!clean) return;
    if (exactMatch) { onChange(exactMatch.nome); setOpen(false); return; }
    const { data, error } = await supabase
      .from("service_categories")
      .insert({ nome: clean })
      .select("nome")
      .single();
    if (error) {
      // pode já existir por concorrência — recarrega e tenta usar
      await load();
      const found = (list.find((c) => c.nome.trim().toLowerCase() === clean.toLowerCase()))?.nome;
      if (found) { onChange(found); setOpen(false); return; }
      toast.error(error.message);
      return;
    }
    toast.success("Categoria adicionada");
    onChange(data.nome);
    setQuery("");
    setOpen(false);
    load();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Buscar ou criar…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => create(query)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <Plus className="h-4 w-4" /> Criar “{query.trim()}”
                </button>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma categoria cadastrada.</div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {list.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.nome}
                  onSelect={() => { onChange(c.nome); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.nome ? "opacity-100" : "opacity-0")} />
                  {c.nome}
                </CommandItem>
              ))}
              {query.trim() && !exactMatch && (
                <CommandItem value={`__create__${query}`} onSelect={() => create(query)}>
                  <Plus className="mr-2 h-4 w-4" /> Criar “{query.trim()}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}