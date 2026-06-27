import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { ETAPAS, etapaColor, TEMPERATURAS } from "@/lib/crm";
import { brl, prioridadeColor } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CrmPipeline() {
  const [oports, setOports] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<any[]>([]);
  const [perdaModal, setPerdaModal] = useState<{ op: any; etapa: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => { document.title = "Pipeline | CRM HSE"; reload(); }, []);
  async function reload() {
    const [o, m] = await Promise.all([
      supabase.from("crm_oportunidades").select("*"),
      supabase.from("crm_motivos_perda").select("*").eq("ativo", true).order("ordem"),
    ]);
    setOports(o.data||[]); setMotivos(m.data||[]);
  }

  async function moveCard(op: any, novaEtapa: string) {
    if (op.etapa === novaEtapa) return;
    if (novaEtapa === "perdido") {
      setPerdaModal({ op, etapa: novaEtapa });
      setMotivo(""); setObs("");
      return;
    }
    const { error } = await supabase.from("crm_oportunidades").update({ etapa: novaEtapa }).eq("id", op.id);
    if (error) toast.error(error.message);
    else { toast.success("Movido"); reload(); }
  }

  async function confirmPerda() {
    if (!motivo) return toast.error("Selecione o motivo da perda");
    const { error } = await supabase.from("crm_oportunidades")
      .update({ etapa: "perdido", motivo_perda: motivo, motivo_perda_obs: obs })
      .eq("id", perdaModal!.op.id);
    if (error) toast.error(error.message);
    else { toast.success("Oportunidade marcada como perdida"); setPerdaModal(null); reload(); }
  }

  function onDragStart(e: React.DragEvent, op: any) {
    e.dataTransfer.setData("application/json", JSON.stringify(op));
    e.dataTransfer.effectAllowed = "move";
  }
  function onDrop(e: React.DragEvent, etapa: string) {
    e.preventDefault();
    const op = JSON.parse(e.dataTransfer.getData("application/json"));
    moveCard(op, etapa);
  }

  return (
    <div>
      <PageHeader title="Pipeline comercial" subtitle="Arraste os cards entre as etapas" />
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {ETAPAS.map(et => {
            const items = oports.filter(o => o.etapa === et.value);
            const total = items.reduce((s,o)=>s+Number(o.valor_estimado||0),0);
            return (
              <div key={et.value}
                onDragOver={(e)=>e.preventDefault()}
                onDrop={(e)=>onDrop(e, et.value)}
                className="w-72 shrink-0 rounded-lg bg-muted/40 border border-border">
                <div className={`px-3 py-2 rounded-t-lg flex items-center justify-between ${et.color}`}>
                  <span className="font-semibold text-sm">{et.label}</span>
                  <span className="text-xs">{items.length}</span>
                </div>
                <div className="px-3 py-1 text-xs text-muted-foreground border-b">{brl(total)}</div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {items.map(op => {
                    const temp = TEMPERATURAS.find(t=>t.value===op.temperatura);
                    return (
                      <Card key={op.id} draggable onDragStart={(e)=>onDragStart(e, op)}
                        className="p-2.5 cursor-move hover:shadow-md transition-shadow">
                        <div className="font-medium text-sm leading-tight">{op.titulo}</div>
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${temp?.color}`}>{temp?.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${prioridadeColor[op.prioridade]}`}>{op.prioridade}</span>
                        </div>
                        <div className="mt-2 flex justify-between items-end">
                          <div className="text-xs font-mono">{brl(op.valor_estimado)}</div>
                          <div className="text-[10px] text-muted-foreground">{op.probabilidade}%</div>
                        </div>
                      </Card>
                    );
                  })}
                  {items.length === 0 && <div className="text-center text-xs text-muted-foreground py-6">Sem cards</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!perdaModal} onOpenChange={(o)=>{ if (!o) setPerdaModal(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como perdida</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Motivo da perda *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue placeholder="Selecione…"/></SelectTrigger>
                <SelectContent>{motivos.map(m=><SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observação complementar</Label>
              <Textarea rows={3} value={obs} onChange={e=>setObs(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setPerdaModal(null)}>Cancelar</Button>
              <Button onClick={confirmPerda}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
