import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, formatDate, proposalStatusLabel } from "@/lib/format";
import { FileText, Users, Briefcase, Plus, TrendingUp, FolderKanban } from "lucide-react";

type Counts = { propostas: number; aprovadas: number; clientes: number; servicos: number; pipeline: number; aprovado_valor: number; projetos_ativos: number; projetos_atrasados: number; };
const statusColor: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-primary/15 text-primary",
  negociacao: "bg-warning/15 text-warning",
  aprovada: "bg-success/15 text-success",
  recusada: "bg-danger/15 text-danger",
  expirada: "bg-muted text-muted-foreground",
};

export default function Dashboard() {
  const [counts, setCounts] = useState<Counts>({ propostas:0, aprovadas:0, clientes:0, servicos:0, pipeline:0, aprovado_valor:0, projetos_ativos:0, projetos_atrasados:0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [allProps, setAllProps] = useState<any[]>([]);
  const [base, setBase] = useState<"emissao"|"envio"|"aprovacao"|"cadastro">("emissao");

  useEffect(() => {
    document.title = "Dashboard | Portal HSE Consulting";
    (async () => {
      const [p, c, s, pr] = await Promise.all([
        supabase.from("proposals").select("id,numero,status,valor_total,created_at,data_emissao,data_envio,data_aprovacao,data_recusa,origem_cadastro,client_id,clients(razao_social,nome_fantasia)").order("data_emissao",{ascending:false,nullsFirst:false}),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("projetos").select("id,status"),
      ]);
      const props = p.data || [];
      setAllProps(props);
      const projetos = pr.data || [];
      setCounts(prev => ({
        ...prev,
        clientes: c.count || 0,
        servicos: s.count || 0,
        projetos_ativos: projetos.filter((x:any) => ["planejamento","em_execucao","em_revisao"].includes(x.status)).length,
        projetos_atrasados: projetos.filter((x:any) => x.status === "atrasado").length,
      }));
      setRecent(props.slice(0,8));
    })();
  }, []);

  // KPIs recalculados conforme base de data selecionada (não inflam mês atual com retroativas)
  useMemo(() => {
    const field: Record<string,string> = { emissao:"data_emissao", envio:"data_envio", aprovacao:"data_aprovacao", cadastro:"created_at" };
    const f = field[base];
    const valid = allProps.filter(p => p[f]);
    const pipeline = valid.filter(x => ["enviada","negociacao","rascunho"].includes(x.status)).reduce((a,b)=>a+Number(b.valor_total||0),0);
    const aprovadas = valid.filter(x => x.status === "aprovada");
    setCounts(prev => ({
      ...prev,
      propostas: valid.length,
      aprovadas: aprovadas.length,
      pipeline,
      aprovado_valor: aprovadas.reduce((a,b)=>a+Number(b.valor_total||0),0),
    }));
  }, [allProps, base]);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral do funil comercial e da carteira"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Base de data:</span>
              <Select value={base} onValueChange={(v:any)=>setBase(v)}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emissao">Emissão</SelectItem>
                  <SelectItem value="envio">Envio</SelectItem>
                  <SelectItem value="aprovacao">Aprovação</SelectItem>
                  <SelectItem value="cadastro">Cadastro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button asChild><Link to="/propostas"><Plus className="h-4 w-4 mr-2" /> Nova proposta</Link></Button>
          </div>
        } />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={FileText} label="Propostas" value={counts.propostas} hint={`${counts.aprovadas} aprovadas`} />
          <MetricCard icon={TrendingUp} label="Pipeline" value={brl(counts.pipeline)} hint="rascunho + enviadas + negociação" />
          <MetricCard icon={FolderKanban} label="Projetos ativos" value={counts.projetos_ativos} hint={`${counts.projetos_atrasados} atrasados`} />
          <MetricCard icon={Users} label="Clientes" value={counts.clientes} hint="cadastrados" />
        </div>

        <Card className="shadow-elegant">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Propostas recentes <span className="text-xs font-normal text-muted-foreground ml-2">por {base}</span></CardTitle>
            <Button variant="outline" size="sm" asChild><Link to="/propostas">Ver todas</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">Nenhuma proposta ainda. Comece criando uma.</div>
            ) : (
              <ul className="divide-y">
                {recent.map((p:any) => {
                  const dateMap: Record<string,string> = { emissao: p.data_emissao, envio: p.data_envio, aprovacao: p.data_aprovacao, cadastro: p.created_at };
                  return (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40">
                    <Link to={`/propostas/${p.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                        <span className="font-medium truncate">{p.clients?.nome_fantasia || p.clients?.razao_social || "—"}</span>
                        {p.origem_cadastro === "retroativa" && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-900 border-0">retro</Badge>}
                      </div>
                    </Link>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">{formatDate(dateMap[base])}</span>
                      <span className="font-mono text-sm">{brl(p.valor_total)}</span>
                      <Badge className={statusColor[p.status] + " border-0"}>{proposalStatusLabel[p.status]}</Badge>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint }: any) {
  return (
    <Card className="shadow-elegant">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center"><Icon className="h-4 w-4" /></div>
        </div>
        <div className="mt-2 font-display text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}