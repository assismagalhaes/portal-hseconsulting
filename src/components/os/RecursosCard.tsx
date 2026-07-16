import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { osRecursoTipoLabel } from "@/lib/os";

export function RecursosCard({ osId, recursos, onChange }: any) {
  const [tipo, setTipo] = useState("equipamento");
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState("1");
  const add = async () => {
    if (!desc) return;
    const { error } = await supabase.from("os_recursos").insert({ os_id: osId, tipo: tipo as any, descricao: desc, quantidade: Number(qtd) || 1 });
    if (error) return toast.error(error.message);
    setDesc(""); setQtd("1"); onChange();
  };
  const del = async (id: string) => { await supabase.from("os_recursos").delete().eq("id", id); onChange(); };
  const byTipo = recursos.reduce((acc: any, r: any) => { (acc[r.tipo] ||= []).push(r); return acc; }, {});
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Recursos / Equipamentos / Veículos / Documentos / EPIs</div>
      <div className="flex gap-2">
        <Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(osRecursoTipoLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)} />
        <Input type="number" className="w-24" value={qtd} onChange={e => setQtd(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {Object.entries(byTipo).map(([t, arr]: any) => (
        <div key={t}>
          <div className="text-xs uppercase text-muted-foreground mt-2 mb-1">{osRecursoTipoLabel[t]}</div>
          <div className="space-y-1">
            {arr.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-1.5 rounded">
                <span className="flex-1">{r.descricao}</span><span className="font-mono text-xs">{r.quantidade}</span>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!recursos.length && <p className="text-sm text-muted-foreground">Nenhum recurso cadastrado.</p>}
    </CardContent></Card>
  );
}