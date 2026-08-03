// Cartão de datas e origem do cadastro da proposta.
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { proposalOrigemColor, proposalOrigemLabel, formatDateTime } from "@/lib/format";

export default function DatesCard({ proposal, onSave }: any) {
  const isRetro = proposal.origem_cadastro === "retroativa" || proposal.origem_cadastro === "importacao_manual";
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Badge className={(proposalOrigemColor[proposal.origem_cadastro] || "") + " border-0"} variant="secondary">
          {proposalOrigemLabel[proposal.origem_cadastro] || "—"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Cadastrada em {formatDateTime(proposal.created_at)}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Origem do cadastro <span className="text-danger">*</span></Label>
          <Select value={proposal.origem_cadastro} onValueChange={(v) => onSave({ origem_cadastro: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(proposalOrigemLabel).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de emissão original <span className="text-danger">*</span></Label>
          <Input type="date" value={proposal.data_emissao || ""} onChange={(e) => onSave({ data_emissao: e.target.value || null })} />
          <p className="text-[11px] text-muted-foreground">Referência principal nos relatórios comerciais.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de envio ao cliente</Label>
          <Input type="date" value={proposal.data_envio || ""} onChange={(e) => onSave({ data_envio: e.target.value || null })} />
          <p className="text-[11px] text-muted-foreground">Se vazio, assume a data de emissão.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Data de aprovação {proposal.status === "aprovada" && <span className="text-danger">*</span>}
          </Label>
          <Input type="date" value={proposal.data_aprovacao || ""} onChange={(e) => onSave({ data_aprovacao: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Data de recusa / cancelamento {["recusada", "cancelada"].includes(proposal.status) && <span className="text-danger">*</span>}
          </Label>
          <Input type="date" value={proposal.data_recusa || ""} onChange={(e) => onSave({ data_recusa: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de cadastro no sistema</Label>
          <Input disabled value={formatDateTime(proposal.created_at)} />
        </div>
      </div>

      {isRetro && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Observação retroativa</Label>
            {!proposal.observacao_retroativa && (
              <Button variant="ghost" size="sm" onClick={() => onSave({ observacao_retroativa: "Proposta cadastrada retroativamente para alimentação inicial do sistema. Data de emissão baseada no documento comercial original." })}>
                Sugerir texto padrão
              </Button>
            )}
          </div>
          <Textarea rows={3} value={proposal.observacao_retroativa || ""}
            onChange={(e) => onSave({ observacao_retroativa: e.target.value })}
            placeholder="Justificativa do cadastro retroativo (apenas auditoria interna — não vai no PDF do cliente)." />
        </div>
      )}
    </CardContent></Card>
  );
}