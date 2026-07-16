import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export function EquipeCard({ osId, equipe, profs, onChange }: any) {
  const [profId, setProfId] = useState("");
  const [papel, setPapel] = useState("apoio");
  const [conflitos, setConflitos] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const ids = equipe.map((e: any) => e.profissional_id);
      if (!ids.length) return setConflitos({});
      const { data: ev } = await supabase.from("os_eventos_agenda")
        .select("profissional_id").in("profissional_id", ids)
        .gte("start_at", new Date(Date.now() - 7 * 86400000).toISOString());
      const map: Record<string, number> = {};
      (ev || []).forEach((e: any) => { map[e.profissional_id] = (map[e.profissional_id] || 0) + 1; });
      setConflitos(map);
    })();
  }, [equipe]);

  const add = async () => {
    if (!profId) return;
    const { error } = await supabase.from("os_equipe").insert({ os_id: osId, profissional_id: profId, papel });
    if (error) return toast.error(error.message);
    setProfId(""); onChange();
  };
  const del = async (id: string) => { await supabase.from("os_equipe").delete().eq("id", id); onChange(); };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Equipe de apoio</div>
      <div className="flex gap-2">
        <Select value={profId} onValueChange={setProfId}><SelectTrigger className="flex-1"><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>{profs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}{p.cargo ? ` — ${p.cargo}` : ""}</SelectItem>)}</SelectContent></Select>
        <Select value={papel} onValueChange={setPapel}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="lider">Líder</SelectItem><SelectItem value="apoio">Apoio</SelectItem><SelectItem value="observador">Observador</SelectItem></SelectContent></Select>
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1">
        {equipe.map((e: any) => {
          const cnt = conflitos[e.profissional_id] || 0;
          return (
            <div key={e.id} className="flex items-center gap-3 text-sm bg-muted/40 px-3 py-2 rounded">
              <span className="flex-1">{e.execucao_profissionais?.nome} — <span className="text-muted-foreground">{e.papel}</span></span>
              {cnt > 1 && <Badge variant="secondary" className="bg-amber-100 text-amber-900">⚠ {cnt} eventos próximos</Badge>}
              <Button size="sm" variant="ghost" onClick={() => del(e.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          );
        })}
        {!equipe.length && <p className="text-sm text-muted-foreground">Sem equipe vinculada.</p>}
      </div>
    </CardContent></Card>
  );
}