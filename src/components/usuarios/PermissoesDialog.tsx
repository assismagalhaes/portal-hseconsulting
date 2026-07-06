import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Tipo = "ver_financeiro" | "ver_comercial" | "acessar_projeto" | "aprovar_documentos";
const tipoLabel: Record<Tipo, string> = {
  ver_financeiro: "Ver módulo Financeiro",
  ver_comercial: "Ver CRM / Propostas",
  acessar_projeto: "Acessar projeto específico",
  aprovar_documentos: "Aprovar documentos técnicos",
};

type Row = {
  id: string; user_id: string; tipo: Tipo; recurso_id: string | null;
  ativo: boolean; motivo: string | null; expira_em: string | null;
};

export default function PermissoesDialog({
  open, onOpenChange, user,
}: { open: boolean; onOpenChange: (v: boolean) => void; user: { id: string; nome: string | null; email: string | null } | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [projetos, setProjetos] = useState<{ id: string; numero: string | null; titulo: string | null }[]>([]);
  const [novo, setNovo] = useState<{ tipo: Tipo; recurso_id: string; motivo: string; expira_em: string }>(
    { tipo: "ver_financeiro", recurso_id: "", motivo: "", expira_em: "" }
  );

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_permission_overrides")
      .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data || []) as any);
    const { data: prjs } = await supabase.from("projetos").select("id, numero, titulo").order("numero");
    setProjetos((prjs || []) as any);
  };
  useEffect(() => { if (open) load(); }, [open, user?.id]);

  const add = async () => {
    if (!user) return;
    if (novo.tipo === "acessar_projeto" && !novo.recurso_id) return toast.error("Selecione o projeto");
    const payload: any = {
      user_id: user.id, tipo: novo.tipo, ativo: true,
      recurso_id: novo.tipo === "acessar_projeto" ? novo.recurso_id : null,
      motivo: novo.motivo || null,
      expira_em: novo.expira_em ? new Date(novo.expira_em).toISOString() : null,
      concedido_por: (await supabase.auth.getUser()).data.user?.id,
    };
    const { error } = await supabase.from("user_permission_overrides").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Permissão concedida");
    setNovo({ tipo: "ver_financeiro", recurso_id: "", motivo: "", expira_em: "" });
    load();
  };

  const toggle = async (r: Row) => {
    const { error } = await supabase.from("user_permission_overrides")
      .update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (r: Row) => {
    if (!confirm("Revogar esta permissão?")) return;
    const { error } = await supabase.from("user_permission_overrides").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Permissão revogada");
    load();
  };

  const projLabel = (id: string | null) => {
    if (!id) return "—";
    const p = projetos.find((x) => x.id === id);
    return p ? `${p.numero || ""} ${p.titulo || ""}`.trim() : id.slice(0, 8);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Permissões de {user?.nome || user?.email}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <div className="text-sm font-medium">Conceder nova permissão</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={novo.tipo} onValueChange={(v: Tipo) => setNovo({ ...novo, tipo: v, recurso_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {novo.tipo === "acessar_projeto" && (
                <div>
                  <Label>Projeto</Label>
                  <Select value={novo.recurso_id} onValueChange={(v) => setNovo({ ...novo, recurso_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2"><Label>Motivo</Label><Input value={novo.motivo} onChange={(e) => setNovo({ ...novo, motivo: e.target.value })} placeholder="Ex.: apoio pontual ao projeto X" /></div>
              <div><Label>Expira em (opcional)</Label><Input type="date" value={novo.expira_em} onChange={(e) => setNovo({ ...novo, expira_em: e.target.value })} /></div>
            </div>
            <Button size="sm" onClick={add}><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
          </div>

          <div className="rounded-lg border">
            <div className="px-3 py-2 text-sm font-medium border-b bg-muted/20">Permissões ativas</div>
            {rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma exceção concedida.</div>}
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0 gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{tipoLabel[r.tipo]}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.tipo === "acessar_projeto" && <span>Projeto: {projLabel(r.recurso_id)} · </span>}
                    {r.motivo || "sem motivo informado"}
                    {r.expira_em && <span> · expira {new Date(r.expira_em).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge>
                  <Switch checked={r.ativo} onCheckedChange={() => toggle(r)} />
                  <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}