import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function RevogarForm({ label = "Motivo", onSubmit }: { label?: string; onSubmit: (m: string) => void }) {
  const [m, setM] = useState("");
  return (
    <div className="space-y-3">
      <div><Label>{label} *</Label><Textarea rows={3} value={m} onChange={(e) => setM(e.target.value)} /></div>
      <DialogFooter>
        <Button onClick={() => { if (!m.trim()) return toast.error("Informe o motivo"); onSubmit(m); }}>Confirmar</Button>
      </DialogFooter>
    </div>
  );
}