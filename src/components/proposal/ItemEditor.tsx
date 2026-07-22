// Editor de um item da proposta.
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bookmark, Calculator, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";
import { statusMargemMeta } from "@/lib/pricing";
import CategoryCombobox from "@/components/CategoryCombobox";

export default function ItemEditor({
  item, pricing, onChange, onRemove, onOpenPricing, onSaveToCatalog, numero,
  isInternal, selected, onSelect, proposalClients, modoFaturamento,
}: any) {
  const [local, setLocal] = useState(item);
  useEffect(() => setLocal(item), [item.id, item.valor_unitario, item.valor_total]);
  const margem = pricing?.indicadores?.status_margem;
  const meta = margem ? statusMargemMeta[margem as keyof typeof statusMargemMeta] : null;
  const showCnpjPicker = modoFaturamento === "por_cnpj" && Array.isArray(proposalClients) && proposalClients.length > 1;
  return (
    <Card className="shadow-elegant">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {isInternal && (
              <div className="pt-2">
                <Checkbox checked={!!selected} onCheckedChange={(v) => onSelect?.(!!v)} aria-label="Selecionar para cálculo em grupo" />
              </div>
            )}
            <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">#{numero ?? item.numero_item}</Badge>
              {item.categoria && <Badge variant="secondary">{item.categoria}</Badge>}
              {meta && <Badge className={`border ${meta.color}`}>{meta.label}</Badge>}
            </div>
            <Input value={local.nome || ""} onChange={(e) => setLocal({ ...local, nome: e.target.value })} onBlur={() => onChange({ nome: local.nome })} className="font-display font-semibold text-base" placeholder="Nome do serviço (ex.: Visita Técnica)" />
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remover item" onClick={onRemove}><Trash2 className="h-4 w-4 text-danger" /></Button>
        </div>
        <div className="space-y-1"><Label className="text-xs">Categoria</Label>
          <CategoryCombobox value={local.categoria || ""} onChange={(v) => { setLocal({ ...local, categoria: v }); onChange({ categoria: v }); }} /></div>
        <div className="space-y-1.5">
          <Label className="text-xs">Descrição comercial (aparece na proposta)</Label>
          <Textarea rows={3} value={local.descricao_comercial || ""} onChange={(e) => setLocal({ ...local, descricao_comercial: e.target.value })} onBlur={() => onChange({ descricao_comercial: local.descricao_comercial })} placeholder="Descrição detalhada do serviço para o cliente" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Entregáveis (um por linha)</Label>
            <Textarea rows={3} value={local.entregaveis || ""} onChange={(e) => setLocal({ ...local, entregaveis: e.target.value })} onBlur={() => onChange({ entregaveis: local.entregaveis })} placeholder={"Relatório técnico\nRegistro dos resultados"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações de escopo (cliente)</Label>
            <Textarea rows={3} value={local.observacoes_escopo || ""} onChange={(e) => setLocal({ ...local, observacoes_escopo: e.target.value })} onBlur={() => onChange({ observacoes_escopo: local.observacoes_escopo })} placeholder="Observações específicas deste serviço" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Quantidade técnica (texto livre, opcional)</Label>
          <Input value={local.quantidade_tecnica || ""} onChange={(e) => setLocal({ ...local, quantidade_tecnica: e.target.value })} onBlur={() => onChange({ quantidade_tecnica: local.quantidade_tecnica })} placeholder="Ex: 8 dosimetrias, 1 unidade avaliada" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1"><Label className="text-xs">Qtd</Label>
            <Input type="number" step="0.01" value={local.quantidade} onChange={(e) => setLocal({ ...local, quantidade: e.target.value })} onBlur={() => onChange({ quantidade: Number(local.quantidade) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Valor unitário</Label>
            <Input type="number" step="0.01" value={local.valor_unitario} onChange={(e) => setLocal({ ...local, valor_unitario: e.target.value })} onBlur={() => onChange({ valor_unitario: Number(local.valor_unitario) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Total</Label>
            <Input disabled value={brl(Number(local.quantidade || 0) * Number(local.valor_unitario || 0))} className="font-mono" /></div>
        </div>
        {showCnpjPicker && (
          <div className="space-y-1 rounded-md bg-muted/40 p-2 border">
            <Label className="text-xs">CNPJ que fatura este item</Label>
            <Select
              value={local.rateado ? "__rateado__" : (local.client_id || "__principal__")}
              onValueChange={(v) => {
                if (v === "__rateado__") {
                  setLocal({ ...local, rateado: true, client_id: null });
                  onChange({ rateado: true, client_id: null });
                } else {
                  const val = v === "__principal__" ? null : v;
                  setLocal({ ...local, client_id: val, rateado: false });
                  onChange({ client_id: val, rateado: false });
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__principal__">Empresa principal (padrão)</SelectItem>
                {proposalClients.map((pc: any) => (
                  <SelectItem key={pc.client_id} value={pc.client_id}>
                    {pc.clients?.nome_fantasia || pc.clients?.razao_social}
                    {pc.papel === "principal" ? " (principal)" : ""}
                  </SelectItem>
                ))}
                <SelectItem value="__rateado__">Rateado entre todas as empresas</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {local.rateado
                ? `Ao aprovar, o valor deste item é dividido igualmente entre as ${proposalClients.length} empresas.`
                : "Ao aprovar, este item entra no contrato do CNPJ selecionado."}
            </p>
          </div>
        )}
        {isInternal && (
          <div className="flex justify-end gap-2">
            {!item.service_id && (
              <Button variant="ghost" size="sm" onClick={onSaveToCatalog}>
                <Bookmark className="h-4 w-4 mr-1" /> Salvar no catálogo
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onOpenPricing}>
              <Calculator className="h-4 w-4 mr-1" /> {pricing ? "Recalcular preço" : "Calcular preço com custos"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}