import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { ModuleTabs } from "./_ModuloShared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, BookOpen, Info, Search, CheckCircle2, XCircle, Lock } from "lucide-react";
import {
  BibliotecaVersao, FatorOrientacao, MedidaModelo,
  getBiblioteca, getBibliotecaVigente, listBibliotecas,
  NIVEL_COLOR, NIVEL_LABEL, STATUS_BIB_LABEL,
} from "@/lib/psicoBiblioteca";
import { formatDate } from "@/lib/format";

const BASE = "/operacoes/avaliacao-fatores-psicossociais";

function BulletList({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function ChipList({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="text-xs rounded-full bg-muted px-2.5 py-1">{it}</span>
      ))}
    </div>
  );
}

function FatorCard({ f, medidas }: { f: FatorOrientacao; medidas: MedidaModelo[] }) {
  const doFator = medidas.filter((m) => m.fator_codigo === f.fator_codigo);
  const cores = { essencial: 0, estruturante: 0, complementar: 0 };
  doFator.forEach((m) => { (cores as any)[m.nivel_recomendacao]++; });
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{f.fator_codigo}</span>
              {f.nome}
            </CardTitle>
            {f.definicao_resumida && <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{f.definicao_resumida}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["essencial","estruturante","complementar"] as const).map((n) => (
              (cores as any)[n] > 0 && <Badge key={n} className={NIVEL_COLOR[n]}>{(cores as any)[n]} {NIVEL_LABEL[n]}</Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Impactos possíveis</h4>
            <BulletList items={f.impactos_possiveis} />
          </section>
          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Situações associadas</h4>
            <BulletList items={f.situacoes_associadas} />
          </section>
        </div>
        {f.objetivo_medidas && (
          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Objetivo das medidas</h4>
            <p className="text-sm">{f.objetivo_medidas}</p>
          </section>
        )}
        {f.perguntas_avaliacao_interna && f.perguntas_avaliacao_interna.length > 0 && (
          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Perguntas para avaliação interna</h4>
            <BulletList items={f.perguntas_avaliacao_interna} />
          </section>
        )}
        {f.orientacao_priorizacao && (
          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Orientação de priorização</h4>
            <p className="text-sm">{f.orientacao_priorizacao}</p>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Medidas recomendadas ({doFator.length})</h4>
          </div>
          {doFator.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma medida cadastrada para este fator.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {doFator.map((m) => (
                <AccordionItem value={m.id} key={m.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-wrap items-center gap-2 text-left">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted">{m.codigo}</span>
                      <Badge className={NIVEL_COLOR[m.nivel_recomendacao]}>{NIVEL_LABEL[m.nivel_recomendacao]}</Badge>
                      {m.grupo_transversal && <Badge variant="outline" className="text-[10px]">{m.grupo_transversal}</Badge>}
                      <span className="text-sm font-medium">{m.titulo}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {m.o_que_significa && (
                        <div>
                          <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">O que significa</h5>
                          <p className="text-sm">{m.o_que_significa}</p>
                        </div>
                      )}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Orientações práticas</h5>
                          <BulletList items={m.orientacoes_praticas} />
                        </div>
                        <div>
                          <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Exemplos de aplicação</h5>
                          <BulletList items={m.exemplos_aplicacao} />
                        </div>
                        <div>
                          <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Responsáveis sugeridos</h5>
                          <ChipList items={m.responsaveis_sugeridos} />
                        </div>
                        <div>
                          <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Evidências recomendadas</h5>
                          <BulletList items={m.evidencias_recomendadas} />
                        </div>
                        <div>
                          <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Indicadores sugeridos</h5>
                          <BulletList items={m.indicadores_sugeridos} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 content-start">
                          <div>
                            <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground">Prazo</h5>
                            <div className="text-sm">{m.prazo_sugerido_dias ? `${m.prazo_sugerido_dias} dias` : "—"}</div>
                          </div>
                          <div>
                            <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground">Complexidade</h5>
                            <div className="text-sm capitalize">{m.complexidade || "—"}</div>
                          </div>
                          <div>
                            <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo</h5>
                            <div className="text-sm capitalize">{m.custo_estimado || "—"}</div>
                          </div>
                        </div>
                      </div>
                      {m.observacoes && (
                        <div>
                          <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Observações</h5>
                          <p className="text-sm text-muted-foreground">{m.observacoes}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </section>

        {f.observacao_final && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">{f.observacao_final}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function PsicoBibliotecaLista() {
  const nav = useNavigate();
  const [rows, setRows] = useState<BibliotecaVersao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Biblioteca de Medidas | Avaliação Psicossocial";
    (async () => {
      try {
        const r = await listBibliotecas();
        setRows(r);
      } finally { setLoading(false); }
    })();
  }, []);

  const vigente = rows.find((r) => r.vigente);

  return (
    <div>
      <PageHeader
        title="Biblioteca de Medidas"
        subtitle="Catálogo técnico de fatores psicossociais e medidas recomendadas. Base para as revisões técnicas de cada avaliação."
      />
      <div className="px-6 pt-4"><ModuleTabs /></div>
      <div className="p-6 space-y-6">
        {vigente && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle>Versão vigente: {vigente.nome} · v{vigente.versao}</AlertTitle>
            <AlertDescription>Publicada em {vigente.publicado_em ? formatDate(vigente.publicado_em) : "—"} · {vigente.quantidade_fatores_prevista ?? 0} fatores · {vigente.quantidade_medidas_prevista ?? 0} medidas</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma biblioteca cadastrada.</CardContent></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Código</th>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Versão</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Fatores</th>
                    <th className="text-left px-4 py-3">Medidas</th>
                    <th className="text-left px-4 py-3">Publicada</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => nav(`${BASE}/biblioteca-medidas/${b.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs">{b.codigo}</td>
                      <td className="px-4 py-3">{b.nome}</td>
                      <td className="px-4 py-3">v{b.versao}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline">{STATUS_BIB_LABEL[b.status]}</Badge>
                          {b.vigente && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Vigente</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">{b.quantidade_fatores_prevista ?? "—"}</td>
                      <td className="px-4 py-3">{b.quantidade_medidas_prevista ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{b.publicado_em ? formatDate(b.publicado_em) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); nav(`${BASE}/biblioteca-medidas/${b.id}`); }}>
                          <BookOpen className="h-4 w-4" />
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

export function PsicoBibliotecaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<{ biblioteca: BibliotecaVersao | null; fatores: FatorOrientacao[]; medidas: MedidaModelo[] }>({ biblioteca: null, fatores: [], medidas: [] });
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroFator, setFiltroFator] = useState<string>("all");
  const [filtroNivel, setFiltroNivel] = useState<string>("all");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const r = await getBiblioteca(id);
        setData(r);
        if (r.biblioteca) document.title = `${r.biblioteca.nome} v${r.biblioteca.versao} | Biblioteca de Medidas`;
      } finally { setLoading(false); }
    })();
  }, [id]);

  const { biblioteca, fatores, medidas } = data;

  const medidasFiltradas = useMemo(() => medidas.filter((m) => {
    if (filtroFator !== "all" && m.fator_codigo !== filtroFator) return false;
    if (filtroNivel !== "all" && m.nivel_recomendacao !== filtroNivel) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const hay = [m.codigo, m.titulo, m.o_que_significa, ...(m.orientacoes_praticas || []), ...(m.exemplos_aplicacao || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [medidas, busca, filtroFator, filtroNivel]);

  const fatoresVisiveis = useMemo(() => {
    if (filtroFator === "all" && filtroNivel === "all" && !busca) return fatores;
    const codsComMedida = new Set(medidasFiltradas.map((m) => m.fator_codigo));
    return fatores.filter((f) => filtroFator === "all" ? codsComMedida.has(f.fator_codigo) : f.fator_codigo === filtroFator);
  }, [fatores, medidasFiltradas, filtroFator, filtroNivel, busca]);

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!biblioteca) return <div className="p-6 text-muted-foreground">Biblioteca não encontrada.</div>;

  return (
    <div>
      <PageHeader
        title={biblioteca.nome}
        subtitle={biblioteca.descricao || "Conteúdo técnico da biblioteca."}
        actions={
          <Button variant="outline" onClick={() => nav(`${BASE}/biblioteca-medidas`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        }
      />
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="py-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs px-2 py-1 rounded bg-muted">{biblioteca.codigo}</span>
              <Badge variant="outline">v{biblioteca.versao}</Badge>
              <Badge variant="outline">{STATUS_BIB_LABEL[biblioteca.status]}</Badge>
              {biblioteca.vigente && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Vigente</Badge>}
              {biblioteca.status === "publicada" && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Conteúdo imutável
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {biblioteca.fonte && <span>Fonte: {biblioteca.fonte}</span>}
              {biblioteca.publicado_em && <span className="ml-3">Publicada em {formatDate(biblioteca.publicado_em)}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              {/* filtros */}
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, título, orientações…" className="pl-9" />
            </div>
            <Select value={filtroFator} onValueChange={setFiltroFator}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Fator" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fatores</SelectItem>
                {fatores.map((f) => <SelectItem key={f.fator_codigo} value={f.fator_codigo}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroNivel} onValueChange={setFiltroNivel}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="essencial">Essencial</SelectItem>
                <SelectItem value="estruturante">Estruturante</SelectItem>
                <SelectItem value="complementar">Complementar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => { setBusca(""); setFiltroFator("all"); setFiltroNivel("all"); }}>Limpar</Button>
            <div className="text-xs text-muted-foreground ml-auto">
              {medidasFiltradas.length} de {medidas.length} medidas
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {fatoresVisiveis.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum resultado com os filtros aplicados.</CardContent></Card>
          ) : (
            fatoresVisiveis.map((f) => <FatorCard key={f.id} f={f} medidas={medidasFiltradas} />)
          )}
        </div>
      </div>
    </div>
  );
}