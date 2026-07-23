import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, Settings2 } from "lucide-react";
import { toast } from "sonner";

type Premissa = {
  id: string;
  titulo: string;
  texto: string;
  categorias: string[];
  sempre_aplicavel: boolean;
  ativa: boolean;
  ordem: number;
};

type Props = {
  selectedIds: string[];
  extraText: string;
  itemCategorias: string[];
  onChange: (patch: { premissas_ids: string[]; outras_condicoes: string | null }) => void;
};

/**
 * Seleção de premissas/cláusulas para uma proposta. Auto-marca as cláusulas
 * "sempre aplicáveis" e as vinculadas às categorias dos itens da proposta.
 * Mantém também um campo livre para ajustes específicos.
 * O resultado é serializado em `outras_condicoes` (bullets) para manter
 * compatibilidade com PDF/aceite público, e `premissas_ids` guarda a seleção.
 */
export default function PremissasPicker({ selectedIds, extraText, itemCategorias, onChange }: Props) {
  const [premissas, setPremissas] = useState<Premissa[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [extra, setExtra] = useState<string>(extraText || "");
  const [openNew, setOpenNew] = useState(false);
  const [novo, setNovo] = useState({ titulo: "", texto: "", sempre_aplicavel: false });
  const [autoApplied, setAutoApplied] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected(new Set(selectedIds)); }, [selectedIds.join("|")]);
  useEffect(() => { setExtra(extraText || ""); }, [extraText]);

  async function load() {
    const { data } = await supabase.from("proposta_premissas").select("*").eq("ativa", true).order("ordem").order("titulo");
    setPremissas((data || []) as Premissa[]);
  }

  // Sugestão automática: quando nenhum id foi salvo ainda, marca as "sempre aplicáveis"
  // e as que combinam com as categorias dos itens.
  useEffect(() => {
    if (autoApplied || premissas.length === 0 || selectedIds.length > 0) return;
    const cats = new Set(itemCategorias.filter(Boolean));
    const auto = new Set<string>();
    for (const p of premissas) {
      if (p.sempre_aplicavel) auto.add(p.id);
      else if (p.categorias?.some((c) => cats.has(c))) auto.add(p.id);
    }
    if (auto.size > 0) {
      setSelected(auto);
      persist(auto, extra);
    }
    setAutoApplied(true);
     
  }, [premissas, itemCategorias.join("|")]);

  const sugeridas = useMemo(() => {
    const cats = new Set(itemCategorias.filter(Boolean));
    return new Set(premissas.filter((p) => p.sempre_aplicavel || p.categorias?.some((c) => cats.has(c))).map((p) => p.id));
  }, [premissas, itemCategorias.join("|")]);

  function buildText(ids: Set<string>, extraTxt: string) {
    const lines = premissas
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.ordem - b.ordem)
      .map((p) => `- ${p.texto}`);
    const bloco = lines.join("\n");
    const complemento = extraTxt.trim() ? `\n\n${extraTxt.trim()}` : "";
    return bloco || complemento ? `${bloco}${complemento}` : null;
  }

  function persist(ids: Set<string>, extraTxt: string) {
    const texto = buildText(ids, extraTxt);
    onChange({ premissas_ids: Array.from(ids), outras_condicoes: texto });
  }

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    persist(next, extra);
  }

  function reaplicarSugestoes() {
    const next = new Set(selected);
    sugeridas.forEach((id) => next.add(id));
    setSelected(next);
    persist(next, extra);
    toast.success("Sugestões aplicadas");
  }

  function limpar() {
    setSelected(new Set());
    persist(new Set(), extra);
  }

  async function criarInline() {
    if (!novo.titulo.trim() || !novo.texto.trim()) return toast.error("Informe título e texto");
    const { data, error } = await supabase
      .from("proposta_premissas")
      .insert({ titulo: novo.titulo.trim(), texto: novo.texto.trim(), sempre_aplicavel: novo.sempre_aplicavel, ativa: true, ordem: (premissas.at(-1)?.ordem ?? 0) + 1 })
      .select("*").single();
    if (error || !data) return toast.error(error?.message || "Erro ao criar");
    const list = [...premissas, data as Premissa];
    setPremissas(list);
    const next = new Set(selected);
    next.add((data as Premissa).id);
    setSelected(next);
    persist(next, extra);
    setNovo({ titulo: "", texto: "", sempre_aplicavel: false });
    setOpenNew(false);
    toast.success("Cláusula criada e selecionada");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-base">Premissas e Condições do Serviço</Label>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={reaplicarSugestoes}>
            <Sparkles className="h-3.5 w-3.5 mr-1" />Aplicar sugestões
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpenNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Nova cláusula
          </Button>
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link to="/configuracoes/premissas" target="_blank"><Settings2 className="h-3.5 w-3.5 mr-1" />Gerenciar</Link>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Marque as cláusulas que se aplicam a esta proposta. Sugestões automáticas com base nas categorias dos itens.
      </p>

      <div className="rounded-md border divide-y">
        {premissas.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Nenhuma cláusula cadastrada. Crie a primeira acima.</div>
        )}
        {premissas.map((p) => {
          const on = selected.has(p.id);
          const isSugerida = sugeridas.has(p.id);
          return (
            <label key={p.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/40 transition">
              <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{p.titulo}</span>
                  {p.sempre_aplicavel && <Badge variant="secondary" className="text-[10px]">Sempre aplicável</Badge>}
                  {!p.sempre_aplicavel && isSugerida && <Badge variant="outline" className="text-[10px]">Sugerida</Badge>}
                  {p.categorias?.map((c) => <Badge key={c} variant="outline" className="text-[10px] font-normal">{c}</Badge>)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.texto}</p>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{selected.size} selecionada(s)</span>
        {selected.size > 0 && <button type="button" onClick={limpar} className="text-muted-foreground hover:text-foreground underline">Limpar seleção</button>}
      </div>

      <div className="space-y-1.5 pt-2 border-t">
        <Label className="text-sm">Observação adicional (opcional)</Label>
        <Textarea
          rows={3}
          value={extra}
          onChange={(e) => { setExtra(e.target.value); persist(selected, e.target.value); }}
          placeholder="Cláusulas específicas desta proposta que não estão no catálogo…"
        />
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova cláusula</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Título</Label>
              <Input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>Texto</Label>
              <Textarea rows={3} value={novo.texto} onChange={(e) => setNovo({ ...novo, texto: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={novo.sempre_aplicavel} onCheckedChange={(v) => setNovo({ ...novo, sempre_aplicavel: v })} /> Sempre aplicável
            </label>
            <p className="text-[11px] text-muted-foreground">Fica salva no catálogo para reuso em outras propostas.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={criarInline}>Criar e selecionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}