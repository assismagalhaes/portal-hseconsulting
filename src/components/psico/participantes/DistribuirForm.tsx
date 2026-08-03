import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DistribuirForm({ onSubmit }: { onSubmit: (canal: string, obs?: string) => void }) {
  const [canal, setCanal] = useState("whatsapp");
  const [obs, setObs] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <Label>Canal</Label>
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="impresso">Impresso</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Observação (opcional, não incluir dados sensíveis)</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(canal, obs || undefined)}>Registrar</Button>
      </DialogFooter>
    </div>
  );
}