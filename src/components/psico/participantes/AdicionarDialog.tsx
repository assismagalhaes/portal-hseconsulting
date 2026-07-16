import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { criarParticipante, isEmailValido, isFoneValido } from "@/lib/psicoParticipantes";

export function AdicionarDialog({ open, onOpenChange, avaliacaoId, onSaved, sugestoes }: {
  open: boolean; onOpenChange: (v: boolean) => void; avaliacaoId: string; onSaved: () => void;
  sugestoes: { funcao: string[]; setor: string[]; unidade: string[] };
}) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", funcao: "", setor: "", unidade: "" });
  useEffect(() => { if (!open) setForm({ nome: "", email: "", telefone: "", funcao: "", setor: "", unidade: "" }); }, [open]);
  async function salvar() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (form.email && !isEmailValido(form.email)) return toast.error("E-mail inválido");
    if (form.telefone && !isFoneValido(form.telefone)) return toast.error("Telefone com número de dígitos incompatível");
    const { error } = await criarParticipante({
      avaliacao_id: avaliacaoId,
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone || null,
      funcao: form.funcao || null,
      setor: form.setor || null,
      unidade: form.unidade || null,
      origem_cadastro: "manual",
    });
    if (error) return toast.error((error as any).message || "Falha ao cadastrar");
    toast.success("Participante cadastrado.");
    onOpenChange(false);
    onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar participante</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
          <div><Label>Função</Label><Input list="fs-funcao" value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} />
            <datalist id="fs-funcao">{sugestoes.funcao.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div><Label>Setor</Label><Input list="fs-setor" value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
            <datalist id="fs-setor">{sugestoes.setor.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div className="sm:col-span-2"><Label>Unidade</Label><Input list="fs-unidade" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            <datalist id="fs-unidade">{sugestoes.unidade.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Cadastro sem e-mail e sem telefone é permitido — o link poderá ser distribuído manualmente.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}