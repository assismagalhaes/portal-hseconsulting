import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { brl, formatDate } from "@/lib/format";
import { ETAPAS, etapaColor, etapaLabel } from "@/lib/crm";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, FileText, Target, AlertTriangle, Plus } from "lucide-react";

const PIE_COLORS = ["#16a34a","#0ea5e9","#f59e0b","#a855f7","#ef4444","#64748b","#14b8a6","#f97316"];

export default function CrmDashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [oports, setOports] = useState<any[]>([]);
  const [fups, setFups] = useState<any[]>([]);
  const [props, setProps] = useState<any[]>([]);

  useEffect(() => {
    document.title = "CRM Comercial | Portal HSE Consulting";
    (async () => {
      const [l, o, f, p] = await Promise.all([
        supabase.from("crm_leads").select("*"),
        supabase.from("crm_oportunidades").select("*"),
        supabase.from("crm_followups").select("*"),
        supabase.from("proposals").select("id, status, valor_total, created_at"),
      ]);
      setLeads(l.data||[]); setOports(o.data||[]); setFups(f.data||[]); setProps(p.data||[]);
    })();
  }, []);

  const leadsNovos = leads.filter(l => l.status === "novo").length;
  const leadsQual = leads.filter(l => l.status === "qualificado").length;
  const oportAbertas = oports.filter(o => !["ganho","perdido"].includes(o.etapa)).length;
  const propsEnviadas = props.filter(p => p.status === "enviada").length;
  const propsNegoc = props.filter(p => p.status === "negociacao").length;
  const propsAprov = props.filter(p => p.status === "aprovada").length;
  const propsPerd = props.filter(p => ["recusada","cancelada","expirada"].includes(p.status)).length;

  const pipelineValor = oports.filter(o => !["ganho","perdido"].includes(o.etapa)).reduce((s,o)=>s+Number(o.valor_estimado||0),0);
  const pondValor = oports.filter(o => !["ganho","perdido"].includes(o.etapa)).reduce((s,o)=>s+Number(o.valor_estimado||0)*Number(o.probabilidade||0)/100,0);
  const ganhos = oports.filter(o => o.etapa === "ganho");
  const perdidos = oports.filter(o => o.etapa === "perdido");
  const totalDecidido = ganhos.length + perdidos.length;
  const taxaConv = totalDecidido ? (ganhos.length/totalDecidido)*100 : 0;
  const ticketMedio = ganhos.length ? ganhos.reduce((s,o)=>s+Number(o.valor_estimado||0),0)/ganhos.length : 0;
  const tempoMedio = (() => {
    const list = ganhos.filter(o => o.created_at && o.data_ganho);
    if (!list.length) return 0;
    const tot = list.reduce((s,o)=>s+(new Date(o.data_ganho).getTime()-new Date(o.created_at).getTime()),0);
    return Math.round(tot/list.length/86400000);
  })();
  const hoje = new Date().toISOString().slice(0,10);
  const fupsVencidos = fups.filter(f => f.status === "pendente" && f.data && f.data < hoje).length;

  // Funil
  const funil = ETAPAS.filter(e => !["perdido"].includes(e.value)).map(e => ({
    etapa: e.label,
    qtd: oports.filter(o => o.etapa === e.value).length,
    valor: oports.filter(o => o.etapa === e.value).reduce((s,o)=>s+Number(o.valor_estimado||0),0),
  }));

  // Próximos 30/60/90 dias
  const previsao = [30, 60, 90].map(d => {
    const limite = new Date(); limite.setDate(limite.getDate()+d);
    const lstr = limite.toISOString().slice(0,10);
    const v = oports
      .filter(o => !["ganho","perdido"].includes(o.etapa) && o.data_prevista_fechamento && o.data_prevista_fechamento <= lstr)
      .reduce((s,o)=>s+Number(o.valor_estimado||0)*Number(o.probabilidade||0)/100,0);
    return { periodo: `${d}d`, valor: v };
  });

  return (
    <div>
      <PageHeader title="CRM Comercial" subtitle="Pipeline, leads e desempenho comercial"
        actions={<Link to="/crm/leads"><Button><Plus className="h-4 w-4 mr-2"/>Novo lead</Button></Link>} />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi icon={<Users className="h-4 w-4"/>} label="Leads novos" value={leadsNovos} hint={`${leadsQual} qualificados`} />
          <Kpi icon={<Target className="h-4 w-4"/>} label="Oportunidades abertas" value={oportAbertas} hint={brl(pipelineValor)} />
          <Kpi icon={<FileText className="h-4 w-4"/>} label="Propostas" value={propsEnviadas + propsNegoc} hint={`${propsAprov} aprovadas / ${propsPerd} perdidas`} />
          <Kpi icon={<AlertTriangle className="h-4 w-4 text-amber-600"/>} label="Follow-ups vencidos" value={fupsVencidos} hint="Ação necessária" />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Kpi icon={<TrendingUp className="h-4 w-4"/>} label="Pipeline bruto" value={brl(pipelineValor)} />
          <Kpi icon={<TrendingUp className="h-4 w-4"/>} label="Pipeline ponderado" value={brl(pondValor)} />
          <Kpi icon={<TrendingUp className="h-4 w-4"/>} label="Taxa conversão" value={`${taxaConv.toFixed(1)}%`} hint={`${ganhos.length} ganhas / ${perdidos.length} perdidas`} />
          <Kpi icon={<TrendingUp className="h-4 w-4"/>} label="Ticket médio" value={brl(ticketMedio)} hint={`Tempo médio: ${tempoMedio}d`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <h2 className="font-display font-semibold mb-3">Funil comercial</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funil} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="etapa" type="category" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v:any, k:any) => k === "valor" ? brl(v) : v} />
                <Bar dataKey="qtd" fill="#16a34a" name="Qtd" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4">
            <h2 className="font-display font-semibold mb-3">Previsão de receita</h2>
            <div className="space-y-3">
              {previsao.map(p => (
                <div key={p.periodo}>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Próximos {p.periodo}</span><span className="font-semibold">{brl(p.valor)}</span></div>
                  <div className="h-2 bg-muted rounded mt-1"><div className="h-full bg-emerald-500 rounded" style={{ width: `${Math.min(100, (p.valor/(pondValor||1))*100)}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t">
              <div className="text-xs text-muted-foreground uppercase">Receita ponderada total</div>
              <div className="text-2xl font-display font-bold text-emerald-700">{brl(pondValor)}</div>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="font-display font-semibold mb-3">Valor por etapa</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funil}>
              <XAxis dataKey="etapa" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tickFormatter={(v)=>`R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v:any)=>brl(v)} />
              <Bar dataKey="valor" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-display font-semibold">Últimas oportunidades</h2>
            <Link to="/crm/oportunidades" className="text-sm text-primary hover:underline">Ver todas →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Título</th><th className="text-left px-4 py-2">Etapa</th><th className="text-right px-4 py-2">Valor</th><th className="text-right px-4 py-2">Prob.</th><th className="text-left px-4 py-2">Previsão</th></tr>
            </thead>
            <tbody>
              {oports.slice(0,8).map(o => (
                <tr key={o.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2"><Link to={`/crm/oportunidades`} className="font-medium hover:underline">{o.titulo}</Link></td>
                  <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs ${etapaColor[o.etapa]}`}>{etapaLabel[o.etapa]}</span></td>
                  <td className="px-4 py-2 text-right font-mono">{brl(o.valor_estimado)}</td>
                  <td className="px-4 py-2 text-right">{o.probabilidade}%</td>
                  <td className="px-4 py-2">{formatDate(o.data_prevista_fechamento)}</td>
                </tr>
              ))}
              {oports.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma oportunidade.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">{icon}{label}</div>
      <div className="text-2xl font-display font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
