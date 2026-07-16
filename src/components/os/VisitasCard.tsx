import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { osVisitaSituacaoLabel } from "@/lib/os";
import { Field } from "./atoms";

export function VisitasCard({ osId, visitas, profs, projRespId, onChange }: any) {
  const [open, setOpen] = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);
  const respName = (id: string) => profs.find((p: any) => p.id === id)?.nome || "—";
  const defaultResp = () => (projRespId && profs.some((p: any) => p.id === projRespId) ? projRespId : "");
  const initial = () => ({ data: today(), hora_inicio: "08:00", hora_fim: "17:00", dia_inteiro: false, objetivo: "", local: "", responsavel_id: defaultResp() });
  const [v, setV] = useState<any>(initial());
  useEffect(() => { if (open) setV(initial()); /* eslint-disable-next-line */ }, [open, projRespId]);
  const add = async () => {
    if (!v.data) return toast.error("Informe a data");
    const payload = {
      os_id: osId,
      data: v.data,
      hora_inicio: v.dia_inteiro ? "00:00" : v.hora_inicio,
      hora_fim: v.dia_inteiro ? "23:59" : v.hora_fim,
      objetivo: v.objetivo,
      local: v.local,
      responsavel_id: v.responsavel_id || null,
    };
    const { error } = await supabase.from("os_visitas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Visita registrada"); setOpen(false); onChange();
  };
  const concluir = async (id: string) => {
    await supabase.from("os_visitas").update({ situacao: "realizada", concluida_em: new Date().toISOString() }).eq("id", id);
    onChange();
  };
  const del = async (id: string) => { await supabase.from("os_visitas").delete().eq("id", id); onChange(); };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Visitas técnicas</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova visita</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova visita</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data"><Input type="date" value={v.data} onChange={e => setV({ ...v, data: e.target.value })} /></Field>
              <Field label="Responsável">
                <Select value={v.responsavel_id} onValueChange={x => setV({ ...v, responsavel_id: x })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{profs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="col-span-2 flex items-center gap-2">
                <input id="dia-inteiro" type="checkbox" className="h-4 w-4" checked={!!v.dia_inteiro} onChange={e => setV({ ...v, dia_inteiro: e.target.checked })} />
                <label htmlFor="dia-inteiro" className="text-sm cursor-pointer select-none">Dia inteiro</label>
              </div>
              {!v.dia_inteiro && <Field label="Hora início"><Input type="time" value={v.hora_inicio} onChange={e => setV({ ...v, hora_inicio: e.target.value })} /></Field>}
              {!v.dia_inteiro && <Field label="Hora fim"><Input type="time" value={v.hora_fim} onChange={e => setV({ ...v, hora_fim: e.target.value })} /></Field>}
              <Field label="Local"><Input value={v.local} onChange={e => setV({ ...v, local: e.target.value })} /></Field>
              <div className="col-span-2"><Field label="Objetivo"><Textarea value={v.objetivo} onChange={e => setV({ ...v, objetivo: e.target.value })} /></Field></div>
            </div>
            <DialogFooter><Button onClick={add}>Salvar visita</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Responsável</TableHead><TableHead>Objetivo</TableHead><TableHead>Situação</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {visitas.map((vi: any) => (
            <TableRow key={vi.id}>
              <TableCell>{formatDate(vi.data)}</TableCell>
              <TableCell className="font-mono text-xs">{vi.hora_inicio?.slice(0, 5)}–{vi.hora_fim?.slice(0, 5)}</TableCell>
              <TableCell>{vi.responsavel_id ? respName(vi.responsavel_id) : "—"}</TableCell>
              <TableCell className="text-sm">{vi.objetivo || "—"}</TableCell>
              <TableCell><Badge variant="secondary">{osVisitaSituacaoLabel[vi.situacao]}</Badge></TableCell>
              <TableCell className="flex gap-1">
                {vi.situacao !== "realizada" && <Button size="sm" variant="ghost" onClick={() => concluir(vi.id)}><CheckCircle2 className="h-4 w-4" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => del(vi.id)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {!visitas.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma visita registrada.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}