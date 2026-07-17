import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, formatDate } from "@/lib/format";
import { FIN_STATUS_CONTRATO, FIN_STATUS_CONTRATO_COR, FIN_STATUS_PARCELA, FIN_STATUS_PARCELA_COR, FIN_FORMA_PAGAMENTO, calcMargem, margemIndicador } from "@/lib/financeiro";
import { Plus, ArrowLeft, Trash2, Receipt, Upload } from "lucide-react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

export default function ContratoEditor() {
  const { id } = useParams();
  const [contrato, setContrato] = useState<any>(null);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [recebs, setRecebs] = useState<any[]>([]);
  const [custos, setCustos] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [openParc, setOpenParc] = useState(false);
  const [openRec, setOpenRec] = useState<any>(null);
  const [openMarco, setOpenMarco] = useState<any>(null);
  const [marcoData, setMarcoData] = useState(new Date().toISOString().slice(0,10));

  const [newP, setNewP] = useState({ numero: 1, descricao: "", valor: 0, data_vencimento: "" });
  const [rec, setRec] = useState({ valor: 0, data_recebimento: new Date().toISOString().slice(0,10), forma_pagamento: "pix", conta_recebimento: "", observacoes: "" });

  const load = async () => {
    const { data: c } = await supabase.from("financeiro_contratos").select("*, clients(razao_social, nome_fantasia), proposals(numero, titulo, valor_total)").eq("id", id).maybeSingle();
    setContrato(c);
    const [p, r, k] = await Promise.all([
      supabase.from("financeiro_parcelas").select("*").eq("contrato_id", id).order("numero"),
      supabase.from("financeiro_recebimentos").select("*").eq("contrato_id", id).order("data_recebimento", { ascending: false }),
      supabase.from("financeiro_custos").select("*").eq("proposal_id", c?.proposal_id).order("data", { ascending: false }),
    ]);
    setParcelas(p.data||[]); setRecebs(r.data||[]); setCustos(k.data||[]);
    if (c?.proposal_id) {
      const { data: items } = await supabase.from("proposal_items").select("id").eq("proposal_id", c.proposal_id);
      const ids = (items||[]).map((i:any)=>i.id);
      if (ids.length) {
        const { data: pr } = await supabase.from("proposal_item_pricing").select("*").in("proposal_item_id", ids);
        setPricing(pr||[]);
      }
    }
  };
  useEffect(() => { if (id) load(); }, [id]);

  const adicionarParcela = async () => {
    const num = (parcelas.at(-1)?.numero || 0) + 1;
    const { error } = await supabase.from("financeiro_parcelas").insert({
      contrato_id: id, proposal_id: contrato.proposal_id, client_id: contrato.client_id,
      numero: newP.numero || num, descricao: newP.descricao, valor: newP.valor, data_vencimento: newP.data_vencimento,
    });
    if (error) return toast.error(error.message);
    toast.success("Parcela adicionada"); setOpenParc(false); setNewP({ numero: num+1, descricao: "", valor: 0, data_vencimento: "" }); load();
  };

  const removerParcela = async (pid: string) => {
    if (!confirm("Excluir parcela?")) return;
    await supabase.from("financeiro_parcelas").delete().eq("id", pid);
    load();
  };

  const ativarParcela = async () => {
    if (!openMarco) return;
    const { error } = await supabase.from("financeiro_parcelas")
      .update({ status: "a_vencer", data_vencimento: marcoData })
      .eq("id", openMarco.id);
    if (error) return toast.error(error.message);
    toast.success("Marco confirmado — parcela liberada para cobrança");
    setOpenMarco(null);
    load();
  };

  const registrarRecebimento = async () => {
    const { error } = await supabase.rpc("financeiro_registrar_recebimento", {
      _parcela_id: openRec.id, _valor: Number(rec.valor), _data: rec.data_recebimento,
      _forma: rec.forma_pagamento as any, _conta: rec.conta_recebimento, _comprovante: null, _obs: rec.observacoes,
    });
    if (error) return toast.error(error.message);
    toast.success("Recebimento registrado"); setOpenRec(null); load();
  };

  const updateStatusContrato = async (status: string) => {
    await supabase.from("financeiro_contratos").update({ status: status as any }).eq("id", id);
    load();
  };

  if (!contrato) return <div className="p-6"><p>Carregando…</p></div>;

  const cliente = contrato.clients?.nome_fantasia || contrato.clients?.razao_social || "—";
  const custoPrevisto = pricing.reduce((s,p:any)=>s+Number(p.custo_total||0),0);
  const custoReal = custos.reduce((s,k)=>s+Number(k.valor||0),0);
  const receita = Number(contrato.valor_aprovado||0);
  const margemPrev = calcMargem(receita, custoPrevisto);
  const margemReal = calcMargem(receita, custoReal);
  const indReal = margemIndicador(margemReal);

  return (
    <div>
      <PageHeader title={contrato.numero || "Contrato"} subtitle={`${cliente} · ${contrato.titulo || ""}`}
        actions={<div className="flex gap-2">
          <Link to="/financeiro/contratos"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1"/>Voltar</Button></Link>
          <Select value={contrato.status} onValueChange={updateStatusContrato}>
            <SelectTrigger className="w-[220px]"><SelectValue/></SelectTrigger>
            <SelectContent>{Object.entries(FIN_STATUS_CONTRATO).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>} />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi label="Valor aprovado" value={brl(receita)} />
          <Kpi label="Recebido" value={brl(contrato.valor_recebido)} />
          <Kpi label="Saldo" value={brl(receita - Number(contrato.valor_recebido||0))} />
          <Kpi label="Status" value={<span className={`inline-block px-2 py-0.5 rounded text-xs ${FIN_STATUS_CONTRATO_COR[contrato.status]}`}>{FIN_STATUS_CONTRATO[contrato.status]}</span>} />
        </div>

        <Tabs defaultValue="parcelas">
          <TabsList>
            <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
            <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
            <TabsTrigger value="custos">Custos & Margem</TabsTrigger>
          </TabsList>

          <TabsContent value="parcelas" className="space-y-3">
            <div className="flex justify-end">
              <Dialog open={openParc} onOpenChange={setOpenParc}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Nova parcela</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova parcela</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Número</Label><Input type="number" value={newP.numero} onChange={e=>setNewP({...newP, numero: Number(e.target.value)})} /></div>
                      <div><Label>Vencimento</Label><Input type="date" value={newP.data_vencimento} onChange={e=>setNewP({...newP, data_vencimento: e.target.value})} /></div>
                    </div>
                    <div><Label>Descrição</Label><Input value={newP.descricao} onChange={e=>setNewP({...newP, descricao: e.target.value})} /></div>
                    <div><Label>Valor</Label><Input type="number" step="0.01" value={newP.valor} onChange={e=>setNewP({...newP, valor: Number(e.target.value)})} /></div>
                  </div>
                  <DialogFooter><Button onClick={adicionarParcela}>Salvar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left px-4 py-2">#</th><th className="text-left px-4 py-2">Descrição</th><th className="text-left px-4 py-2">Vencimento</th><th className="text-right px-4 py-2">Valor</th><th className="text-right px-4 py-2">Recebido</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Ações</th></tr>
                </thead>
                <tbody>
                  {parcelas.map(p => (
                    <tr key={p.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono">{p.numero}</td>
                      <td className="px-4 py-2">{p.descricao || "—"}</td>
                      <td className="px-4 py-2">{formatDate(p.data_vencimento)}</td>
                      <td className="px-4 py-2 text-right font-mono">{brl(p.valor)}</td>
                      <td className="px-4 py-2 text-right font-mono text-emerald-700">{brl(p.valor_recebido)}</td>
                      <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs ${FIN_STATUS_PARCELA_COR[p.status]}`}>{FIN_STATUS_PARCELA[p.status]}</span></td>
                      <td className="px-4 py-2 flex gap-1">
                        {p.status === "aguardando_evento" && (
                          <Button size="sm" variant="outline" onClick={() => { setMarcoData(new Date().toISOString().slice(0,10)); setOpenMarco(p); }}>
                            <CalendarClock className="h-3 w-3 mr-1"/>Confirmar marco
                          </Button>
                        )}
                        {p.status !== "recebida" && p.status !== "cancelada" && (
                          <Button size="sm" variant="outline" onClick={()=>{ setRec({ ...rec, valor: Number(p.valor) - Number(p.valor_recebido||0) }); setOpenRec(p); }}>
                            <Receipt className="h-3 w-3 mr-1"/>Receber
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" aria-label="Remover parcela" onClick={()=>removerParcela(p.id)}><Trash2 className="h-3 w-3"/></Button>
                      </td>
                    </tr>
                  ))}
                  {parcelas.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma parcela.</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="recebimentos">
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="text-left px-4 py-2">Data</th><th className="text-right px-4 py-2">Valor</th><th className="text-left px-4 py-2">Forma</th><th className="text-left px-4 py-2">Conta</th><th className="text-left px-4 py-2">Obs.</th></tr></thead>
                <tbody>
                  {recebs.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">{formatDate(r.data_recebimento)}</td>
                      <td className="px-4 py-2 text-right font-mono">{brl(r.valor)}</td>
                      <td className="px-4 py-2">{FIN_FORMA_PAGAMENTO[r.forma_pagamento] || "—"}</td>
                      <td className="px-4 py-2">{r.conta_recebimento || "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.observacoes || "—"}</td>
                    </tr>
                  ))}
                  {recebs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sem recebimentos.</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="custos" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <Kpi label="Custo previsto" value={brl(custoPrevisto)} />
              <Kpi label="Custo realizado" value={brl(custoReal)} />
              <Kpi label="Margem prevista" value={`${margemPrev.toFixed(1)}%`} />
              <Kpi label="Margem real" value={`${margemReal.toFixed(1)}% ${indReal.emoji}`} hint={indReal.label} />
            </div>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="text-left px-4 py-2">Data</th><th className="text-left px-4 py-2">Tipo</th><th className="text-left px-4 py-2">Descrição</th><th className="text-right px-4 py-2">Valor</th></tr></thead>
                <tbody>
                  {custos.map(k => (
                    <tr key={k.id} className="border-t">
                      <td className="px-4 py-2">{formatDate(k.data)}</td>
                      <td className="px-4 py-2">{k.tipo}</td>
                      <td className="px-4 py-2">{k.descricao}</td>
                      <td className="px-4 py-2 text-right font-mono">{brl(k.valor)}</td>
                    </tr>
                  ))}
                  {custos.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum custo realizado. Lance em <Link className="text-primary underline" to="/financeiro/custos">Custos</Link>.</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!openRec} onOpenChange={(o)=>!o && setOpenRec(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar recebimento — Parcela #{openRec?.numero}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor</Label><Input type="number" step="0.01" value={rec.valor} onChange={e=>setRec({...rec, valor: Number(e.target.value)})} /></div>
                <div><Label>Data</Label><Input type="date" value={rec.data_recebimento} onChange={e=>setRec({...rec, data_recebimento: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Forma</Label>
                  <Select value={rec.forma_pagamento} onValueChange={v=>setRec({...rec, forma_pagamento: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(FIN_FORMA_PAGAMENTO).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Conta</Label><Input value={rec.conta_recebimento} onChange={e=>setRec({...rec, conta_recebimento: e.target.value})} /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={rec.observacoes} onChange={e=>setRec({...rec, observacoes: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={registrarRecebimento}><Receipt className="h-4 w-4 mr-1"/>Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!openMarco} onOpenChange={(o)=>!o && setOpenMarco(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Confirmar ocorrência do marco — Parcela #{openMarco?.numero}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Esta parcela estava vinculada a um evento (emissão de NF, início/conclusão de serviço etc.). Informe o novo vencimento a partir do qual o cliente pode ser cobrado.
              </p>
              <div><Label>Nova data de vencimento</Label>
                <Input type="date" value={marcoData} onChange={e=>setMarcoData(e.target.value)} />
              </div>
            </div>
            <DialogFooter><Button onClick={ativarParcela}><CalendarClock className="h-4 w-4 mr-1"/>Confirmar marco</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: any) {
  return <Card className="p-4"><div className="text-xs text-muted-foreground uppercase">{label}</div><div className="text-xl font-display font-bold mt-1">{value}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</Card>;
}