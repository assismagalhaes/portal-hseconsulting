import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Eye, Search } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { PSICO_STATUS_COLOR, PSICO_STATUS_LABEL, PsicoAvaliacaoStatus } from "@/lib/psico";
import { BASE, EmptyState, ModuloHeader } from "./_ModuloShared";

export function PsicoResultados() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState<string>("all");

  useEffect(() => {
    document.title = "Resultados | Avaliação Psicossocial";
    (async () => {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("psico_avaliacoes")
        .select("id, codigo, titulo, status, unidade, updated_at, quantidade_participantes_prevista, clients(id, razao_social, nome_fantasia), psico_resultado_processamentos(id, status, concluido_em)")
        .in("status", ["resultado_pronto", "relatorio_emitido"])
        .order("updated_at", { ascending: false });
      if (error) console.error("Resultados load error:", error);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const c = r.clients;
      const nome = c?.nome_fantasia || c?.razao_social;
      if (c?.id && nome) map.set(c.id, nome);
    });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    const cliNome = (r.clients?.nome_fantasia || r.clients?.razao_social || "").toLowerCase();
    if (s && ![r.codigo, r.titulo, cliNome].some((v: string) => (v || "").toLowerCase().includes(s))) return false;
    if (clienteFiltro !== "all" && r.clients?.id !== clienteFiltro) return false;
    return true;
  });

  const totais = {
    total: rows.length,
    prontos: rows.filter((r) => r.status === "resultado_pronto").length,
    emitidos: rows.filter((r) => r.status === "relatorio_emitido").length,
  };

  return (
    <div>
      <ModuloHeader />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="py-5"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avaliações com resultados</div><div className="text-2xl font-bold mt-1">{totais.total}</div></CardContent></Card>
          <Card><CardContent className="py-5"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Prontas para relatório</div><div className="text-2xl font-bold mt-1 text-emerald-700">{totais.prontos}</div></CardContent></Card>
          <Card><CardContent className="py-5"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Com relatório emitido</div><div className="text-2xl font-bold mt-1 text-primary">{totais.emitidos}</div></CardContent></Card>
        </div>

        <Card>
          <CardContent className="py-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, título ou cliente" className="pl-9" />
            </div>
            <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientes.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => { setQ(""); setClienteFiltro("all"); }}>Limpar filtros</Button>
          </CardContent>
        </Card>

        {loading ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sem resultados disponíveis"
            message="Os resultados serão exibidos após o encerramento da coleta e o processamento das respostas."
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Código</th>
                    <th className="text-left px-4 py-3">Cliente</th>
                    <th className="text-left px-4 py-3">Avaliação</th>
                    <th className="text-left px-4 py-3">Unidade</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Processado</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const cli = r.clients;
                    const st = r.status as PsicoAvaliacaoStatus;
                    const proc = (r.psico_resultado_processamentos || []).find((p: any) => p.status === "concluido") || (r.psico_resultado_processamentos || [])[0];
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{r.codigo}</td>
                        <td className="px-4 py-3">{cli?.nome_fantasia || cli?.razao_social || "—"}</td>
                        <td className="px-4 py-3">{r.titulo}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.unidade || "—"}</td>
                        <td className="px-4 py-3"><Badge className={PSICO_STATUS_COLOR[st]}>{PSICO_STATUS_LABEL[st]}</Badge></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{proc?.concluido_em ? formatDateTime(proc.concluido_em) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => nav(`${BASE}/avaliacoes/${r.id}?tab=resultados`)} title="Abrir resultados">
                            <BarChart3 className="h-4 w-4 mr-1" /> Ver resultados
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => nav(`${BASE}/avaliacoes/${r.id}`)} title="Abrir avaliação">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}