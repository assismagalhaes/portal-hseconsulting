import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl, formatDate } from "@/lib/format";
import { FIN_STATUS_CONTRATO, FIN_STATUS_CONTRATO_COR } from "@/lib/financeiro";
import { Search, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export default function Contratos() {
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [fProjeto, setFProjeto] = useState<string>("all");

  const load = async () => {
    const [c, cl, pj] = await Promise.all([
      supabase.from("financeiro_contratos").select("*, proposals(numero, titulo), projetos(id, numero, titulo)").order("data_aprovacao", { ascending: false }),
      supabase.from("clients").select("id, razao_social, nome_fantasia"),
      supabase.from("projetos").select("id, numero, titulo").order("created_at", { ascending: false }),
    ]);
    setRows(c.data||[]); setClients(cl.data||[]); setProjetos(pj.data||[]);
  };
  useEffect(() => { document.title = "Contratos | Financeiro"; load(); }, []);

  const cliMap = Object.fromEntries(clients.map((c:any)=>[c.id, c.nome_fantasia||c.razao_social]));
  const filtered = rows.filter(r => {
    const term = q.toLowerCase();
    if (fProjeto !== "all" && r.projeto_id !== fProjeto) return false;
    return !term || (r.titulo||"").toLowerCase().includes(term) || (r.numero||"").toLowerCase().includes(term) || (cliMap[r.client_id]||"").toLowerCase().includes(term);
  });

  const sincronizar = async () => {
    const { data: aprovadas } = await supabase.from("proposals").select("id").eq("status", "aprovada");
    let n = 0;
    for (const p of aprovadas||[]) {
      const { data } = await supabase.rpc("financeiro_gerar_contrato", { _proposal_id: p.id });
      if (data) n++;
    }
    toast.success(`${n} contratos sincronizados`);
    load();
  };

  return (
    <div>
      <PageHeader title="Contratos Financeiros" subtitle="Propostas aprovadas e seus respectivos contratos"
        actions={<Button variant="outline" onClick={sincronizar}><RefreshCcw className="h-4 w-4 mr-2"/>Sincronizar aprovadas</Button>} />
      <div className="p-6 space-y-4">
        <div className="flex gap-2 flex-wrap"><div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input className="pl-9" placeholder="Buscar por cliente, número ou título…" value={q} onChange={e=>setQ(e.target.value)} /></div>
          <select className="border rounded px-3 text-sm bg-background" value={fProjeto} onChange={e=>setFProjeto(e.target.value)}>
            <option value="all">Todos os projetos</option>
            {projetos.map(p=> <option key={p.id} value={p.id}>{p.numero} — {p.titulo}</option>)}
          </select>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Contrato</th>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-left px-4 py-2">Projeto</th>
                <th className="text-left px-4 py-2">Aprovação</th>
                <th className="text-right px-4 py-2">Aprovado</th>
                <th className="text-right px-4 py-2">Recebido</th>
                <th className="text-right px-4 py-2">Saldo</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const saldo = Number(r.valor_aprovado||0) - Number(r.valor_recebido||0);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <Link to={`/financeiro/contratos/${r.id}`} className="font-medium hover:underline">{r.numero || r.titulo || r.id.slice(0,8)}</Link>
                      <div className="text-xs text-muted-foreground">{r.proposals?.titulo}</div>
                    </td>
                    <td className="px-4 py-2">{cliMap[r.client_id] || "—"}</td>
                    <td className="px-4 py-2 text-xs font-mono">{r.projetos ? <Link to={`/projetos/${r.projetos.id}`} className="text-primary hover:underline">{r.projetos.numero}</Link> : "—"}</td>
                    <td className="px-4 py-2">{formatDate(r.data_aprovacao)}</td>
                    <td className="px-4 py-2 text-right font-mono">{brl(r.valor_aprovado)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">{brl(r.valor_recebido)}</td>
                    <td className="px-4 py-2 text-right font-mono">{brl(saldo)}</td>
                    <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs ${FIN_STATUS_CONTRATO_COR[r.status]}`}>{FIN_STATUS_CONTRATO[r.status]}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum contrato encontrado. Aprove uma proposta para gerar.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}