import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ClipboardList, BarChart3, FileText, Settings2, Eye, Pencil, Ban } from "lucide-react";
import { PSICO_STATUS_LABEL, PSICO_STATUS_ORDER, contarPorStatus, listAvaliacoes, statusColor, statusLabel } from "@/lib/psico";
import { formatDate } from "@/lib/format";

const BASE = "/operacoes/avaliacao-fatores-psicossociais";

function ModuleTabs() {
  const loc = useLocation();
  const tabs = [
    { to: `${BASE}/avaliacoes`, label: "Avaliações", icon: ClipboardList },
    { to: `${BASE}/resultados`, label: "Resultados", icon: BarChart3 },
    { to: `${BASE}/relatorios`, label: "Relatórios", icon: FileText },
    { to: `${BASE}/configuracoes`, label: "Configurações", icon: Settings2 },
  ];
  const current = tabs.find((t) => loc.pathname.startsWith(t.to))?.to || tabs[0].to;
  return (
    <Tabs value={current} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.to} value={t.to} asChild>
            <Link to={t.to} className="flex items-center gap-2">
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted grid place-items-center">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{message}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function PsicoModuloRedirect() {
  return <Navigate to={`${BASE}/avaliacoes`} replace />;
}

function ModuloHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Avaliação de Fatores Psicossociais"
        subtitle="Crie, acompanhe e emita avaliações coletivas sobre fatores psicossociais relacionados às condições e à organização do trabalho."
        actions={actions}
      />
      <div className="px-6 pt-4">
        <ModuleTabs />
      </div>
    </>
  );
}

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
        <Button onClick={() => nav(`${BASE}/avaliacoes/nova`)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Avaliação
        </Button>
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

export function PsicoResultados() {
  useEffect(() => { document.title = "Resultados | Avaliação Psicossocial"; }, []);
  return (
    <div>
      <ModuloHeader />
      <div className="p-6">
        <EmptyState
          title="Sem resultados disponíveis"
          message="Os resultados serão exibidos após o encerramento da coleta e o processamento das respostas."
        />
      </div>
    </div>
  );
}

export function PsicoRelatorios() {
  useEffect(() => { document.title = "Relatórios | Avaliação Psicossocial"; }, []);
  return (
    <div>
      <ModuloHeader />
      <div className="p-6">
        <EmptyState
          title="Sem relatórios emitidos"
          message="Os relatórios estarão disponíveis após a conclusão da análise técnica das coletas realizadas."
        />
      </div>
    </div>
  );
}

export function PsicoConfiguracoes() {
  const [metod, setMetod] = useState<any>(null);
  const [quest, setQuest] = useState<any>(null);
  const [qtdPerguntas, setQtdPerguntas] = useState(0);

  useEffect(() => {
    document.title = "Configurações | Avaliação Psicossocial";
    (async () => {
      const [m, q] = await Promise.all([
        supabase.from("psico_metodologias_versoes").select("*").eq("codigo", "HSE-PSICO-2.0").maybeSingle(),
        supabase.from("psico_questionarios_versoes").select("*").eq("codigo", "QPPOT-2.0").maybeSingle(),
      ]);
      setMetod(m.data);
      setQuest(q.data);
      if (q.data?.id) {
        const { count } = await supabase.from("psico_perguntas").select("id", { count: "exact", head: true }).eq("questionario_versao_id", q.data.id);
        setQtdPerguntas(count || 0);
      }
    })();
  }, []);

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );

  return (
    <div>
      <ModuloHeader />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Metodologia</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código" value={<span className="font-mono">{metod?.codigo}</span>} />
            <Field label="Nome" value={metod?.nome} />
            <Field label="Versão" value={metod?.versao} />
            <Field label="Status" value={<Badge variant="outline">{metod?.status}</Badge>} />
            <Field label="Unidade de cálculo" value={metod?.unidade_calculo} />
            <Field label="Mínimo global" value={metod?.minimo_respondentes_global} />
            <Field label="Mínimo por segmentação" value={metod?.minimo_respondentes_segmentacao} />
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Faixas de classificação</div>
              <div className="grid gap-2 sm:grid-cols-5 text-sm">
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Irrelevante</div><div>até {metod?.faixa_irrelevante_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Baixo</div><div>até {metod?.faixa_baixo_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Médio</div><div>até {metod?.faixa_medio_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Alto</div><div>até {metod?.faixa_alto_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Crítico</div><div>até {metod?.faixa_critico_max}</div></CardContent></Card>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Critérios de significância</div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Principal</div><div>{metod?.criterio_principal_operador} {metod?.criterio_principal_percentual}%</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Agravamento</div><div>{metod?.criterio_agravamento_operador} {metod?.criterio_agravamento_percentual}%</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Crítico</div><div>{metod?.criterio_critico_operador} {metod?.criterio_critico_percentual}%</div></CardContent></Card>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Questionário</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código" value={<span className="font-mono">{quest?.codigo}</span>} />
            <Field label="Nome" value={quest?.nome} />
            <Field label="Versão" value={quest?.versao} />
            <Field label="Status" value={<Badge variant="outline">{quest?.status}</Badge>} />
            <Field label="Quantidade prevista" value={quest?.quantidade_perguntas_prevista} />
            <Field label="Cadastradas" value={`${qtdPerguntas} de ${quest?.quantidade_perguntas_prevista ?? 35} perguntas configuradas`} />
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Subtítulo" value={quest?.subtitulo} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Texto de abertura" value={<p className="whitespace-pre-wrap text-sm">{quest?.texto_abertura}</p>} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="py-4 text-sm">
            Esta versão permanece em configuração e ainda não pode ser utilizada para abertura de coleta.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
