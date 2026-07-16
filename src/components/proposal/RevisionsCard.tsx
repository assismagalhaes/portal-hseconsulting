// Cartão de revisões da proposta.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Plus } from "lucide-react";
import { brl } from "@/lib/format";

export const REVISAO_STATUS: Record<string, { label: string; color: string }> = {
  rascunho:      { label: "Rascunho",       color: "bg-muted text-foreground" },
  enviada:       { label: "Enviada",        color: "bg-blue-100 text-blue-900" },
  em_negociacao: { label: "Em negociação",  color: "bg-amber-100 text-amber-900" },
  aprovada:      { label: "Aprovada",       color: "bg-emerald-100 text-emerald-900" },
  recusada:      { label: "Recusada",       color: "bg-rose-100 text-rose-900" },
  substituida:   { label: "Substituída",    color: "bg-slate-200 text-slate-700" },
  cancelada:     { label: "Cancelada",      color: "bg-zinc-200 text-zinc-700" },
};

export default function RevisionsCard({ proposalId, valorAtual, revisions, onChanged }: any) {
  const TIPOS: { value: string; label: string }[] = [
    { value: "desconto", label: "Desconto comercial" },
    { value: "alteracao_servicos", label: "Alteração de serviços" },
    { value: "ajuste_tecnico", label: "Ajuste técnico" },
    { value: "renegociacao", label: "Renegociação" },
    { value: "outro", label: "Outro" },
  ];
  const [tipo, setTipo] = useState<string>("desconto");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [valorNovo, setValorNovo] = useState<number>(Number(valorAtual) || 0);
  const temAprovada = revisions.some((r: any) => r.status === "aprovada");

  async function criar() {
    if (!motivo.trim()) { toast.error("Informe o motivo da revisão"); return; }
    const { error } = await supabase.rpc("criar_revisao_proposta", {
      _proposal_id: proposalId,
      _motivo: motivo,
      _observacoes: obs,
      _valor_novo: valorNovo,
      _tipo: tipo,
    });
    if (error) return toast.error(error.message);
    setMotivo(""); setObs("");
    toast.success("Nova revisão registrada");
    onChanged?.();
  }

  async function atualizarStatus(rev: any, status: string) {
    if (rev.status === "aprovada" && status !== "aprovada") {
      toast.error("Revisão aprovada não pode mais ser alterada");
      return;
    }
    const { error } = await supabase.from("proposal_revisions")
      .update({ status }).eq("id", rev.id);
    if (error) return toast.error(error.message);
    toast.success(status === "aprovada" ? "Revisão aprovada — anteriores substituídas, proposta bloqueada" : "Status atualizado");
    onChanged?.();
  }

  return (
    <Card><CardContent className="p-4 space-y-4">
      {temAprovada && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Já existe uma revisão aprovada. A proposta está bloqueada para edição comercial.
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Registrar nova revisão</Label>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Use apenas para eventos relevantes (desconto, alteração de serviços, ajuste técnico, renegociação). Mudanças internas de status (rascunho, enviada, aprovada) não geram revisão.
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo *" /></SelectTrigger>
            <SelectContent>
              {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Motivo / descrição curta *" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Input type="number" step="0.01" placeholder="Novo valor total (R$)" value={valorNovo}
            onChange={(e) => setValorNovo(Number(e.target.value) || 0)} />
        </div>
        <Textarea rows={2} placeholder="Observações internas (não vão para o cliente)" value={obs} onChange={(e) => setObs(e.target.value)} />
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Valor atual da proposta: <span className="font-mono font-semibold">{brl(valorAtual)}</span></span>
          <Button size="sm" onClick={criar} disabled={!motivo.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar revisão
          </Button>
        </div>
      </div>
      <hr />
      {revisions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma revisão registrada ainda.</p>}
      <ul className="space-y-2">
        {revisions.map((r: any) => {
          const meta = REVISAO_STATUS[r.status] || REVISAO_STATUS.rascunho;
          const tipoLabel = (TIPOS.find(t => t.value === r.tipo)?.label)
            || (r.tipo === "emissao_inicial" ? "Emissão inicial" : null);
          const dif = Number(r.diferenca_valor || 0);
          const difPct = Number(r.diferenca_percentual || 0);
          return (
            <li key={r.id} className="border border-border rounded-md p-3 text-sm space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono">Rev. {String(r.revisao).padStart(2, "0")}</Badge>
                  <Badge className={`border-0 ${meta.color}`}>{meta.label}</Badge>
                  {tipoLabel && <Badge variant="secondary" className="text-[10px]">{tipoLabel}</Badge>}
                  <span className="font-medium">{r.titulo || r.motivo || "Revisão"}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </div>
              {(r.valor_anterior != null || r.valor_novo != null) && (
                <div className="text-xs grid sm:grid-cols-3 gap-2">
                  <span><span className="text-muted-foreground">Valor anterior:</span> <span className="font-mono">{brl(r.valor_anterior || 0)}</span></span>
                  <span><span className="text-muted-foreground">Valor novo:</span> <span className="font-mono font-semibold">{brl(r.valor_novo || 0)}</span></span>
                  <span><span className="text-muted-foreground">Diferença:</span> <span className={`font-mono ${dif < 0 ? "text-danger" : dif > 0 ? "text-success" : ""}`}>{brl(dif)} ({difPct.toFixed(1)}%)</span></span>
                </div>
              )}
              {r.motivo && r.motivo !== r.titulo && <p className="text-xs text-muted-foreground"><strong>Motivo:</strong> {r.motivo}</p>}
              {r.descricao && <p className="text-xs text-muted-foreground">{r.descricao}</p>}
              {r.observacoes_internas && <p className="text-xs italic text-muted-foreground">{r.observacoes_internas}</p>}
            </li>
          );
        })}
      </ul>
    </CardContent></Card>
  );
}