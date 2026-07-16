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
import { Plus, Search, ClipboardList, BarChart3, FileText, Settings2, Eye, Pencil, Ban, CheckCircle2, XCircle, Copy, ExternalLink, Info, BookOpen, Download, ShieldCheck } from "lucide-react";
import { PSICO_STATUS_LABEL, PSICO_STATUS_ORDER, contarPorStatus, listAvaliacoes, statusColor, statusLabel, getQuestionarioConfig, validarQuestionario, publicarQuestionario, duplicarQuestionario, atualizarFator, atualizarPergunta } from "@/lib/psico";
import { formatDate, formatDateTime } from "@/lib/format";
import { REL_STATUS_COLOR, REL_STATUS_LABEL, RelatorioVersaoStatus, baixarVersao } from "@/lib/psicoRelatorio";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const BASE = "/operacoes/avaliacao-fatores-psicossociais";

function ModuleTabs() {
  const loc = useLocation();
  const tabs = [
    { to: `${BASE}/avaliacoes`, label: "Avaliações", icon: ClipboardList },
    { to: `${BASE}/resultados`, label: "Resultados", icon: BarChart3 },
    { to: `${BASE}/relatorios`, label: "Relatórios", icon: FileText },
    { to: `${BASE}/biblioteca-medidas`, label: "Biblioteca de Medidas", icon: BookOpen },
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

export function PsicoConfiguracoes() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<any>({ quest: null, metod: null, fatores: [], perguntas: [], opcoes: [] });
  const [validacao, setValidacao] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [filtroFator, setFiltroFator] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [fatorEdit, setFatorEdit] = useState<any>(null);
  const [pergEdit, setPergEdit] = useState<any>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupData, setDupData] = useState({ codigo: "", versao: "", nome: "" });

  async function recarregar() {
    setLoading(true);
    const c = await getQuestionarioConfig("QPPOT-2.0");
    setCfg(c);
    if (c.quest?.id) {
      const { data } = await validarQuestionario(c.quest.id);
      setValidacao(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    document.title = "Configurações | Avaliação Psicossocial";
    recarregar();
  }, []);

  const publicada = cfg.quest?.status === "publicada";
  const emConfig = cfg.quest?.status === "em_configuracao";
  const podePublicar = isAdmin && emConfig && validacao?.valido;

  const perguntasFiltradas = (cfg.perguntas as any[]).filter((p) => {
    if (busca && !(p.texto?.toLowerCase().includes(busca.toLowerCase()) || String(p.numero).includes(busca))) return false;
    if (filtroFator !== "all" && p.fator_id !== filtroFator) return false;
    if (filtroTipo !== "all" && p.sentido_pontuacao !== filtroTipo) return false;
    return true;
  });

  async function salvarFator() {
    if (!fatorEdit) return;
    const { error } = await atualizarFator(fatorEdit.id, {
      nome: fatorEdit.nome, descricao: fatorEdit.descricao,
      ordem: Number(fatorEdit.ordem) || 1,
      quantidade_perguntas_prevista: Number(fatorEdit.quantidade_perguntas_prevista) || 0,
      ativo: !!fatorEdit.ativo,
    });
    if (error) return toast.error(error.message);
    toast.success("Fator atualizado");
    setFatorEdit(null); recarregar();
  }

  async function salvarPergunta() {
    if (!pergEdit) return;
    const { error } = await atualizarPergunta(pergEdit.id, {
      texto: pergEdit.texto, texto_apoio_exemplo: pergEdit.texto_apoio_exemplo,
      fator_id: pergEdit.fator_id, sentido_pontuacao: pergEdit.sentido_pontuacao,
      obrigatoria: !!pergEdit.obrigatoria, ativa: !!pergEdit.ativa,
      observacao_tecnica: pergEdit.observacao_tecnica || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pergunta atualizada");
    setPergEdit(null); recarregar();
  }

  async function confirmarPublicacao() {
    setPublishing(true);
    const { data, error } = await publicarQuestionario(cfg.quest.id, confirmText);
    setPublishing(false);
    if (error) return toast.error(error.message);
    toast.success("Questionário publicado!");
    setPublishOpen(false); setConfirmText(""); recarregar();
  }

  async function confirmarDuplicacao() {
    if (!dupData.codigo || !dupData.versao) return toast.error("Informe código e versão");
    const { data, error } = await duplicarQuestionario(cfg.quest.id, dupData.codigo, dupData.versao, dupData.nome || undefined);
    if (error) return toast.error(error.message);
    toast.success("Nova versão criada em configuração");
    setDupOpen(false); setDupData({ codigo: "", versao: "", nome: "" });
  }

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );

  const CheckItem = ({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) => (
    <div className="flex items-start gap-2 text-sm py-1.5">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
      <div><div className={ok ? "" : "text-destructive"}>{label}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>
    </div>
  );

  if (loading || !cfg.quest) {
    return <div><ModuloHeader /><div className="p-6 text-muted-foreground">Carregando…</div></div>;
  }

  const cf = validacao?.contagem_por_fator || {};
  const fatoresConfigurados = (cfg.fatores as any[]).filter((f) => f.ativo).length;

  return (
    <TooltipProvider>
    <div>
      <ModuloHeader />
      <div className="p-6 space-y-6">
        {/* 1) Versão vigente / atual */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {cfg.quest.nome}
                {cfg.quest.vigente && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Vigente</Badge>}
                <Badge variant="outline">{cfg.quest.status === "publicada" ? "Publicada" : cfg.quest.status === "arquivada" ? "Arquivada" : "Em configuração"}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{cfg.quest.codigo} · v{cfg.quest.versao}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`${BASE}/configuracoes/preview/${cfg.quest.id}`}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Pré-visualizar
                </Link>
              </Button>
              {publicada && isAdmin && (
                <Dialog open={dupOpen} onOpenChange={setDupOpen}>
                  <DialogTrigger asChild><Button variant="outline" size="sm"><Copy className="h-4 w-4 mr-2" /> Duplicar para nova versão</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Duplicar para nova versão</DialogTitle>
                      <DialogDescription>Cria uma nova versão em configuração. A versão vigente permanece intacta.</DialogDescription></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Novo código *</Label><Input value={dupData.codigo} onChange={(e) => setDupData((d) => ({ ...d, codigo: e.target.value }))} placeholder="Ex.: QPPOT-2.1" /></div>
                      <div><Label>Nova versão *</Label><Input value={dupData.versao} onChange={(e) => setDupData((d) => ({ ...d, versao: e.target.value }))} placeholder="Ex.: 2.1" /></div>
                      <div><Label>Novo nome (opcional)</Label><Input value={dupData.nome} onChange={(e) => setDupData((d) => ({ ...d, nome: e.target.value }))} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setDupOpen(false)}>Cancelar</Button><Button onClick={confirmarDuplicacao}>Duplicar</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Metodologia" value={cfg.metod ? `${cfg.metod.codigo} v${cfg.metod.versao}` : "—"} />
            <Field label="Publicado em" value={cfg.quest.publicado_em ? formatDate(cfg.quest.publicado_em) : "—"} />
            <Field label="Publicado por" value={cfg.quest.publicado_por ? <span className="font-mono text-xs">{String(cfg.quest.publicado_por).slice(0, 8)}…</span> : "—"} />
            <Field label="Perguntas" value={`${cfg.perguntas.length} de ${cfg.quest.quantidade_perguntas_prevista}`} />
          </CardContent>
        </Card>

        {/* 2) Metodologia */}
        <Card>
          <CardHeader><CardTitle>Metodologia</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código" value={<span className="font-mono">{cfg.metod?.codigo}</span>} />
            <Field label="Versão" value={cfg.metod?.versao} />
            <Field label="Status" value={<Badge variant="outline">{cfg.metod?.status}</Badge>} />
            <Field label="Unidade de análise" value="Quantidade de respostas válidas" />
            <Field label="Mínimo global" value={cfg.metod?.minimo_respondentes_global} />
            <Field label="Mínimo por segmentação" value={cfg.metod?.minimo_respondentes_segmentacao} />
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Faixas de classificação</div>
              <div className="grid gap-2 sm:grid-cols-5 text-sm">
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Irrelevante</div><div>até {cfg.metod?.faixa_irrelevante_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Baixo</div><div>até {cfg.metod?.faixa_baixo_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Médio</div><div>até {cfg.metod?.faixa_medio_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Alto</div><div>até {cfg.metod?.faixa_alto_max}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Crítico</div><div>até {cfg.metod?.faixa_critico_max}</div></CardContent></Card>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Critérios de significância</div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Principal</div><div>Médio + Alto + Crítico &gt; {cfg.metod?.criterio_principal_percentual}%</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Agravamento</div><div>Alto + Crítico ≥ {cfg.metod?.criterio_agravamento_percentual}%</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Crítico automático</div><div>Crítico ≥ {cfg.metod?.criterio_critico_percentual}%</div></CardContent></Card>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Não existe critério de comparação com média geral.</p>
            </div>
          </CardContent>
        </Card>

        {/* 3) Escala de respostas */}
        <Card>
          <CardHeader><CardTitle>Escala de respostas</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Resposta</th>
                    <th className="text-center px-3 py-2">
                      <Tooltip><TooltipTrigger className="inline-flex items-center gap-1">Peso em pergunta direta <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Quanto maior a frequência da situação descrita, maior o peso de risco.</TooltipContent></Tooltip>
                    </th>
                    <th className="text-center px-3 py-2">
                      <Tooltip><TooltipTrigger className="inline-flex items-center gap-1">Peso em pergunta invertida <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Quanto maior a frequência da condição favorável descrita, menor o peso de risco.</TooltipContent></Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.opcoes.map((o: any) => (
                    <tr key={o.id} className="border-t">
                      <td className="px-3 py-2">{o.rotulo}</td>
                      <td className="text-center px-3 py-2">{o.peso_direta}</td>
                      <td className="text-center px-3 py-2">{o.peso_invertida}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Independentemente do sentido da redação, o peso 0 representa a condição mais favorável e o peso 4 representa a condição mais desfavorável.</p>
          </CardContent>
        </Card>

        {/* 4) Fatores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Fatores psicossociais</CardTitle>
            <Badge variant="outline">{fatoresConfigurados} de 7 fatores configurados</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {(cfg.fatores as any[]).map((f) => {
                const cont = cf[f.codigo];
                return (
                  <Card key={f.id} className="border-l-4 border-l-primary/40">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">#{f.ordem}</Badge>
                            <span className="font-medium">{f.nome}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>
                          <div className="flex gap-3 mt-2 text-xs">
                            <span>Esperadas: <strong>{f.quantidade_perguntas_prevista}</strong></span>
                            <span>Cadastradas: <strong>{cont?.atual ?? "—"}</strong></span>
                            {f.ativo ? <Badge variant="outline" className="text-xs">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                          </div>
                        </div>
                        {emConfig && (
                          <Button size="sm" variant="ghost" onClick={() => setFatorEdit({ ...f })}><Pencil className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 5) Perguntas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Perguntas</CardTitle>
            <Badge variant="outline">{cfg.perguntas.length} de {cfg.quest.quantidade_perguntas_prevista} perguntas configuradas</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por texto ou número" className="pl-9" />
              </div>
              <Select value={filtroFator} onValueChange={setFiltroFator}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fatores</SelectItem>
                  {(cfg.fatores as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="direta">Direta</SelectItem>
                  <SelectItem value="invertida">Invertida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-2 w-12">Nº</th>
                    <th className="text-left px-2 py-2">Pergunta</th>
                    <th className="text-left px-2 py-2">Fator</th>
                    <th className="text-left px-2 py-2">Tipo</th>
                    <th className="text-right px-2 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {perguntasFiltradas.map((p) => {
                    const fat = (cfg.fatores as any[]).find((f) => f.id === p.fator_id);
                    return (
                      <tr key={p.id} className="border-t align-top">
                        <td className="px-2 py-2 font-mono">{String(p.numero).padStart(2, "0")}</td>
                        <td className="px-2 py-2">
                          <div>{p.texto}</div>
                          <div className="text-xs text-muted-foreground italic mt-0.5">{p.texto_apoio_exemplo}</div>
                        </td>
                        <td className="px-2 py-2 text-xs">{fat?.nome || "—"}</td>
                        <td className="px-2 py-2"><Badge variant={p.sentido_pontuacao === "direta" ? "default" : "secondary"} className="text-xs">{p.sentido_pontuacao === "direta" ? "Direta" : "Invertida"}</Badge></td>
                        <td className="px-2 py-2 text-right">
                          {emConfig && <Button size="sm" variant="ghost" onClick={() => setPergEdit({ ...p })}><Pencil className="h-4 w-4" /></Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 6) Validação / Checklist de publicação */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Checklist de publicação</CardTitle>
            {validacao?.valido
              ? <Badge className="bg-emerald-100 text-emerald-800">Pronto para publicação</Badge>
              : <Badge variant="destructive">Pendências identificadas</Badge>}
          </CardHeader>
          <CardContent>
            {validacao && (() => {
              const c = cf;
              const items = [
                { ok: !!validacao.metodologia_valida, label: "Metodologia cadastrada" },
                { ok: !!validacao.escala_valida, label: "Escala com cinco respostas e pesos válidos" },
                { ok: (cfg.fatores as any[]).filter((f: any) => f.ativo).length === 7, label: "Sete fatores ativos" },
                { ok: validacao.total_perguntas === 35, label: "Trinta e cinco perguntas ativas", hint: `Atual: ${validacao.total_perguntas}` },
                { ok: !!validacao.numeracao_valida, label: "Numeração contínua de 1 a 35" },
                { ok: !!validacao.ordem_valida, label: "Ordem contínua de 1 a 35" },
                { ok: validacao.total_diretas === 12, label: "Doze perguntas diretas", hint: `Atual: ${validacao.total_diretas}` },
                { ok: validacao.total_invertidas === 23, label: "Vinte e três perguntas invertidas", hint: `Atual: ${validacao.total_invertidas}` },
                { ok: !!validacao.contagem_fatores_valida, label: "Contagem por fator válida" },
                { ok: c.carga_excessiva?.atual === 8, label: "Carga Excessiva: 8 perguntas" },
                { ok: c.falta_autonomia?.atual === 6, label: "Falta de Autonomia: 6 perguntas" },
                { ok: c.conflitos_hierarquicos?.atual === 5, label: "Conflitos Hierárquicos: 5 perguntas" },
                { ok: c.relacoes_interpessoais?.atual === 4, label: "Qualidade das Relações: 4 perguntas" },
                { ok: c.conflitos_interpessoais?.atual === 4, label: "Conflitos Interpessoais: 4 perguntas" },
                { ok: c.falta_clareza?.atual === 5, label: "Falta de Clareza: 5 perguntas" },
                { ok: c.gestao_mudancas?.atual === 3, label: "Gestão de Mudanças: 3 perguntas" },
                { ok: true, label: "Critério 'acima da média' inexistente na metodologia" },
              ];
              return (
                <div className="grid gap-1 md:grid-cols-2">
                  {items.map((it, i) => <CheckItem key={i} {...it} />)}
                </div>
              );
            })()}

            {emConfig && (
              <div className="mt-6 flex justify-end">
                <Dialog open={publishOpen} onOpenChange={(o) => { setPublishOpen(o); if (!o) setConfirmText(""); }}>
                  <DialogTrigger asChild>
                    <Button disabled={!podePublicar}>Publicar versão</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Publicar {cfg.quest.codigo}?</DialogTitle>
                      <DialogDescription>
                        Após a publicação, os fatores, perguntas, exemplos, pesos e regras desta versão não poderão ser alterados. Mudanças futuras deverão ser realizadas em uma nova versão.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label>Digite <span className="font-mono font-bold">PUBLICAR {cfg.quest.codigo}</span> para confirmar</Label>
                      <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={`PUBLICAR ${cfg.quest.codigo}`} />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancelar</Button>
                      <Button disabled={publishing || confirmText !== `PUBLICAR ${cfg.quest.codigo}`} onClick={confirmarPublicacao}>
                        {publishing ? "Publicando…" : "Publicar definitivamente"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>

        {emConfig && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
            <CardContent className="py-4 text-sm">
              Esta versão permanece em configuração e ainda não pode ser utilizada para abertura de coleta.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Editor de fator */}
      <Dialog open={!!fatorEdit} onOpenChange={(o) => !o && setFatorEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar fator</DialogTitle></DialogHeader>
          {fatorEdit && (
            <div className="space-y-3">
              <div><Label>Código</Label><Input value={fatorEdit.codigo} disabled className="font-mono" /></div>
              <div><Label>Nome</Label><Input value={fatorEdit.nome} onChange={(e) => setFatorEdit((f: any) => ({ ...f, nome: e.target.value }))} /></div>
              <div><Label>Descrição</Label><Textarea rows={3} value={fatorEdit.descricao || ""} onChange={(e) => setFatorEdit((f: any) => ({ ...f, descricao: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Ordem</Label><Input type="number" value={fatorEdit.ordem} onChange={(e) => setFatorEdit((f: any) => ({ ...f, ordem: e.target.value }))} /></div>
                <div><Label>Perguntas previstas</Label><Input type="number" value={fatorEdit.quantidade_perguntas_prevista} onChange={(e) => setFatorEdit((f: any) => ({ ...f, quantidade_perguntas_prevista: e.target.value }))} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!fatorEdit.ativo} onCheckedChange={(v) => setFatorEdit((f: any) => ({ ...f, ativo: !!v }))} /> Ativo
              </label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setFatorEdit(null)}>Cancelar</Button><Button onClick={salvarFator}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor de pergunta */}
      <Dialog open={!!pergEdit} onOpenChange={(o) => !o && setPergEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar pergunta {pergEdit?.numero && String(pergEdit.numero).padStart(2, "0")}</DialogTitle></DialogHeader>
          {pergEdit && (
            <div className="space-y-3">
              <div><Label>Texto</Label><Textarea rows={2} value={pergEdit.texto} onChange={(e) => setPergEdit((p: any) => ({ ...p, texto: e.target.value }))} /></div>
              <div><Label>Exemplo / apoio</Label><Textarea rows={2} value={pergEdit.texto_apoio_exemplo || ""} onChange={(e) => setPergEdit((p: any) => ({ ...p, texto_apoio_exemplo: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fator</Label>
                  <Select value={pergEdit.fator_id} onValueChange={(v) => setPergEdit((p: any) => ({ ...p, fator_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(cfg.fatores as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sentido</Label>
                  <Select value={pergEdit.sentido_pontuacao} onValueChange={(v) => setPergEdit((p: any) => ({ ...p, sentido_pontuacao: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direta">Direta</SelectItem>
                      <SelectItem value="invertida">Invertida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Observação técnica (opcional)</Label><Textarea rows={2} value={pergEdit.observacao_tecnica || ""} onChange={(e) => setPergEdit((p: any) => ({ ...p, observacao_tecnica: e.target.value }))} /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!pergEdit.obrigatoria} onCheckedChange={(v) => setPergEdit((p: any) => ({ ...p, obrigatoria: !!v }))} /> Obrigatória</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!pergEdit.ativa} onCheckedChange={(v) => setPergEdit((p: any) => ({ ...p, ativa: !!v }))} /> Ativa</label>
              </div>
              <div className="text-xs text-muted-foreground">
                Pesos aplicados: {cfg.opcoes.map((o: any) => `${o.rotulo}=${pergEdit.sentido_pontuacao === "direta" ? o.peso_direta : o.peso_invertida}`).join(" · ")}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setPergEdit(null)}>Cancelar</Button><Button onClick={salvarPergunta}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
