import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FIN_ALERTA_TIPO, FIN_STATUS_CONTRATO, diasParaVencer, calcMargem, margemIndicador } from "@/lib/financeiro";
import { formatDate, brl } from "@/lib/format";
import { Bell, CheckCircle2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export default function Alertas() {
  const [alertas, setAlertas] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("financeiro_alertas").select("*").order("created_at", { ascending: false });
    setAlertas(data||[]);
  };
  useEffect(() => { document.title = "Alertas Financeiros"; load(); }, []);

  const gerar = async () => {
    // Limpa alertas não resolvidos e regenera
    await supabase.from("financeiro_alertas").delete().eq("resolvido", false);
    const [{ data: parc }, { data: cfg }, { data: contratos }, { data: custos }, { data: pricing }, { data: items }] = await Promise.all([
      supabase.from("financeiro_parcelas").select("*"),
      supabase.from("financeiro_configuracoes").select("*").limit(1).maybeSingle(),
      supabase.from("financeiro_contratos").select("*"),
      supabase.from("financeiro_custos").select("*"),
      supabase.from("proposal_item_pricing").select("*"),
      supabase.from("proposal_items").select("id, proposal_id"),
    ]);
    const dias = (cfg as any)?.dias_alerta_vencimento ?? 3;
    const mMin = (cfg as any)?.margem_minima_alerta ?? 15;
    const inserts: any[] = [];

    for (const p of parc||[]) {
      if (["recebida","cancelada"].includes(p.status)) continue;
      const d = diasParaVencer(p.data_vencimento);
      if (d !== null && d < 0) {
        inserts.push({ tipo: "parcela_vencida", titulo: `Parcela #${p.numero} vencida há ${Math.abs(d)}d`, mensagem: brl(Number(p.valor)-Number(p.valor_recebido||0))+" em aberto", parcela_id: p.id, contrato_id: p.contrato_id, client_id: p.client_id });
      } else if (d !== null && d <= dias) {
        inserts.push({ tipo: "parcela_vencendo", titulo: `Parcela #${p.numero} vence em ${d}d`, mensagem: `Vencimento em ${formatDate(p.data_vencimento)}`, parcela_id: p.id, contrato_id: p.contrato_id, client_id: p.client_id });
      }
      if (p.status === "recebida_parcial") {
        inserts.push({ tipo: "pagamento_parcial", titulo: `Parcela #${p.numero} recebida parcialmente`, mensagem: `${brl(p.valor_recebido)} de ${brl(p.valor)}`, parcela_id: p.id, contrato_id: p.contrato_id });
      }
    }

    for (const c of contratos||[]) {
      const temParc = (parc||[]).some(p => p.contrato_id === c.id);
      if (!temParc) inserts.push({ tipo: "sem_parcelas", titulo: "Contrato sem parcelas", mensagem: `${c.numero || c.id.slice(0,8)} — valor ${brl(c.valor_aprovado)}`, contrato_id: c.id, proposal_id: c.proposal_id, client_id: c.client_id });

      const propItems = (items||[]).filter(i => i.proposal_id === c.proposal_id).map(i => i.id);
      const custoPrev = (pricing||[]).filter(pp => propItems.includes(pp.proposal_item_id)).reduce((s,pp:any)=>s+Number(pp.custo_total||0),0);
      const custoReal = (custos||[]).filter(k => k.proposal_id === c.proposal_id).reduce((s,k)=>s+Number(k.valor||0),0);
      if (custoPrev > 0 && custoReal > custoPrev * 1.1) {
        inserts.push({ tipo: "custo_acima_previsto", titulo: "Custo acima do previsto", mensagem: `Realizado ${brl(custoReal)} vs previsto ${brl(custoPrev)}`, contrato_id: c.id, proposal_id: c.proposal_id });
      }
      const margem = calcMargem(Number(c.valor_aprovado||0), custoReal);
      if (custoReal > 0 && margem < Number(mMin)) {
        inserts.push({ tipo: "margem_baixa", titulo: `Margem ${margem.toFixed(1)}%`, mensagem: `Abaixo do mínimo (${mMin}%)`, contrato_id: c.id, proposal_id: c.proposal_id });
      }
    }

    if (inserts.length) await supabase.from("financeiro_alertas").insert(inserts);
    toast.success(`${inserts.length} alertas gerados`); load();
  };

  const resolver = async (id: string) => { await supabase.from("financeiro_alertas").update({ resolvido: true }).eq("id", id); load(); };

  return (
    <div>
      <PageHeader title="Alertas Financeiros" subtitle="Avisos internos sobre parcelas, custos e margens"
        actions={<Button size="sm" onClick={gerar}><RefreshCcw className="h-4 w-4 mr-1"/>Gerar alertas</Button>} />
      <div className="p-6 space-y-3">
        {alertas.length === 0 && <Card className="p-10 text-center text-muted-foreground"><Bell className="h-8 w-8 mx-auto mb-2"/>Nenhum alerta no momento. Clique em "Gerar alertas".</Card>}
        {alertas.map(a => (
          <Card key={a.id} className={`p-4 flex items-start justify-between ${a.resolvido ? "opacity-50" : ""}`}>
            <div>
              <div className="text-xs uppercase text-muted-foreground">{FIN_ALERTA_TIPO[a.tipo] || a.tipo} · {formatDate(a.created_at)}</div>
              <div className="font-medium">{a.titulo}</div>
              <div className="text-sm text-muted-foreground">{a.mensagem}</div>
            </div>
            {!a.resolvido && <Button size="sm" variant="outline" onClick={()=>resolver(a.id)}><CheckCircle2 className="h-4 w-4 mr-1"/>Resolver</Button>}
          </Card>
        ))}
      </div>
    </div>
  );
}