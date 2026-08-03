import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Copy, ExternalLink, Info, Pencil, Search, XCircle } from "lucide-react";
import { atualizarFator, atualizarPergunta, duplicarQuestionario, getQuestionarioConfig, publicarQuestionario, validarQuestionario } from "@/lib/psico";
import { formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { BASE, ModuloHeader } from "./_ModuloShared";

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
    const { error } = await publicarQuestionario(cfg.quest.id, `PUBLICAR ${cfg.quest.codigo}`);
    setPublishing(false);
    if (error) return toast.error(error.message);
    toast.success("Questionário publicado!");
    setPublishOpen(false); setConfirmText(""); recarregar();
  }

  async function confirmarDuplicacao() {
    if (!dupData.codigo || !dupData.versao) return toast.error("Informe código e versão");
    const { error } = await duplicarQuestionario(cfg.quest.id, dupData.codigo, dupData.versao, dupData.nome || undefined);
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
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancelar</Button>
                      <Button disabled={publishing} onClick={confirmarPublicacao}>
                        {publishing ? "Publicando…" : "Sim, publicar"}
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