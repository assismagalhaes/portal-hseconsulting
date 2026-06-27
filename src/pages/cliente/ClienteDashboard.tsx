import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Briefcase, ClipboardList, FileSignature, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { useClienteAuth } from "@/lib/clienteAuth";
import { Link } from "react-router-dom";

export default function ClienteDashboard() {
  const { clienteUser } = useClienteAuth();
  const [kpis, setKpis] = useState({
    propostas: 0, servicos: 0, os: 0, docs: 0, pendencias: 0, docsVencendo: 0, docsVencidos: 0,
  });
  const [proxVisitas, setProxVisitas] = useState<any[]>([]);
  const [ultimasEntregas, setUltimasEntregas] = useState<any[]>([]);
  const [pendencias, setPendencias] = useState<any[]>([]);

  useEffect(() => { document.title = "Portal do Cliente | HSE"; load(); }, []);

  async function load() {
    const hoje = new Date().toISOString().slice(0, 10);
    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const [p, s, o, d, pend, dv, dve, vis, ent] = await Promise.all([
      supabase.from("proposals").select("id", { count: "exact", head: true }),
      supabase.from("execucao_servicos").select("id", { count: "exact", head: true }).in("status", ["em_execucao", "aguardando_aprovacao_cliente", "agendado", "aguardando_inicio"]),
      supabase.from("ordens_servico").select("id", { count: "exact", head: true }).gte("data_prevista_inicio", hoje),
      supabase.from("documentos_tecnicos").select("id", { count: "exact", head: true }),
      supabase.from("documentos_pendentes").select("id", { count: "exact", head: true }).neq("status", "recebido"),
      supabase.from("documentos_tecnicos").select("id", { count: "exact", head: true }).gte("data_vencimento", hoje).lte("data_vencimento", em30),
      supabase.from("documentos_tecnicos").select("id", { count: "exact", head: true }).lt("data_vencimento", hoje),
      supabase.from("ordens_servico").select("id, numero, titulo, data_prevista_inicio").gte("data_prevista_inicio", hoje).order("data_prevista_inicio").limit(5),
      supabase.from("documentos_tecnicos").select("id, numero, titulo, data_emissao").order("data_emissao", { ascending: false }).limit(5),
    ]);
    setKpis({
      propostas: p.count || 0, servicos: s.count || 0, os: o.count || 0, docs: d.count || 0,
      pendencias: pend.count || 0, docsVencendo: dv.count || 0, docsVencidos: dve.count || 0,
    });
    setProxVisitas(vis.data || []);
    setUltimasEntregas(ent.data || []);
    const { data: pp } = await supabase.from("documentos_pendentes").select("id, documento_solicitado, prazo, status").neq("status", "recebido").order("prazo").limit(5);
    setPendencias(pp || []);
  }

  const cards = [
    { label: "Propostas", icon: FileText, value: kpis.propostas, to: "/cliente/propostas" },
    { label: "Serviços em andamento", icon: Briefcase, value: kpis.servicos, to: "/cliente/servicos" },
    { label: "OS agendadas", icon: ClipboardList, value: kpis.os, to: "/cliente/ordens-servico" },
    { label: "Documentos liberados", icon: FileSignature, value: kpis.docs, to: "/cliente/documentos" },
    { label: "Pendências", icon: AlertCircle, value: kpis.pendencias, to: "/cliente/pendencias", warn: kpis.pendencias > 0 },
    { label: "Próximos do vencimento", icon: Clock, value: kpis.docsVencendo, to: "/cliente/documentos" },
    { label: "Documentos vencidos", icon: AlertTriangle, value: kpis.docsVencidos, to: "/cliente/documentos", danger: kpis.docsVencidos > 0 },
  ];

  return (
    <div>
      <PageHeader title={`Olá, ${clienteUser?.nome?.split(" ")[0] || "Cliente"}`} subtitle="Acompanhe seus serviços e entregas" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map(c => (
            <Link key={c.label} to={c.to}>
              <Card className={`hover:shadow-elegant transition ${c.danger ? "border-destructive" : c.warn ? "border-warning" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <c.icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{c.value}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">{c.label}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardHeader><CardTitle className="text-base">Próximas visitas</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {proxVisitas.length === 0 && <div className="text-muted-foreground text-xs">Nenhuma visita agendada.</div>}
              {proxVisitas.map(v => (
                <div key={v.id} className="border-b pb-1">
                  <div className="font-medium">{v.numero}</div>
                  <div className="text-xs text-muted-foreground">{v.titulo}</div>
                  <div className="text-xs">{v.data_prevista_inicio || "—"}</div>
                </div>
              ))}
            </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Últimas entregas</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {ultimasEntregas.length === 0 && <div className="text-muted-foreground text-xs">Nenhuma entrega recente.</div>}
              {ultimasEntregas.map(d => (
                <div key={d.id} className="border-b pb-1">
                  <div className="font-medium">{d.numero}</div>
                  <div className="text-xs text-muted-foreground">{d.titulo}</div>
                  <div className="text-xs">{d.data_emissao}</div>
                </div>
              ))}
            </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Pendências a tratar</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {pendencias.length === 0 && <div className="text-muted-foreground text-xs">Sem pendências em aberto.</div>}
              {pendencias.map(p => (
                <Link key={p.id} to="/cliente/pendencias" className="block border-b pb-1 hover:bg-muted/50">
                  <div className="font-medium">{p.documento_solicitado}</div>
                  <div className="text-xs text-muted-foreground">Prazo: {p.prazo || "—"}</div>
                </Link>
              ))}
            </CardContent></Card>
        </div>
      </div>
    </div>
  );
}