// Cartão de edição/cadastro de cliente na tela ProposalEditor.
// Extraído sem alteração de comportamento.
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import CnpjLookupField from "@/components/CnpjLookupField";

export function Field({ label, value, onChange, type = "text", className }: any) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e: any) => onChange(e.target.value)} />
    </div>
  );
}

export default function ClientCard({ client, setClient, onSave }: any) {
  const c = client || {};
  const set = (patch: any) => setClient({ ...c, ...patch });
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Razão social" value={c.razao_social} onChange={(v: any) => set({ razao_social: v })} className="sm:col-span-2" />
        <Field label="Nome fantasia" value={c.nome_fantasia} onChange={(v: any) => set({ nome_fantasia: v })} />
        <CnpjLookupField
          value={c.cnpj_cpf || ""}
          onChange={(v) => set({ cnpj_cpf: v })}
          formSnapshot={c}
          onAutofill={(patch) => setClient({ ...c, ...patch })}
          onExistingClient={(ex) => setClient({ ...ex })}
          ignoreClientId={c.id || null}
          ultimaConsulta={c.ultima_consulta_cnpj}
          label="CNPJ / CPF"
          compact
        />
        <Field label="Qtd. funcionários" type="number" value={c.qtd_funcionarios} onChange={(v: any) => set({ qtd_funcionarios: v })} />
        <Field label="Endereço" value={c.endereco} onChange={(v: any) => set({ endereco: v })} className="sm:col-span-2" />
        <Field label="Bairro" value={c.bairro} onChange={(v: any) => set({ bairro: v })} />
        <Field label="CEP" value={c.cep} onChange={(v: any) => set({ cep: v })} />
        <Field label="Cidade" value={c.cidade} onChange={(v: any) => set({ cidade: v })} />
        <Field label="UF" value={c.uf} onChange={(v: any) => set({ uf: (v || "").toUpperCase().slice(0, 2) })} />
        <Field label="Solicitante" value={c.solicitante} onChange={(v: any) => set({ solicitante: v })} />
        <Field label="Cargo" value={c.cargo} onChange={(v: any) => set({ cargo: v })} />
        <Field label="Telefone" value={c.telefone} onChange={(v: any) => set({ telefone: v })} />
        <Field label="WhatsApp" value={c.whatsapp} onChange={(v: any) => set({ whatsapp: v })} />
        <Field label="E-mail" type="email" value={c.email} onChange={(v: any) => set({ email: v })} className="sm:col-span-2" />
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Observações internas</Label>
          <Textarea rows={2} value={c.observacoes || ""} onChange={(e) => set({ observacoes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2">
        <p className="text-xs text-muted-foreground">
          {c.id ? "Atualiza o cadastro existente." : "Será cadastrado automaticamente ao salvar (identificador: CNPJ/CPF)."}
        </p>
        <Button onClick={() => onSave(c)}><Save className="h-4 w-4 mr-1" /> Salvar cliente</Button>
      </div>
    </CardContent></Card>
  );
}