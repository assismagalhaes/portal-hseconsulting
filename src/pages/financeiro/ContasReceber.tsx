import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, formatDate } from "@/lib/format";
import { FIN_STATUS_PARCELA, FIN_STATUS_PARCELA_COR } from "@/lib/financeiro";
import { Download, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

export default function ContasReceber() {
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from("financeiro_parcelas").select("*, financeiro_contratos(numero, titulo)").order("data_vencimento"),
      supabase.from("clients").select("id, razao_social, nome_fantasia"),
    ]);
    setParcelas(p.data||[]); setClients(c.data||[]);
  };
  useEffect(() => { document.title = "Contas a Receber | Portal HSE Consulting"; load(); }, []);

  const cliMap = Object.fromEntries(clients.map((c:any)=>[c.id, c.nome_fantasia||c.razao_social]));
  const filtered = parcelas.filter(p => {
    const t = q.toLowerCase();
    const matchQ = !t || (cliMap[p.client_id]||"").toLowerCase().includes(t) || (p.descricao||"").toLowerCase().includes(t);
    const matchS = status === "todos" || p.status === status;
    return matchQ && matchS;
  });

  const totalAberto = filtered.filter(p=>["a_vencer","vencida","recebida_parcial"].includes(p.status)).reduce((s,p)=>s+(Number(p.valor)-Number(p.valor_recebido||0)),0);
  const totalVencido = filtered.filter(p=>p.status==="vencida").reduce((s,p)=>s+(Number(p.valor)-Number(p.valor_recebido||0)),0);
  const totalReceb = filtered.filter(p=>p.status==="recebida").reduce((s,p)=>s+Number(p.valor_recebido),0);

  const atualizarVencidas = async () => {
    const { data, error } = await supabase.rpc("financeiro_atualizar_vencidas");
    if (error) return toast.error(error.message);
    toast.success(`${data} parcelas marcadas como vencidas`);
    load();
  };

  const exportarCSV = () => {
    const headers = ["Vencimento","Cliente","Contrato","Parcela","Descrição","Valor","Recebido","Status"];
    const rows = filtered.map(p => [
      formatDate(p.data_vencimento), cliMap[p.client_id]||"", p.financeiro_contratos?.numero||"",
      p.numero, p.descricao||"", String(p.valor), String(p.valor_recebido||0), FIN_STATUS_PARCELA[p.status],
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff"+csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `contas-a-receber-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div>
      <PageHeader title="Contas a Receber" subtitle="Parcelas a vencer, vencidas e recebidas"
        actions={<div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={atualizarVencidas}><RefreshCcw className="h-4 w-4 mr-1"/>Atualizar vencidas</Button>
          <Button variant="outline" size="sm" onClick={exportarCSV}><Download className="h-4 w-4 mr-1"/>CSV</Button>
        </div>} />
      <div className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total em aberto</div><div className="text-2xl font-display font-bold mt-1">{brl(totalAberto)}</div></Card>
          <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total vencido</div><div className="text-2xl font-display font-bold mt-1 text-rose-700">{brl(totalVencido)}</div></Card>
          <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total recebido</div><div className="text-2xl font-display font-bold mt-1 text-emerald-700">{brl(totalReceb)}</div></Card>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-9" placeholder="Buscar cliente ou descrição…" value={q} onChange={e=>setQ(e.target.value)} /></div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(FIN_STATUS_PARCELA).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Vencimento</th><th className="text-left px-4 py-2">Cliente</th><th className="text-left px-4 py-2">Contrato</th><th className="text-left px-4 py-2">Parcela</th><th className="text-right px-4 py-2">Valor</th><th className="text-right px-4 py-2">Recebido</th><th className="text-left px-4 py-2">Status</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2">{formatDate(p.data_vencimento)}</td>
                  <td className="px-4 py-2">{cliMap[p.client_id]||"—"}</td>
                  <td className="px-4 py-2"><Link to={`/financeiro/contratos/${p.contrato_id}`} className="text-primary hover:underline">{p.financeiro_contratos?.numero || p.contrato_id?.slice(0,8)}</Link></td>
                  <td className="px-4 py-2">#{p.numero} {p.descricao}</td>
                  <td className="px-4 py-2 text-right font-mono">{brl(p.valor)}</td>
                  <td className="px-4 py-2 text-right font-mono">{brl(p.valor_recebido)}</td>
                  <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs ${FIN_STATUS_PARCELA_COR[p.status]}`}>{FIN_STATUS_PARCELA[p.status]}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma parcela.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}