import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Plus, Search, Upload } from "lucide-react";
import {
  PSICO_STATUS_LABEL,
  PSICO_STATUS_ORDER,
  contarPorStatus,
  listAvaliacoes,
  statusColor,
  statusLabel,
} from "@/lib/psico";
import { formatDate } from "@/lib/format";
import { BASE, EmptyState, ModuloHeader } from "./_ModuloShared";

export function PsicoAvaliacoesLista() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [clienteFiltro, setClienteFiltro] = useState<string>("all");
  const [respFiltro, setRespFiltro] = useState<string>("all");
  const [resps, setResps] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Avaliação de Fatores Psicossociais | Portal HSE";
    (async () => {
      const [r, c, p] = await Promise.all([
        listAvaliacoes(),
        contarPorStatus(),
        supabase.from("profiles").select("id, nome, email").order("nome"),
      ]);
      setRows(r.data || []);
      setCounts(c);
      setResps(p.data || []);
      setLoading(false);
    })();
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const nome = r.clients?.nome_fantasia || r.clients?.razao_social;
      if (r.cliente_id && nome) map.set(r.cliente_id, nome);
    });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    const nome = (r.clients?.nome_fantasia || r.clients?.razao_social || "").toLowerCase();
    if (s && ![r.codigo, r.titulo, nome].some((v) => (v || "").toLowerCase().includes(s))) return false;
    if (statusFiltro !== "all" && r.status !== statusFiltro) return false;
    if (clienteFiltro !== "all" && r.cliente_id !== clienteFiltro) return false;
    if (respFiltro !== "all" && r.responsavel_hse_id !== respFiltro) return false;
    return true;
  });

  const cards = [
    { label: "Total de avaliações", value: rows.length },
    { label: "Coletas em andamento", value: counts.coleta_em_andamento || 0 },
    { label: "Resultados prontos", value: counts.resultado_pronto || 0 },
    { label: "Relatórios emitidos", value: counts.relatorio_emitido || 0 },
  ];

  return (
    <div>
      <ModuloHeader actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav(`${BASE}/importar-historico`)}>
            <Upload className="h-4 w-4 mr-2" /> Importar histórico
          </Button>
          <Button onClick={() => nav(`${BASE}/avaliacoes/nova`)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Avaliação
          </Button>
        </div>
      } />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="py-5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-bold mt-1">{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="py-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, título ou cliente" className="pl-9" />
            </div>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {PSICO_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{PSICO_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientes.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={respFiltro} onValueChange={setRespFiltro}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Responsável HSE" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {resps.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => { setQ(""); setStatusFiltro("all"); setClienteFiltro("all"); setRespFiltro("all"); }}>Limpar filtros</Button>
          </CardContent>
        </Card>

        {loading ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhuma avaliação cadastrada"
            message="Crie a primeira Avaliação de Fatores Psicossociais para iniciar o planejamento da coleta."
            action={<Button onClick={() => nav(`${BASE}/avaliacoes/nova`)}><Plus className="h-4 w-4 mr-2" /> Nova Avaliação</Button>}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Código</th>
                    <th className="text-left px-4 py-3">Cliente</th>
                    <th className="text-left px-4 py-3">Título</th>
                    <th className="text-left px-4 py-3">Unidade</th>
                    <th className="text-left px-4 py-3">Período previsto</th>
                    <th className="text-left px-4 py-3">Partic.</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Atualização</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{r.codigo}</td>
                      <td className="px-4 py-3">{r.clients?.nome_fantasia || r.clients?.razao_social || "—"}</td>
                      <td className="px-4 py-3">{r.titulo}</td>
                      <td className="px-4 py-3">{r.unidade || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {r.data_inicio_prevista ? formatDate(r.data_inicio_prevista) : "—"}
                        {" → "}
                        {r.data_fim_prevista ? formatDate(r.data_fim_prevista) : "—"}
                      </td>
                      <td className="px-4 py-3">{r.quantidade_participantes_prevista}</td>
                      <td className="px-4 py-3"><Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(r.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => nav(`${BASE}/avaliacoes/${r.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}