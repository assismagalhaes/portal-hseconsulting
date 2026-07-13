import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { osStatusLabel, osStatusColor } from "@/lib/os";
import { formatDate } from "@/lib/format";

export default function MeuPainel() {
  const { user } = useAuth();
  const [prof, setProf] = useState<any>(null);
  const [os, setOs] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);

  useEffect(() => { (async () => {
    if (!user) return;
    const { data: p } = await supabase
      .from("execucao_profissionais")
      .select("*")
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();
    setProf(p);
    // Um profissional técnico pode estar registrado apenas como usuário do
    // sistema (profiles) sem cadastro em execucao_profissionais. Aceita ambos.
    const ids = [user.id, p?.id].filter(Boolean) as string[];
    const [{ data: os1 }, { data: v1 }] = await Promise.all([
      supabase.from("ordens_servico").select("*").in("responsavel_tecnico_id", ids).order("data_prevista_conclusao"),
      supabase.from("os_visitas").select("*, ordens_servico(numero, titulo, cliente_nome)").in("responsavel_id", ids).gte("data", new Date().toISOString().slice(0,10)).order("data"),
    ]);
    setOs((os1 as any) || []); setVisitas((v1 as any) || []);
  })(); }, [user?.id]);

  const stats = useMemo(() => ({
    andamento: os.filter(o => !["finalizada","cancelada"].includes(o.status)).length,
    pendentes: os.filter(o => ["aberta","planejamento","agendada","aguardando_cliente"].includes(o.status)).length,
    visitas: visitas.length,
  }), [os, visitas]);

  if (!user) return null;
  const displayName = prof?.nome || user.email || "";
  const displaySub = prof?.cargo ? `${prof.cargo}${prof.area ? " • " + prof.area : ""}` : undefined;

  return (
    <>
      <PageHeader title={`Painel — ${displayName}`} subtitle={displaySub} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="OS em andamento" value={stats.andamento} />
          <Kpi label="OS pendentes" value={stats.pendentes} />
          <Kpi label="Próximas visitas" value={stats.visitas} />
          <Kpi label="Checklists pendentes" value="—" />
        </div>

        <Card><CardContent className="p-4">
          <div className="text-sm font-semibold mb-3">Próximas visitas</div>
          <div className="space-y-2">
            {visitas.slice(0, 10).map(v => (
              <Link key={v.id} to={`/ordens-servico/${v.os_id}`} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 text-sm">
                <div className="text-xs font-mono w-24">{formatDate(v.data)} {v.hora_inicio?.slice(0,5)}</div>
                <div className="flex-1">
                  <div className="font-medium">{v.ordens_servico?.titulo || "—"}</div>
                  <div className="text-xs text-muted-foreground">{v.ordens_servico?.cliente_nome} {v.local ? "• " + v.local : ""}</div>
                </div>
                <Badge variant="secondary">{v.situacao}</Badge>
              </Link>
            ))}
            {!visitas.length && <p className="text-sm text-muted-foreground">Nenhuma visita agendada.</p>}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="text-sm font-semibold mb-3">Minhas OS</div>
          <div className="space-y-2">
            {os.map(o => (
              <Link key={o.id} to={`/ordens-servico/${o.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 text-sm">
                <div className="font-mono text-xs w-32">{o.numero}</div>
                <div className="flex-1"><div className="font-medium">{o.titulo}</div><div className="text-xs text-muted-foreground">{o.cliente_nome}</div></div>
                <Badge className={osStatusColor[o.status]} variant="secondary">{osStatusLabel[o.status]}</Badge>
                <div className="text-xs text-muted-foreground w-24 text-right">{formatDate(o.data_prevista_conclusao)}</div>
              </Link>
            ))}
            {!os.length && <p className="text-sm text-muted-foreground">Nenhuma OS vinculada.</p>}
          </div>
        </CardContent></Card>
      </div>
    </>
  );
}

function Kpi({ label, value }: any) {
  return <Card><CardContent className="p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-2xl font-bold mt-1 font-display">{value}</div>
  </CardContent></Card>;
}