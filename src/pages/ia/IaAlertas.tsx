import { useEffect, useState } from "react";
import { Bell, RefreshCw, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { iaGerarAlertas } from "@/lib/iaClient";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Alerta = {
  id: string; tipo: string; gravidade: string; titulo: string; descricao: string | null;
  acao_sugerida: string | null; status: string; created_at: string; entidade_tipo: string | null; entidade_id: string | null;
};

const GRAV_COLOR: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground", media: "bg-amber-500/15 text-amber-700",
  alta: "bg-orange-500/15 text-orange-700", critica: "bg-red-500/15 text-red-700",
};

export default function IaAlertas() {
  const [items, setItems] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(false);
  const [gen, setGen] = useState(false);
  const [filter, setFilter] = useState<string>("abertos");

  async function load() {
    setLoading(true);
    let q = supabase.from("ia_alertas").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "abertos") q = q.in("status", ["novo", "em_analise"]);
    else if (filter !== "todos") q = q.eq("status", filter as "novo" | "em_analise" | "resolvido" | "ignorado");
    const { data } = await q;
    setItems((data ?? []) as Alerta[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function gerar() {
    setGen(true);
    try {
      const r = await iaGerarAlertas();
      toast.success(`${r.gerados} novos alertas gerados (${r.total} avaliados)`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar alertas");
    } finally { setGen(false); }
  }

  async function setStatus(id: string, status: "novo" | "em_analise" | "resolvido" | "ignorado") {
    const patch: Record<string, unknown> = { status };
    if (status === "resolvido" || status === "ignorado") patch.resolved_at = new Date().toISOString();
    await supabase.from("ia_alertas").update(patch).eq("id", id);
    load();
  }

  return (
    <div>
      <PageHeader title="Alertas Inteligentes" subtitle="Riscos identificados cruzando propostas, OS, documentos e financeiro."
        actions={
          <>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abertos">Abertos</SelectItem>
                <SelectItem value="novo">Novos</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="resolvido">Resolvidos</SelectItem>
                <SelectItem value="ignorado">Ignorados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={gerar} disabled={gen}>
              {gen ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Gerar Alertas
            </Button>
          </>
        }
      />
      <div className="p-6 space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Carregando...</div>}
        {!loading && items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
            Nenhum alerta no momento. Clique em "Gerar Alertas" para a IA avaliar os dados.
          </div>
        )}
        {items.map((a) => (
          <div key={a.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Badge className={GRAV_COLOR[a.gravidade] ?? ""}>{a.gravidade.toUpperCase()}</Badge>
              <div className="flex-1">
                <div className="font-semibold">{a.titulo}</div>
                {a.descricao && <div className="text-sm text-muted-foreground mt-0.5">{a.descricao}</div>}
                {a.acao_sugerida && (
                  <div className="text-xs mt-2"><span className="font-semibold">Ação sugerida:</span> {a.acao_sugerida}</div>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Badge variant="outline">{a.status}</Badge>
                <div className="flex gap-1">
                  {a.status !== "em_analise" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "em_analise")}>Em análise</Button>}
                  {a.status !== "resolvido" && <Button size="sm" onClick={() => setStatus(a.id, "resolvido")}>Resolver</Button>}
                  {a.status !== "ignorado" && <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "ignorado")}>Ignorar</Button>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}