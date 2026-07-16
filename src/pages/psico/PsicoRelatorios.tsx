import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Eye, Search, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { REL_STATUS_COLOR, REL_STATUS_LABEL, RelatorioVersaoStatus, baixarVersao } from "@/lib/psicoRelatorio";
import { toast } from "sonner";
import { BASE, EmptyState, ModuloHeader } from "./_ModuloShared";

export function PsicoRelatorios() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [clienteFiltro, setClienteFiltro] = useState<string>("all");

  useEffect(() => {
    document.title = "Relatórios | Avaliação Psicossocial";
    (async () => {
      const sb: any = supabase;
      const { data } = await sb
        .from("psico_relatorios_versoes")
        .select(
          "id, relatorio_id, codigo_revisao, numero_revisao, status, emitido_em, arquivo_paginas, arquivo_tamanho_bytes, pdf_hash_sha256, codigo_validacao, avaliacao_id, psico_relatorios!inner(id, codigo, status), psico_avaliacoes!inner(id, codigo, titulo, cliente_id, clients(id, razao_social, nome_fantasia))"
        )
        .in("status", ["emitido", "substituido", "revogado"])
        .order("emitido_em", { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const c = r.psico_avaliacoes?.clients;
      const nome = c?.nome_fantasia || c?.razao_social;
      if (c?.id && nome) map.set(c.id, nome);
    });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    const cli = r.psico_avaliacoes?.clients;
    const cliNome = (cli?.nome_fantasia || cli?.razao_social || "").toLowerCase();
    const rafp = r.psico_relatorios?.codigo || "";
    if (s && ![rafp, r.psico_avaliacoes?.codigo, r.psico_avaliacoes?.titulo, cliNome].some((v: string) => (v || "").toLowerCase().includes(s))) return false;
    if (statusFiltro !== "all" && r.status !== statusFiltro) return false;
    if (clienteFiltro !== "all" && cli?.id !== clienteFiltro) return false;
    return true;
  });

  const totais = {
    total: rows.length,
    emitidos: rows.filter((r) => r.status === "emitido").length,
    substituidos: rows.filter((r) => r.status === "substituido").length,
    revogados: rows.filter((r) => r.status === "revogado").length,
  };

  async function baixar(versaoId: string) {
    const { url, error } = await baixarVersao(versaoId);
    if (error || !url) return toast.error(error || "Arquivo indisponível");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <ModuloHeader />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="py-5"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total de emissões</div><div className="text-2xl font-bold mt-1">{totais.total}</div></CardContent></Card>
          <Card><CardContent className="py-5"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Ativos (emitidos)</div><div className="text-2xl font-bold mt-1 text-emerald-700">{totais.emitidos}</div></CardContent></Card>
          <Card><CardContent className="py-5"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Substituídos</div><div className="text-2xl font-bold mt-1">{totais.substituidos}</div></CardContent></Card>
          <Card><CardContent className="py-5"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Revogados</div><div className="text-2xl font-bold mt-1 text-destructive">{totais.revogados}</div></CardContent></Card>
        </div>

        <Card>
          <CardContent className="py-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por RAFP, código, título ou cliente" className="pl-9" />
            </div>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="emitido">Emitido</SelectItem>
                <SelectItem value="substituido">Substituído</SelectItem>
                <SelectItem value="revogado">Revogado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientes.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => { setQ(""); setStatusFiltro("all"); setClienteFiltro("all"); }}>Limpar filtros</Button>
            <Button variant="outline" asChild>
              <Link to="/validar/relatorio-psicossocial" target="_blank" rel="noopener">
                <ShieldCheck className="h-4 w-4 mr-2" /> Página pública de validação
              </Link>
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum relatório emitido"
            message="Os relatórios aparecem aqui após a emissão a partir da avaliação (aba Relatório)."
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Código RAFP</th>
                    <th className="text-left px-4 py-3">Rev.</th>
                    <th className="text-left px-4 py-3">Cliente</th>
                    <th className="text-left px-4 py-3">Avaliação</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Emitido</th>
                    <th className="text-left px-4 py-3">Págs.</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const cli = r.psico_avaliacoes?.clients;
                    const st = r.status as RelatorioVersaoStatus;
                    const podeBaixar = st === "emitido" || st === "substituido";
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{r.psico_relatorios?.codigo}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.codigo_revisao}</td>
                        <td className="px-4 py-3">{cli?.nome_fantasia || cli?.razao_social || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-muted-foreground">{r.psico_avaliacoes?.codigo}</div>
                          <div>{r.psico_avaliacoes?.titulo}</div>
                        </td>
                        <td className="px-4 py-3"><Badge className={REL_STATUS_COLOR[st]}>{REL_STATUS_LABEL[st]}</Badge></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.emitido_em ? formatDateTime(r.emitido_em) : "—"}</td>
                        <td className="px-4 py-3">{r.arquivo_paginas ?? "—"}</td>
                        <td className="px-4 py-3 text-right space-x-1">
                          {podeBaixar && (
                            <Button size="sm" variant="ghost" onClick={() => baixar(r.id)} title="Baixar PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => nav(`${BASE}/avaliacoes/${r.avaliacao_id}`)} title="Abrir avaliação">
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