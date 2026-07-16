import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save } from "lucide-react";
import { Field } from "./atoms";

export function LogisticaCard({ osId, logistica, onChange }: any) {
  const [f, setF] = useState<any>(logistica || {});
  useEffect(() => setF(logistica || {}), [logistica]);
  const save = async () => {
    const payload = { ...f, os_id: osId };
    if (logistica?.id) {
      const { error } = await supabase.from("os_logistica").update(payload).eq("id", logistica.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("os_logistica").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Logística salva"); onChange();
  };
  const fld = (k: string, label: string, type = "text") =>
    <Field label={label}><Input type={type} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })} /></Field>;
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Logística e deslocamento</div>
      <div className="grid md:grid-cols-3 gap-3">
        {fld("cidade", "Cidade")}{fld("endereco", "Endereço")}{fld("veiculo", "Veículo")}
        {fld("distancia_km", "Distância (km)", "number")}{fld("tempo_estimado_min", "Tempo estimado (min)", "number")}{fld("motorista", "Motorista")}
        {fld("hospedagem", "Hospedagem")}{fld("alimentacao", "Alimentação")}
        {fld("pedagios", "Pedágios (R$)", "number")}{fld("combustivel", "Combustível (R$)", "number")}
      </div>
      <Field label="Observações"><Textarea value={f.observacoes ?? ""} onChange={e => setF({ ...f, observacoes: e.target.value })} /></Field>
      <Button onClick={save}><Save className="h-4 w-4 mr-2" />Salvar logística</Button>
    </CardContent></Card>
  );
}