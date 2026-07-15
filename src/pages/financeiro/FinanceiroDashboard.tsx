import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl, formatDate } from "@/lib/format";
import { FIN_STATUS_PARCELA, FIN_STATUS_PARCELA_COR, FIN_TIPO_CUSTO, margemIndicador, calcMargem } from "@/lib/financeiro";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { DollarSign, TrendingUp, AlertTriangle, FileText, Receipt, Wallet, ListChecks, CalendarClock } from "lucide-react";

const PIE_COLORS = ["#16a34a","#0ea5e9","#f59e0b","#a855f7","#ef4444","#64748b","#14b8a6","#f97316","#84cc16","#ec4899","#22d3ee","#eab308","#7c3aed","#94a3b8"];

export default function FinanceiroDashboard() {
  const [contratos, setContratos] = useState<any[]>([]);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [custos, setCustos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Financeiro | Portal HSE Consulting";
    (async () => {
      const [c, p, k, a] = await Promise.all([
        supabase.from("financeiro_contratos").select("*"),
        supabase.from("financeiro_parcelas").select("*"),
        supabase.from("financeiro_custos").select("*"),
        supabase.from("financeiro_alertas").select("*").eq("resolvido", false),
      ]);
      setContratos(c.data||[]); setParcelas(p.data||[]); setCustos(k.data||[]); setAlertas(a.data||[]);
    })();
  }, []);

  const hoje = new Date().toISOString().slice(0,10);
  const mes = hoje.slice(0,7);
  const aprovMes = contratos.filter(c => (c.data_aprovacao||"").startsWith(mes)).reduce((s,c)=>s+Number(c.valor_aprovado||0),0);
  const recebMes = parcelas.filter(p => p.data_recebimento && (p.data_recebimento||"").startsWith(mes)).reduce((s,p)=>s+Number(p.valor_recebido||0),0);
  const aberto = parcelas.filter(p => ["a_vencer","vencida","recebida_parcial"].includes(p.status)).reduce((s,p)=>s+(Number(p.valor)-Number(p.valor_recebido||0)),0);
  const vencido = parcelas.filter(p => p.status === "vencida").reduce((s,p)=>s+(Number(p.valor)-Number(p.valor_recebido||0)),0);
  const aguardandoEvento = parcelas.filter(p => p.status === "aguardando_evento");
  const aguardandoValor = aguardandoEvento.reduce((s,p)=>s+Number(p.valor||0),0);
  const custoTotal = custos.reduce((s,k)=>s+Number(k.valor||0),0);
  const receitaTotal = contratos.reduce((s,c)=>s+Number(c.valor_aprovado||0),0);
  const margem = calcMargem(receitaTotal, custoTotal);
  const ind = margemIndicador(margem);

  // Faturamento por mês (últimos 6)
  const meses: { label: string; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth()-i); d.setDate(1);
    meses.push({ label: d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}), key: d.toISOString().slice(0,7) });
  }
  const serieMes = meses.map(m => ({
    mes: m.label,
    aprovado: contratos.filter(c => (c.data_aprovacao||"").startsWith(m.key)).reduce((s,c)=>s+Number(c.valor_aprovado||0),0),
    recebido: parcelas.filter(p => (p.data_recebimento||"").startsWith(m.key)).reduce((s,p)=>s+Number(p.valor_recebido||0),0),
  }));

  // Custos por categoria
  const custoCat = Object.entries(custos.reduce((acc: any, k: any) => {
    const t = k.tipo || "outros"; acc[t] = (acc[t]||0)+Number(k.valor||0); return acc;
  }, {})).map(([k,v]) => ({ tipo: FIN_TIPO_CUSTO[k]||k, valor: v as number }));

  const proxVenc = [...parcelas]
    .filter(p => ["a_vencer","vencida","recebida_parcial"].includes(p.status))
    .sort((a,b)=>String(a.data_vencimento).localeCompare(String(b.data_vencimento)))
    .slice(0, 10);

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Faturamento, recebimentos, custos e margem"
        actions={<div className="flex gap-2">
          <Link to="/financeiro/contas-receber"><Button variant="outline"><Receipt className="h-4 w-4 mr-2"/>Contas a receber</Button></Link>
          <Link to="/financeiro/custos"><Button variant="outline"><Wallet className="h-4 w-4 mr-2"/>Custos</Button></Link>
        </div>} />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi icon={<DollarSign className="h-4 w-4"/>} label="Aprovado no mês" value={brl(aprovMes)} />
          <Kpi icon={<Receipt className="h-4 w-4"/>} label="Recebido no mês" value={brl(recebMes)} />
          <Kpi icon={<Wallet className="h-4 w-4"/>} label="Em aberto" value={brl(aberto)} hint={`${parcelas.filter(p=>["a_vencer","recebida_parcial"].includes(p.status)).length} parcelas`} />
          <Kpi icon={<AlertTriangle className="h-4 w-4 text-rose-600"/>} label="Vencido" value={brl(vencido)} hint={`${parcelas.filter(p=>p.status==="vencida").length} parcelas vencidas`} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi icon={<TrendingUp className="h-4 w-4"/>} label="Receita total aprovada" value={brl(receitaTotal)} />
          <Kpi icon={<Wallet className="h-4 w-4"/>} label="Custos realizados" value={brl(custoTotal)} />
          <Kpi icon={<TrendingUp className="h-4 w-4"/>} label="Margem real" value={`${margem.toFixed(1)}%`} hint={`${ind.emoji} ${ind.label}`} />
          <Kpi icon={<CalendarClock className="h-4 w-4 text-purple-600"/>} label="Aguardando evento" value={brl(aguardandoValor)} hint={`${aguardandoEvento.length} parcelas atreladas a marcos`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-display font-semibold mb-3">Faturamento × Recebimento (6 meses)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={serieMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" /><YAxis tickFormatter={(v)=>`R$${(Number(v)/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any)=>brl(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="aprovado" stroke="#0ea5e9" strokeWidth={2} name="Aprovado" />
                <Line type="monotone" dataKey="recebido" stroke="#16a34a" strokeWidth={2} name="Recebido" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4">
            <h3 className="font-display font-semibold mb-3">Custos por categoria</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={custoCat} dataKey="valor" nameKey="tipo" outerRadius={90} label={(e:any)=>e.tipo}>
                  {custoCat.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v:any)=>brl(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-display font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4"/>Próximos vencimentos</h2>
            <Link to="/financeiro/contas-receber" className="text-sm text-primary hover:underline">Ver todas →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Vencimento</th><th className="text-left px-4 py-2">Parcela</th><th className="text-left px-4 py-2">Contrato</th><th className="text-right px-4 py-2">Valor</th><th className="text-right px-4 py-2">Recebido</th><th className="text-left px-4 py-2">Status</th></tr>
            </thead>
            <tbody>
              {proxVenc.map((p:any) => (
                <tr key={p.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2">{formatDate(p.data_vencimento)}</td>
                  <td className="px-4 py-2">#{p.numero} {p.descricao}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{p.contrato_id?.slice(0,8)}</td>
                  <td className="px-4 py-2 text-right font-mono">{brl(p.valor)}</td>
                  <td className="px-4 py-2 text-right font-mono">{brl(p.valor_recebido)}</td>
                  <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs ${FIN_STATUS_PARCELA_COR[p.status]}`}>{FIN_STATUS_PARCELA[p.status]}</span></td>
                </tr>
              ))}
              {proxVenc.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma parcela em aberto.</td></tr>}
            </tbody>
          </table>
        </Card>

        {alertas.length > 0 && (
          <Card className="p-4 border-amber-300">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-amber-600"/><h3 className="font-display font-semibold">Alertas financeiros</h3>
              <Link to="/financeiro/alertas" className="ml-auto text-sm text-primary hover:underline">Ver todos →</Link></div>
            <ul className="text-sm space-y-1">
              {alertas.slice(0,5).map((a:any) => (
                <li key={a.id} className="flex items-center justify-between border-b border-border/50 pb-1">
                  <span><span className="font-medium">{a.titulo}</span> — {a.mensagem}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
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