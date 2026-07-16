import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, Trash2, Flame, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Pendencia = {
  id: string;
  projeto_id: string;
  titulo: string;
  responsavel: string | null;
  prazo: string | null;
  prioridade: "normal" | "urgente";
  status: "aberta" | "resolvida";
  observacao: string | null;
  resolvida_em: string | null;
  created_at: string;
};

export default function PendenciasCard({ projetoId, onCountChange }: { projetoId: string; onCountChange?: (abertas: number, urgentes: number) => void }) {
  const [items, setItems] = useState<Pendencia[]>([]);
  const [novo, setNovo] = useState("");
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmar, setConfirmar] = useState<Pendencia | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("projeto_pendencias")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("status", { ascending: true })
      .order("prioridade", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    const list = (data || []) as Pendencia[];
    setItems(list);
    setLoading(false);
    const abertas = list.filter(p => p.status === "aberta");
    onCountChange?.(abertas.length, abertas.filter(p => p.prioridade === "urgente").length);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projetoId]);

  const adicionar = async () => {
    const titulo = novo.trim();
    if (!titulo) return;
    const { error } = await (supabase as any).from("projeto_pendencias").insert({ projeto_id: projetoId, titulo });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNovo("");
    load();
  };

  const patch = async (id: string, changes: Partial<Pendencia>) => {
    const { error } = await (supabase as any).from("projeto_pendencias").update(changes).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    load();
  };

  const resolver = (p: Pendencia) => patch(p.id, { status: "resolvida", resolvida_em: new Date().toISOString() } as any);
  const reabrir = (p: Pendencia) => patch(p.id, { status: "aberta", resolvida_em: null } as any);
  const toggleUrgente = (p: Pendencia) => patch(p.id, { prioridade: p.prioridade === "urgente" ? "normal" : "urgente" } as any);
  const remover = async (p: Pendencia) => {
    await (supabase as any).from("projeto_pendencias").delete().eq("id", p.id);
    load();
  };

  const abertas = items.filter(p => p.status === "aberta");
  const resolvidas = items.filter(p => p.status === "resolvida");

  const prazoBadge = (prazo: string | null) => {
    if (!prazo) return null;
    const d = new Date(prazo);
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const diff = Math.floor((d.getTime() - hoje.getTime()) / 86400000);
    const cor = diff < 0 ? "bg-rose-100 text-rose-800" : diff <= 3 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
    return <span className={`text-[11px] px-1.5 py-0.5 rounded ${cor}`}>Vence {formatDate(prazo)}</span>;
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Anotar uma pendência… (ex.: Cliente não enviou PGR)"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
          />
          <Button onClick={adicionar} size="sm"><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <>
            <div className="space-y-1.5">
              {abertas.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma pendência aberta 🎉</div>}
              {abertas.map(p => {
                const aberta = expandidas[p.id];
                return (
                  <div key={p.id} className={`border rounded-md ${p.prioridade === "urgente" ? "border-rose-300 bg-rose-50/40" : ""}`}>
                    <div className="flex items-center gap-2 p-2">
                      <button onClick={() => setExpandidas({ ...expandidas, [p.id]: !aberta })} className="text-muted-foreground hover:text-foreground">
                        {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <button onClick={() => toggleUrgente(p)} title={p.prioridade === "urgente" ? "Marcar como normal" : "Marcar como urgente"}>
                        <Flame className={`h-4 w-4 ${p.prioridade === "urgente" ? "text-rose-600 fill-rose-500" : "text-muted-foreground"}`} />
                      </button>
                      <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{p.titulo}</span>
                        {p.responsavel && <Badge variant="secondary" className="text-[11px]">{p.responsavel}</Badge>}
                        {prazoBadge(p.prazo)}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => resolver(p)} title="Marcar como resolvida"><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmar(p)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    {aberta && (
                      <div className="grid gap-2 p-3 pt-0 border-t bg-muted/30 sm:grid-cols-3">
                        <div>
                          <label className="text-[11px] uppercase text-muted-foreground">Título</label>
                          <Input defaultValue={p.titulo} onBlur={(e) => e.target.value !== p.titulo && patch(p.id, { titulo: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-[11px] uppercase text-muted-foreground">Responsável</label>
                          <Input defaultValue={p.responsavel || ""} onBlur={(e) => e.target.value !== (p.responsavel || "") && patch(p.id, { responsavel: e.target.value || null } as any)} />
                        </div>
                        <div>
                          <label className="text-[11px] uppercase text-muted-foreground">Prazo</label>
                          <Input type="date" defaultValue={p.prazo || ""} onBlur={(e) => e.target.value !== (p.prazo || "") && patch(p.id, { prazo: e.target.value || null } as any)} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[11px] uppercase text-muted-foreground">Observação</label>
                          <Textarea rows={2} defaultValue={p.observacao || ""} onBlur={(e) => e.target.value !== (p.observacao || "") && patch(p.id, { observacao: e.target.value || null } as any)} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {resolvidas.length > 0 && (
              <div className="pt-2 border-t">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => setMostrarResolvidas(!mostrarResolvidas)}>
                  {mostrarResolvidas ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {resolvidas.length} resolvida{resolvidas.length > 1 ? "s" : ""}
                </button>
                {mostrarResolvidas && (
                  <div className="space-y-1 mt-2">
                    {resolvidas.map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-sm text-muted-foreground py-1 px-2">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="line-through flex-1 truncate">{p.titulo}</span>
                        {p.resolvida_em && <span className="text-[11px]">{formatDate(p.resolvida_em)}</span>}
                        <Button size="sm" variant="ghost" onClick={() => reabrir(p)} title="Reabrir"><Undo2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmar(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <AlertDialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover pendência?</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmar ? <>A pendência <span className="font-medium text-foreground">"{confirmar.titulo}"</span> será excluída permanentemente. Esta ação não pode ser desfeita.</> : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (confirmar) { await remover(confirmar); setConfirmar(null); }
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}