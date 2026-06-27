import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRIORIDADE_COLOR, PRIORIDADE_LABEL } from "@/lib/automacoes";
import { Check, CheckCheck } from "lucide-react";

interface Notif {
  id: string; titulo: string; mensagem: string | null; modulo: string;
  prioridade: string; status: string; link: string | null; created_at: string;
}

export default function Notificacoes() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [prio, setPrio] = useState("todas");
  const [status, setStatus] = useState("todas");
  const [modulo, setModulo] = useState("todos");

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("notificacoes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300);
    setItems((data as Notif[]) ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function marcar(id: string, novoStatus: "lida" | "resolvida" | "ignorada") {
    const patch: Record<string, string> = { status: novoStatus };
    if (novoStatus === "lida") patch.lida_em = new Date().toISOString();
    if (novoStatus === "resolvida") patch.resolvida_em = new Date().toISOString();
    await supabase.from("notificacoes").update(patch).eq("id", id);
    load();
  }

  const filtered = items.filter((n) =>
    (prio === "todas" || n.prioridade === prio) &&
    (status === "todas" || n.status === status) &&
    (modulo === "todos" || n.modulo === modulo)
  );
  const modulos = Array.from(new Set(items.map((i) => i.modulo)));

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Notificações" subtitle="Central de notificações internas" />
      <div className="flex gap-2 flex-wrap">
        <Select value={prio} onValueChange={setPrio}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as prioridades</SelectItem>
            {Object.entries(PRIORIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            <SelectItem value="nao_lida">Não lidas</SelectItem>
            <SelectItem value="lida">Lidas</SelectItem>
            <SelectItem value="resolvida">Resolvidas</SelectItem>
            <SelectItem value="ignorada">Ignoradas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modulo} onValueChange={setModulo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os módulos</SelectItem>
            {modulos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0 divide-y">
          {filtered.length === 0 && <div className="text-center text-muted-foreground py-12">Sem notificações</div>}
          {filtered.map((n) => (
            <div key={n.id} className={`p-4 flex items-start gap-3 ${n.status === "nao_lida" ? "bg-muted/30" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={PRIORIDADE_COLOR[n.prioridade] ?? ""}>{PRIORIDADE_LABEL[n.prioridade] ?? n.prioridade}</Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">{n.modulo}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                  <Badge variant="secondary" className="text-[10px]">{n.status}</Badge>
                </div>
                <div className="font-medium mt-1">{n.titulo}</div>
                {n.mensagem && <p className="text-sm text-muted-foreground mt-0.5">{n.mensagem}</p>}
              </div>
              <div className="flex flex-col gap-1">
                {n.link && <Button asChild size="sm" variant="outline"><Link to={n.link}>Abrir</Link></Button>}
                {n.status === "nao_lida" && <Button size="sm" variant="ghost" onClick={() => marcar(n.id, "lida")}><Check className="h-3 w-3 mr-1" /> Lida</Button>}
                {n.status !== "resolvida" && <Button size="sm" variant="ghost" onClick={() => marcar(n.id, "resolvida")}><CheckCheck className="h-3 w-3 mr-1" /> Resolver</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}