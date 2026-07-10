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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, Plus, Trash2, Star, ArrowUpDown, Search } from "lucide-react";
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
  onChange?: () => void;
};

export default function EmpresasProposta({ proposalId, onChange }: Props) {
  const [rows, setRows] = useState<ProposalClient[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
    })
    .slice(0, 40);

  async function addColigada(client_id: string) {
    setBusy(true);
    const nextOrdem = (rows.filter(r => r.papel === "coligada").length) + 1;
    const { error } = await supabase.from("proposal_clients").insert({
      proposal_id: proposalId, client_id, papel: "coligada", ordem: nextOrdem,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPickerOpen(false); setQuery("");
    await load(); onChange?.();
    toast.success("Empresa coligada adicionada");
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
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Adicionar coligada</Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="end">
            <div className="p-2 border-b flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por razão social, fantasia ou CNPJ…" className="h-8 border-0 focus-visible:ring-0" />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Nenhum cliente encontrado. Cadastre-o antes em <span className="font-medium">Clientes</span>.
                </div>
              )}
              {filtered.map(c => (
                <button
                  key={c.id}
                  disabled={busy}
                  onClick={() => addColigada(c.id)}
                  className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-0"
                >
                  <div className="text-sm font-medium">{c.nome_fantasia || c.razao_social}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {formatCnpjCpf(c.cnpj_cpf || "")} {c.cidade ? `· ${c.cidade}/${c.uf || ""}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
                <Button size="icon" variant="ghost" onClick={() => remove(r)} disabled={busy}>
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