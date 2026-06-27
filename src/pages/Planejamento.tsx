import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Calendar, MapPin, Hammer, ClipboardCheck, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { osStatusLabel } from "@/lib/os";

function isSameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function diffDays(a: Date, b: Date) { return Math.round((a.getTime() - b.getTime()) / 86400000); }

export default function Planejamento() {
  const [os, setOs] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("ordens_servico")
      .select("*, execucao_profissionais!ordens_servico_responsavel_tecnico_id_fkey(nome)")
      .order("data_prevista_conclusao");
    setOs((data as any) || []);
  })(); }, []);

  const k = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate()+1);
    const seteDias = new Date(hoje); seteDias.setDate(seteDias.getDate()-7);
    let hojeC=0, amanhaC=0, emCampo=0, emElab=0, atraso=0, aguard=0, finalSemana=0;
    for (const r of os) {
      const prev = r.data_prevista_inicio ? new Date(r.data_prevista_inicio+"T00:00:00") : null;
      if (prev && isSameDay(prev, hoje)) hojeC++;
      if (prev && isSameDay(prev, amanha)) amanhaC++;
      if (r.status === "em_campo") emCampo++;
      if (r.status === "em_elaboracao") emElab++;
      if (r.status === "aguardando_cliente") aguard++;
      const prevFim = r.data_prevista_conclusao ? new Date(r.data_prevista_conclusao+"T00:00:00") : null;
      if (prevFim && diffDays(hoje, prevFim) > 0 && r.status !== "finalizada" && r.status !== "cancelada") atraso++;
      if (r.status === "finalizada" && r.data_real_conclusao && new Date(r.data_real_conclusao+"T00:00:00") >= seteDias) finalSemana++;
    }
    return { hojeC, amanhaC, emCampo, emElab, atraso, aguard, finalSemana };
  }, [os]);

  const byTec = useMemo(() => Object.values(os.reduce((a: any, r) => {
    const n = r.execucao_profissionais?.nome || "Sem responsável";
    (a[n] ||= { nome: n, qtd: 0 }).qtd++; return a;
  }, {})), [os]);
  const byCidade = useMemo(() => Object.values(os.reduce((a: any, r) => {
    const n = r.cidade || "—"; (a[n] ||= { nome: n, qtd: 0 }).qtd++; return a;
  }, {})), [os]);
  const byStatus = useMemo(() => Object.entries(osStatusLabel).map(([k, label]) => ({ nome: label, qtd: os.filter(o => o.status === k).length })), [os]);
  const byMes = useMemo(() => {
    const m: any = {};
    for (const r of os) {
      const k = r.created_at?.slice(0,7) || "—";
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).sort().map(([k, v]) => ({ nome: k, qtd: v }));
  }, [os]);

  return (
    <>
      <PageHeader title="Centro de Planejamento" subtitle="Visão operacional consolidada das ordens de serviço" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Kpi icon={<Calendar className="h-5 w-5 text-primary" />} label="Serviços hoje" value={k.hojeC} />
          <Kpi icon={<Calendar className="h-5 w-5" />} label="Serviços amanhã" value={k.amanhaC} />
          <Kpi icon={<Hammer className="h-5 w-5 text-emerald-600" />} label="Em campo" value={k.emCampo} />
          <Kpi icon={<ClipboardCheck className="h-5 w-5 text-violet-600" />} label="Em elaboração" value={k.emElab} />
          <Kpi icon={<AlertTriangle className="h-5 w-5 text-rose-600" />} label="Em atraso" value={k.atraso} highlight={k.atraso > 0} />
          <Kpi icon={<Clock className="h-5 w-5 text-cyan-600" />} label="Aguardando cliente" value={k.aguard} />
          <Kpi icon={<CheckCircle2 className="h-5 w-5 text-green-700" />} label="Finalizados (7d)" value={k.finalSemana} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Chart title="Execuções por técnico" data={byTec} />
          <Chart title="Execuções por cidade" data={byCidade} />
          <Chart title="Execuções por status" data={byStatus as any} />
          <Chart title="Execuções por mês (criação)" data={byMes as any} />
        </div>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, highlight }: any) {
  return <Card className={highlight ? "border-rose-300" : ""}><CardContent className="p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
    <div className="text-2xl font-bold mt-1 font-display">{value}</div>
  </CardContent></Card>;
}

function Chart({ title, data }: any) {
  return <Card><CardContent className="p-4">
    <div className="text-sm font-semibold mb-3">{title}</div>
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="qtd">{data?.map((_: any, i: number) => <Cell key={i} fill="hsl(var(--primary))" />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  </CardContent></Card>;
}