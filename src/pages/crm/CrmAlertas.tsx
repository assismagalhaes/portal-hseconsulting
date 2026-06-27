import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Clock, TrendingUp, Users, Flame, FileWarning } from "lucide-react";
import { formatDate, brl } from "@/lib/format";

/**
 * Geração dinâmica de alertas internos sem persistência.
 * Regras:
 * - Follow-up vencido: status pendente e data < hoje
 * - Proposta sem retorno: status enviada há mais de 7 dias
 * - Oportunidade parada: sem atualização há 15+ dias e etapa não final
 * - Proposta próxima do vencimento: validade dentro de 7 dias
 * - Lead novo sem responsável: status novo e sem responsavel_id
 * - Oportunidade quente sem próxima ação: temperatura quente sem follow-up futuro
 */
export default function CrmAlertas() {
  const [fups, setFups] = useState<any[]>([]);
  const [oports, setOports] = useState<any[]>([]);
  const [props, setProps] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Alertas | CRM HSE";
    (async () => {
      const [f, o, p, l] = await Promise.all([
        supabase.from("crm_followups").select("*"),
        supabase.from("crm_oportunidades").select("*"),
        supabase.from("proposals").select("id, numero, titulo, status, valor_total, validade, updated_at"),
        supabase.from("crm_leads").select("*"),
      ]);
      setFups(f.data||[]); setOports(o.data||[]); setProps(p.data||[]); setLeads(l.data||[]);
    })();
  }, []);

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const hojeStr = hoje.toISOString().slice(0,10);
  const em7 = new Date(hoje); em7.setDate(em7.getDate()+7);
  const em7Str = em7.toISOString().slice(0,10);
  const ha7 = new Date(hoje); ha7.setDate(ha7.getDate()-7);
  const ha15 = new Date(hoje); ha15.setDate(ha15.getDate()-15);

  const a_fupVencidos = fups.filter(f => f.status === "pendente" && f.data && f.data < hojeStr);
  const a_propsSemRetorno = props.filter(p => p.status === "enviada" && p.updated_at && new Date(p.updated_at) < ha7);
  const a_oportParadas = oports.filter(o => !["ganho","perdido"].includes(o.etapa) && o.updated_at && new Date(o.updated_at) < ha15);
  const a_propsVencendo = props.filter(p => p.validade && p.validade >= hojeStr && p.validade <= em7Str && !["aprovada","recusada","cancelada","expirada"].includes(p.status));
  const a_leadsSemResp = leads.filter(l => l.status === "novo" && !l.responsavel_id);
  const a_quenteSemAcao = oports.filter(o => o.temperatura === "quente" && !["ganho","perdido"].includes(o.etapa) &&
    !fups.some(f => f.oportunidade_id === o.id && f.status === "pendente" && f.data >= hojeStr));

  const sections = [
    { icon: <Clock className="h-4 w-4 text-amber-600"/>, title: "Follow-ups vencidos", color: "border-amber-300", items: a_fupVencidos.map(f => ({ label: `Follow-up de ${formatDate(f.data)}`, sub: f.resumo || "Sem resumo" })) },
    { icon: <FileWarning className="h-4 w-4 text-orange-600"/>, title: "Propostas sem retorno (7+ dias)", color: "border-orange-300", items: a_propsSemRetorno.map(p => ({ label: `${p.numero} – ${p.titulo||""}`, sub: brl(p.valor_total) })) },
    { icon: <TrendingUp className="h-4 w-4 text-rose-600"/>, title: "Oportunidades paradas (15+ dias)", color: "border-rose-300", items: a_oportParadas.map(o => ({ label: o.titulo, sub: brl(o.valor_estimado) })) },
    { icon: <AlertTriangle className="h-4 w-4 text-violet-600"/>, title: "Propostas próximas do vencimento", color: "border-violet-300", items: a_propsVencendo.map(p => ({ label: `${p.numero} – validade ${formatDate(p.validade)}`, sub: p.titulo })) },
    { icon: <Users className="h-4 w-4 text-blue-600"/>, title: "Leads novos sem responsável", color: "border-blue-300", items: a_leadsSemResp.map(l => ({ label: l.empresa, sub: l.contato_nome || "" })) },
    { icon: <Flame className="h-4 w-4 text-red-600"/>, title: "Oportunidades quentes sem próxima ação", color: "border-red-300", items: a_quenteSemAcao.map(o => ({ label: o.titulo, sub: brl(o.valor_estimado) })) },
  ];

  return (
    <div>
      <PageHeader title="Alertas comerciais" subtitle="Sinais de atenção que exigem ação do time" />
      <div className="p-6 grid gap-4 md:grid-cols-2">
        {sections.map(s => (
          <Card key={s.title} className={`p-4 border-l-4 ${s.color}`}>
            <div className="flex items-center gap-2 font-semibold">{s.icon} {s.title}
              <span className="ml-auto text-sm bg-muted px-2 py-0.5 rounded">{s.items.length}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {s.items.length === 0 ? (
                <li className="text-xs text-muted-foreground">Nada por aqui 🎉</li>
              ) : s.items.slice(0,6).map((it:any,i:number) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">{it.label}</div>
                  {it.sub && <div className="text-xs text-muted-foreground">{it.sub}</div>}
                </li>
              ))}
              {s.items.length > 6 && <li className="text-xs text-muted-foreground">+ {s.items.length-6} outros</li>}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
