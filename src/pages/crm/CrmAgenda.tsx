import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { FUP_TIPOS, FUP_STATUS } from "@/lib/crm";

type View = "dia" | "semana" | "mes";

export default function CrmAgenda() {
  const [fups, setFups] = useState<any[]>([]);
  const [props, setProps] = useState<any[]>([]);
  const [view, setView] = useState<View>("semana");
  const [ref, setRef] = useState(new Date());

  useEffect(() => { document.title = "Agenda Comercial | CRM HSE"; reload(); }, []);
  async function reload() {
    const [f, p] = await Promise.all([
      supabase.from("crm_followups").select("*").order("data"),
      supabase.from("proposals").select("id, numero, titulo, validade, status").in("status", ["enviada","negociacao"]),
    ]);
    setFups(f.data||[]); setProps(p.data||[]);
  }

  const startDate = (() => {
    const d = new Date(ref);
    if (view === "dia") return d;
    if (view === "semana") { d.setDate(d.getDate() - d.getDay()); return d; }
    d.setDate(1); return d;
  })();
  const endDate = (() => {
    const d = new Date(startDate);
    if (view === "dia") d.setDate(d.getDate()+1);
    else if (view === "semana") d.setDate(d.getDate()+7);
    else d.setMonth(d.getMonth()+1);
    return d;
  })();

  const days: Date[] = [];
  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate()+1)) days.push(new Date(d));

  function eventsForDay(d: Date) {
    const ds = d.toISOString().slice(0,10);
    const ev: any[] = [];
    fups.filter(f => f.data === ds || (f.proximo_followup_data === ds && f.status !== "pendente"))
      .forEach(f => ev.push({ type: "followup", label: FUP_TIPOS.find(t=>t.value===f.tipo)?.label, sub: f.resumo, color: FUP_STATUS.find(s=>s.value===f.status)?.color }));
    props.filter(p => p.validade === ds).forEach(p => ev.push({ type: "proposta", label: `Validade: ${p.numero}`, sub: p.titulo, color: "bg-violet-100 text-violet-900" }));
    return ev;
  }

  function shift(d: number) {
    const nx = new Date(ref);
    if (view === "dia") nx.setDate(nx.getDate()+d);
    else if (view === "semana") nx.setDate(nx.getDate()+d*7);
    else nx.setMonth(nx.getMonth()+d);
    setRef(nx);
  }

  return (
    <div>
      <PageHeader title="Agenda comercial" subtitle="Follow-ups, reuniões e vencimentos de propostas" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={()=>shift(-1)}>‹</Button>
          <Button variant="outline" size="sm" onClick={()=>setRef(new Date())}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={()=>shift(1)}>›</Button>
          <span className="font-medium ml-2">{startDate.toLocaleDateString("pt-BR")} – {new Date(endDate.getTime()-86400000).toLocaleDateString("pt-BR")}</span>
          <div className="ml-auto flex gap-1">
            {(["dia","semana","mes"] as View[]).map(v => (
              <Button key={v} size="sm" variant={view===v?"default":"outline"} onClick={()=>setView(v)}>{v}</Button>
            ))}
          </div>
        </div>

        <div className={`grid gap-2 ${view==="dia"?"grid-cols-1":view==="semana"?"grid-cols-7":"grid-cols-7"}`}>
          {days.map(d => (
            <Card key={d.toISOString()} className="p-2 min-h-[140px]">
              <div className="text-xs font-semibold mb-2">{d.toLocaleDateString("pt-BR",{weekday:"short", day:"2-digit", month:"2-digit"})}</div>
              <div className="space-y-1">
                {eventsForDay(d).map((e,i) => (
                  <div key={i} className={`text-[11px] px-1.5 py-1 rounded ${e.color}`}>
                    <div className="font-medium truncate">{e.label}</div>
                    {e.sub && <div className="truncate opacity-80">{e.sub}</div>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
