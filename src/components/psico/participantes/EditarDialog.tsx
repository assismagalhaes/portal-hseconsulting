import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ParticipanteRow, editarParticipanteSeguro, isEmailValido, isFoneValido } from "@/lib/psicoParticipantes";

export function EditarDialog({ participante, onOpenChange, onSaved, respondido, distribuido, isAdmin }: {
  participante: ParticipanteRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  respondido: boolean;
  distribuido: boolean;
  isAdmin: boolean;
}) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", funcao: "", setor: "", unidade: "" });
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);
  const open = !!participante;

  useEffect(() => {
    if (participante) {
      setForm({
        nome: participante.nome || "",
        email: participante.email || "",
        telefone: participante.telefone || "",
        funcao: participante.funcao || "",
        setor: participante.setor || "",
        unidade: participante.unidade || "",
      });
      setJustificativa("");
    }
  }, [participante]);

  const contatoAlterado = !!participante && (
    (form.email || "") !== (participante.email || "") ||
    (form.telefone || "") !== (participante.telefone || "") ||
    (form.nome || "") !== (participante.nome || "")
  );
  const segmentacaoAlterada = !!participante && (
    (form.funcao || "") !== (participante.funcao || "") ||
    (form.setor || "") !== (participante.setor || "") ||
    (form.unidade || "") !== (participante.unidade || "")
  );

  const bloqueadoSalvar =
    respondido && (segmentacaoAlterada || (contatoAlterado && !isAdmin));

  async function salvar() {
    if (!participante) return;
    if (!form.nome.trim()) return toast.error("Nome é obrigatório.");
    if (form.email && !isEmailValido(form.email)) return toast.error("E-mail inválido.");
    if (form.telefone && !isFoneValido(form.telefone)) return toast.error("Telefone inválido.");
    if (respondido && contatoAlterado) {
      if (!isAdmin) return toast.error("Somente administradores podem corrigir dados após resposta.");
      if (justificativa.trim().length < 10) return toast.error("Justificativa obrigatória (mínimo 10 caracteres).");
    }
    setSaving(true);
    const { error } = await editarParticipanteSeguro({
      participante_id: participante.id,
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone || null,
      funcao: form.funcao || null,
      setor: form.setor || null,
      unidade: form.unidade || null,
      justificativa: respondido && contatoAlterado ? justificativa : null,
    });
    setSaving(false);
    if (error) return toast.error((error as any).message || "Falha ao salvar.");
    toast.success("Participante atualizado.");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{respondido ? "Corrigir cadastro (participante respondido)" : "Editar participante"}</DialogTitle>
        </DialogHeader>
        {respondido && (
          <div className="text-xs rounded border p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
            Este participante já concluiu o questionário. Função, setor e unidade não podem ser alterados
            pois foram utilizados na consolidação da participação. A correção destes dados serve apenas para
            manutenção do cadastro nominal e não altera o conteúdo ou a segmentação da resposta já enviada.
          </div>
        )}
        {!respondido && distribuido && contatoAlterado && (
          <div className="text-xs rounded border p-2 bg-muted">
            O acesso já foi marcado como distribuído. Confirme se será necessário enviar novamente o link ao participante.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input autoComplete="off" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input autoComplete="off" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div>
            <Label>Função</Label>
            <Input autoComplete="off" disabled={respondido} value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} />
          </div>
          <div>
            <Label>Setor</Label>
            <Input autoComplete="off" disabled={respondido} value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Unidade</Label>
            <Input autoComplete="off" disabled={respondido} value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
          </div>
          {respondido && contatoAlterado && (
            <div className="sm:col-span-2">
              <Label>Justificativa da correção *</Label>
              <Textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">A justificativa não é armazenada em texto — apenas a existência dela é registrada na auditoria.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {(!respondido || isAdmin) && (
            <Button onClick={salvar} disabled={saving || bloqueadoSalvar}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}