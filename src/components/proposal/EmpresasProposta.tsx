import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Trash2, Star, ArrowUpDown, Search, Check, X } from "lucide-react";
import { formatCnpjCpf } from "@/lib/format";
import { toast } from "sonner";

type ProposalClient = {
  id: string;
  proposal_id: string;
  client_id: string;
  papel: "principal" | "coligada";
  ordem: number;
  observacao: string | null;
  clients?: any;
};

type Props = {
  proposalId: string;
  proposal?: any;
  onProposalPatch?: (patch: any) => Promise<void> | void;
  onChange?: () => void;
};

export default function EmpresasProposta({ proposalId, proposal, onProposalPatch, onChange }: Props) {
  const [rows, setRows] = useState<ProposalClient[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const [pc, cl] = await Promise.all([
      supabase.from("proposal_clients")
        .select("*, clients(id,razao_social,nome_fantasia,cnpj_cpf,cidade,uf)")
        .eq("proposal_id", proposalId)
        .order("papel", { ascending: true }) // principal antes
        .order("ordem", { ascending: true }),
      supabase.from("clients").select("id,razao_social,nome_fantasia,cnpj_cpf,cidade,uf").order("razao_social"),
    ]);
    setRows((pc.data as any) || []);
    setAllClients(cl.data || []);
  }
  useEffect(() => { load(); }, [proposalId]);

  const usedIds = new Set(rows.map(r => r.client_id));
  const filtered = allClients
    .filter(c => !usedIds.has(c.id))
    .filter(c => {
      if (!query) return true;
      const q = query.toLowerCase();
      return [c.razao_social, c.nome_fantasia, c.cnpj_cpf].some(v => (v || "").toLowerCase().includes(q));
    });

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function addColigadasSelecionadas() {
    if (selected.size === 0) return;
    setBusy(true);
    const baseOrdem = rows.filter(r => r.papel === "coligada").length;
    const ids = Array.from(selected);
    const payload = ids.map((client_id, i) => ({
      proposal_id: proposalId, client_id, papel: "coligada" as const, ordem: baseOrdem + i + 1,
    }));
    const { error } = await supabase.from("proposal_clients").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    setPickerOpen(false); setQuery("");
    await load(); onChange?.();
    toast.success(ids.length > 1 ? `${ids.length} empresas coligadas adicionadas` : "Empresa coligada adicionada");
  }

  function handlePickerOpen(o: boolean) {
    setPickerOpen(o);
    if (!o) { setSelected(new Set()); setQuery(""); }
  }

  async function remove(row: ProposalClient) {
    if (row.papel === "principal") {
      return toast.error("Não é possível remover a empresa principal. Torne outra a principal antes.");
    }
    setBusy(true);
    const { error } = await supabase.from("proposal_clients").delete().eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await load(); onChange?.();
  }

  async function tornarPrincipal(row: ProposalClient) {
    if (row.papel === "principal") return;
    setBusy(true);
    // trocar em 2 passos evita colisão com o índice único parcial
    const principalAtual = rows.find(r => r.papel === "principal");
    if (principalAtual) {
      const { error: e1 } = await supabase.from("proposal_clients")
        .update({ papel: "coligada" }).eq("id", principalAtual.id);
      if (e1) { setBusy(false); return toast.error(e1.message); }
    }
    const { error: e2 } = await supabase.from("proposal_clients")
      .update({ papel: "principal" }).eq("id", row.id);
    setBusy(false);
    if (e2) return toast.error(e2.message);
    await load(); onChange?.();
    toast.success("Empresa principal atualizada — o faturamento passará a usar este CNPJ.");
  }

  async function updateObs(row: ProposalClient, observacao: string) {
    await supabase.from("proposal_clients").update({ observacao }).eq("id", row.id);
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, observacao } : r));
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Empresas do orçamento</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quando o cliente tem mais de um CNPJ (grupo econômico) e prefere receber tudo em uma proposta só.
            A empresa <strong>principal</strong> responde pelo faturamento — as coligadas aparecem no cabeçalho do PDF e do aceite.
          </p>
        </div>
        <Dialog open={pickerOpen} onOpenChange={handlePickerOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Adicionar coligada</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="flex items-center gap-2 font-display">
                <Building2 className="h-5 w-5 text-primary" /> Adicionar empresas ao grupo econômico
              </DialogTitle>
              <DialogDescription>
                Selecione uma ou mais empresas coligadas já cadastradas. A empresa principal permanece como responsável pelo faturamento.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-3 border-b bg-muted/30">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por razão social, nome fantasia ou CNPJ…"
                  className="pl-9 h-10"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{filtered.length} {filtered.length === 1 ? "empresa disponível" : "empresas disponíveis"}</span>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Limpar seleção ({selected.size})
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-6 py-12 text-sm text-muted-foreground text-center">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {query
                    ? <>Nenhuma empresa encontrada para <span className="font-medium">"{query}"</span>.</>
                    : <>Nenhuma empresa disponível. Cadastre em <span className="font-medium">Clientes</span> antes de vincular.</>}
                </div>
              )}
              <div className="divide-y">
                {filtered.map(c => {
                  const isSel = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleSelect(c.id)}
                      className={`w-full text-left px-6 py-3 flex items-center gap-3 transition ${
                        isSel ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`h-5 w-5 shrink-0 rounded border flex items-center justify-center transition ${
                        isSel ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"
                      }`}>
                        {isSel && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{c.nome_fantasia || c.razao_social}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.nome_fantasia && c.razao_social ? c.razao_social + " · " : ""}
                          <span className="font-mono">{formatCnpjCpf(c.cnpj_cpf || "")}</span>
                          {c.cidade ? ` · ${c.cidade}/${c.uf || ""}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/30 gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => handlePickerOpen(false)} disabled={busy}>Cancelar</Button>
              <Button onClick={addColigadasSelecionadas} disabled={busy || selected.size === 0}>
                <Plus className="h-4 w-4 mr-1" />
                {selected.size === 0
                  ? "Selecione ao menos uma empresa"
                  : selected.size === 1
                    ? "Adicionar 1 empresa"
                    : `Adicionar ${selected.size} empresas`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {proposal && onProposalPatch && (
        <div className="rounded-md border p-3 bg-muted/30 space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Modo de faturamento ao aprovar</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onProposalPatch({ modo_faturamento: "unico" })}
              className={`text-left rounded-md border p-3 transition ${
                (proposal.modo_faturamento || "unico") === "unico"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              }`}
            >
              <div className="font-medium text-sm">Único contrato no principal</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                A empresa principal fatura tudo. NF única. Coligadas aparecem só no PDF.
              </div>
            </button>
            <button
              type="button"
              onClick={() => onProposalPatch({ modo_faturamento: "por_cnpj" })}
              className={`text-left rounded-md border p-3 transition ${
                proposal.modo_faturamento === "por_cnpj"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              }`}
              disabled={rows.filter(r => r.papel === "coligada").length === 0}
            >
              <div className="font-medium text-sm">Um contrato por CNPJ</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Cada empresa recebe seu contrato/NF. Defina o CNPJ que fatura em cada item.
              </div>
              {rows.filter(r => r.papel === "coligada").length === 0 && (
                <div className="text-[10px] text-warning mt-1">Adicione ao menos uma coligada.</div>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground italic">
            Nenhuma empresa vinculada ainda. O cliente principal da proposta é definido na aba <em>Cliente</em>.
          </div>
        )}
        {rows.map(r => (
          <div
            key={r.id}
            className={`rounded-md border p-3 flex flex-wrap items-start justify-between gap-3 ${r.papel === "principal" ? "border-primary/40 bg-primary/5" : "bg-muted/30"}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {r.papel === "principal"
                  ? <Badge className="bg-primary text-primary-foreground border-0"><Star className="h-3 w-3 mr-1" /> Principal (faturamento)</Badge>
                  : <Badge variant="secondary">Coligada</Badge>}
              </div>
              <div className="font-medium">{r.clients?.nome_fantasia || r.clients?.razao_social || "—"}</div>
              <div className="text-xs text-muted-foreground">
                {r.clients?.razao_social && r.clients?.nome_fantasia ? r.clients.razao_social + " · " : ""}
                <span className="font-mono">{formatCnpjCpf(r.clients?.cnpj_cpf || "")}</span>
                {r.clients?.cidade ? ` · ${r.clients.cidade}/${r.clients.uf || ""}` : ""}
              </div>
              <Input
                className="mt-2 h-8 text-xs"
                placeholder="Observação (opcional — ex.: 'itens 1 e 2 desta empresa')"
                defaultValue={r.observacao || ""}
                onBlur={e => updateObs(r, e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              {r.papel !== "principal" && (
                <Button size="sm" variant="ghost" onClick={() => tornarPrincipal(r)} disabled={busy}>
                  <ArrowUpDown className="h-4 w-4 mr-1" /> Tornar principal
                </Button>
              )}
              {r.papel !== "principal" && (
                <Button size="icon" variant="ghost" aria-label="Remover empresa" onClick={() => remove(r)} disabled={busy}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}