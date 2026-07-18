import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Lock, ClipboardList, Wand2, ChevronDown, Info, Save } from "lucide-react";
import {
  PLANO_STATUS_COLOR, PLANO_STATUS_LABEL, NIVEL_COLOR, PlanoStatus,
  adicionarMedidaDoModelo, atualizarItem, atualizarPlano, criarItemPersonalizado, excluirItem,
  getMedidasCatalogo, getPlanoPorRevisao, getResultadoFatoresPorRevisao, listItens, listItemFatores,
  marcarPlanoRevisado, regenerarRecomendacoes,
} from "@/lib/psicoPlano";
import { getRevisaoAtiva, getRevisaoFatores, PRIORIDADE_COLOR } from "@/lib/psicoRevisao";
import PsicoAprovacaoConsolidada from "./PsicoAprovacaoConsolidada";

function ChipList({ items, empty = "—" }: { items?: string[] | null; empty?: string }) {
  if (!items || items.length === 0) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return <div className="flex flex-wrap gap-1.5">{items.map((x, i) => <span key={i} className="text-[11px] rounded-full bg-muted px-2 py-0.5">{x}</span>)}</div>;
}

export default function PsicoPlanoTab({ av, onReload }: { av: any; onReload?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rev, setRev] = useState<any>(null);
  const [plano, setPlano] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [itemFatores, setItemFatores] = useState<Record<string, string[]>>({});
  const [fatoresRev, setFatoresRev] = useState<any[]>([]);
  const [fatorResult, setFatorResult] = useState<Record<string, string>>({});
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [filtroFator, setFiltroFator] = useState<string>("all");
  const [filtroNivel, setFiltroNivel] = useState<string>("all");
  const [somenteSelecionados, setSomenteSelecionados] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenText, setRegenText] = useState("");
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState<any>({ titulo: "", acao_recomendada: "", objetivo: "", prazo_sugerido_dias: 30, evidencias_recomendadas: "", responsaveis_sugeridos: "", fatores: [] as string[] });

  async function load() {
    setLoading(true);
    try {
      const r = await getRevisaoAtiva(av.id);
      setRev(r);
      if (!r) return;
      const [p, fs, mfr] = await Promise.all([
        getPlanoPorRevisao(r.id), getRevisaoFatores(r.id), getResultadoFatoresPorRevisao(r.id),
      ]);
      setPlano(p); setFatoresRev(fs); setFatorResult(mfr);
      if (p) {
        const [it, ifs, cat] = await Promise.all([
          listItens(p.id),
          listItemFatores(p.id),
          getMedidasCatalogo(r.biblioteca_versao_id),
        ]);
        setItens(it);
        const map: Record<string, string[]> = {};
        (ifs as any[]).forEach((x) => { (map[x.plano_item_id] ||= []).push(x.fator_codigo); });
        setItemFatores(map);
        setCatalogo(cat);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [av?.id]);

  const readOnly = plano?.status === "aprovado" || rev?.status === "aprovada";

  const itensFiltrados = useMemo(() => {
    return itens.filter((i) => {
      if (somenteSelecionados && !i.selecionado) return false;
      if (filtroNivel !== "all" && i.nivel_recomendacao !== filtroNivel) return false;
      if (filtroFator !== "all") {
        const codes = itemFatores[i.id] || [];
        if (!codes.includes(filtroFator)) return false;
      }
      return true;
    });
  }, [itens, itemFatores, filtroFator, filtroNivel, somenteSelecionados]);

  const totalSelecionados = itens.filter((i) => i.selecionado).length;

  async function toggleItem(item: any, v: boolean) {
    const { error } = await atualizarItem(item.id, { selecionado: v });
    if (error) { toast.error(error.message); return; }
    setItens((p) => p.map((x) => (x.id === item.id ? { ...x, selecionado: v } : x)));
  }

  async function salvarCampo(item: any, patch: Record<string, any>) {
    const { error } = await atualizarItem(item.id, patch);
    if (error) { toast.error(error.message); return; }
    setItens((p) => p.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
  }

  async function removerItem(item: any) {
    const { error } = await excluirItem(item.id);
    if (error) { toast.error(error.message); return; }
    setItens((p) => p.filter((x) => x.id !== item.id));
    const cp = { ...itemFatores }; delete cp[item.id]; setItemFatores(cp);
    toast.success("Item removido");
  }

  async function regenerar() {
    const esperado = `REGENERAR ${av.codigo}`;
    if (regenText !== esperado) { toast.error(`Digite exatamente: ${esperado}`); return; }
    const { error } = await regenerarRecomendacoes(rev.id, regenText);
    if (error) { toast.error(error.message); return; }
    toast.success("Recomendações regeneradas (personalizadas preservadas)");
    setRegenOpen(false); setRegenText(""); load();
  }

  async function marcarRevisado() {
    if (!plano) return;
    const { error } = await marcarPlanoRevisado(plano.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano marcado como revisado"); load();
  }

  async function adicionarDoCatalogo(medidaId: string, fatoresCodes: string[]) {
    if (!plano) return;
    if (fatoresCodes.length === 0) { toast.error("Selecione ao menos um fator"); return; }
    const { error } = await adicionarMedidaDoModelo(plano.id, medidaId, fatoresCodes, fatorResult);
    if (error) { toast.error((error as any).message); return; }
    toast.success("Medida adicionada ao plano"); load();
  }

  async function adicionarPersonalizado() {
    if (!plano) return;
    if (!novo.titulo?.trim()) { toast.error("Título é obrigatório"); return; }
    if (!novo.fatores.length) { toast.error("Vincule pelo menos um fator"); return; }
    const { error } = await criarItemPersonalizado(plano.id, {
      titulo: novo.titulo, acao_recomendada: novo.acao_recomendada || novo.titulo,
      objetivo: novo.objetivo || null,
      nivel_recomendacao: "transversal",
      prazo_sugerido_dias: Number(novo.prazo_sugerido_dias) || null,
      responsaveis_sugeridos: (novo.responsaveis_sugeridos || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      evidencias_recomendadas: (novo.evidencias_recomendadas || "").split(",").map((s: string) => s.trim()).filter(Boolean),
    }, novo.fatores, fatorResult);
    if (error) { toast.error((error as any).message); return; }
    toast.success("Ação personalizada criada");
    setNovoOpen(false);
    setNovo({ titulo: "", acao_recomendada: "", objetivo: "", prazo_sugerido_dias: 30, evidencias_recomendadas: "", responsaveis_sugeridos: "", fatores: [] });
    load();
  }

  if (loading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>;

  if (!rev) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Crie a revisão técnica antes de acessar o plano de ação.</CardContent></Card>;
  }
  if (!plano) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Plano de ação indisponível.</CardContent></Card>;
  }

  const status = plano.status as PlanoStatus;
  const fatorSet = fatoresRev;
  const catalogoFiltrado = catalogo.filter((m) => filtroFator === "all" ? true : m.fator_codigo === filtroFator);

  return (
    <div className="space-y-4">
      <PsicoAprovacaoConsolidada avaliacaoId={av.id} avaliacaoCodigo={av.codigo} refreshKey={plano?.atualizado_em} />
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={PLANO_STATUS_COLOR[status]}>{PLANO_STATUS_LABEL[status]}</Badge>
            <span className="text-xs text-muted-foreground">
              {totalSelecionados} de {itens.length} ações selecionadas · Modo {plano.modo}
            </span>
            {readOnly && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Imutável</span>}
          </div>
          <div className="flex gap-2">
            {!readOnly && (
              <>
                <Dialog open={catalogoOpen} onOpenChange={setCatalogoOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><ClipboardList className="h-4 w-4 mr-2" /> Adicionar do catálogo</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Catálogo de medidas</DialogTitle>
                      <DialogDescription>Selecione uma medida modelo e vincule aos fatores desta avaliação.</DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 mb-2">
                      <Select value={filtroFator} onValueChange={setFiltroFator}>
                        <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os fatores</SelectItem>
                          {fatorSet.map((f) => <SelectItem key={f.fator_codigo} value={f.fator_codigo}>{f.fator_codigo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="max-h-[60vh] overflow-auto space-y-2">
                      {catalogoFiltrado.map((m) => (
                        <CatalogoRow key={m.id} m={m} fatoresRev={fatorSet} onAdd={(codes) => adicionarDoCatalogo(m.id, codes)} />
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> Ação personalizada</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Nova ação personalizada</DialogTitle></DialogHeader>
                    <div className="grid gap-3">
                      <div><Label>Título *</Label><Input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></div>
                      <div><Label>Objetivo</Label><Textarea rows={2} value={novo.objetivo} onChange={(e) => setNovo({ ...novo, objetivo: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Prazo (dias)</Label><Input type="number" value={novo.prazo_sugerido_dias} onChange={(e) => setNovo({ ...novo, prazo_sugerido_dias: e.target.value })} /></div>
                        <div><Label>Responsáveis (separe por vírgula)</Label><Input value={novo.responsaveis_sugeridos} onChange={(e) => setNovo({ ...novo, responsaveis_sugeridos: e.target.value })} /></div>
                      </div>
                      <div><Label>Evidências recomendadas (separe por vírgula)</Label><Input value={novo.evidencias_recomendadas} onChange={(e) => setNovo({ ...novo, evidencias_recomendadas: e.target.value })} /></div>
                      <div>
                        <Label>Fatores vinculados *</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {fatorSet.map((f) => {
                            const on = novo.fatores.includes(f.fator_codigo);
                            return (
                              <button key={f.fator_codigo} type="button"
                                className={`text-xs px-2 py-1 rounded border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                                onClick={() => setNovo({ ...novo, fatores: on ? novo.fatores.filter((x: string) => x !== f.fator_codigo) : [...novo.fatores, f.fator_codigo] })}>
                                {f.fator_codigo}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setNovoOpen(false)}>Cancelar</Button>
                      <Button onClick={adicionarPersonalizado}><Save className="h-4 w-4 mr-2" /> Criar ação</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm"><Wand2 className="h-4 w-4 mr-2" /> Regenerar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regenerar recomendações?</AlertDialogTitle>
                      <AlertDialogDescription>
                        As ações personalizadas serão preservadas. As geradas automaticamente serão recriadas a partir da biblioteca vigente. Confirme digitando: <b>REGENERAR {av.codigo}</b>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input value={regenText} onChange={(e) => setRegenText(e.target.value)} placeholder={`REGENERAR ${av.codigo}`} />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={(e) => { e.preventDefault(); regenerar(); }}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {status === "rascunho" && (
                  <Button size="sm" onClick={marcarRevisado}>Marcar como revisado</Button>
                )}
              </>
            )}
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 flex flex-wrap gap-3 items-center">
          <Select value={filtroFator} onValueChange={setFiltroFator}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Fator" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fatores</SelectItem>
              {fatorSet.map((f) => <SelectItem key={f.fator_codigo} value={f.fator_codigo}>{f.fator_codigo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroNivel} onValueChange={setFiltroNivel}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Nível" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              <SelectItem value="basica">Básica</SelectItem>
              <SelectItem value="intermediaria">Intermediária</SelectItem>
              <SelectItem value="avancada">Avançada</SelectItem>
              <SelectItem value="transversal">Transversal</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={somenteSelecionados} onCheckedChange={(v) => setSomenteSelecionados(!!v)} /> Somente selecionadas
          </label>
          <div className="ml-auto text-xs text-muted-foreground">
            {itensFiltrados.length} de {itens.length} exibidas
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {itensFiltrados.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma ação com os filtros aplicados.</CardContent></Card>
        ) : itensFiltrados.map((i) => (
          <ItemCard key={i.id} item={i}
            fatores={itemFatores[i.id] || []}
            readOnly={readOnly}
            onToggle={(v) => toggleItem(i, v)}
            onSave={(patch) => salvarCampo(i, patch)}
            onRemove={() => removerItem(i)}
          />
        ))}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Cada ação selecionada precisa de responsável, prazo e evidência para validar o plano. A aprovação da revisão consolida e trava o plano.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function CatalogoRow({ m, fatoresRev, onAdd }: { m: any; fatoresRev: any[]; onAdd: (codes: string[]) => void }) {
  const [codes, setCodes] = useState<string[]>([m.fator_codigo]);
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted">{m.codigo}</span>
        <Badge className={NIVEL_COLOR[m.nivel_recomendacao]}>{m.nivel_recomendacao}</Badge>
        {m.grupo_transversal && <Badge variant="outline" className="text-[10px]">{m.grupo_transversal}</Badge>}
        <span className="text-sm font-medium">{m.titulo}</span>
      </div>
      {m.o_que_significa && <p className="text-xs text-muted-foreground">{m.o_que_significa}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs">Vincular a:</span>
        {fatoresRev.map((f) => {
          const on = codes.includes(f.fator_codigo);
          return (
            <button key={f.fator_codigo} type="button"
              className={`text-[11px] px-2 py-0.5 rounded border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
              onClick={() => setCodes(on ? codes.filter((c) => c !== f.fator_codigo) : [...codes, f.fator_codigo])}>
              {f.fator_codigo}
            </button>
          );
        })}
        <Button size="sm" className="ml-auto" onClick={() => onAdd(codes)}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
      </div>
    </div>
  );
}

function ItemCard({ item, fatores, readOnly, onToggle, onSave, onRemove }: {
  item: any; fatores: string[]; readOnly: boolean;
  onToggle: (v: boolean) => void;
  onSave: (patch: Record<string, any>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const missing = item.selecionado && (
    (!item.responsavel_definido && (!item.responsaveis_sugeridos || item.responsaveis_sugeridos.length === 0)) ||
    !item.prazo_sugerido_dias ||
    !item.evidencias_recomendadas || item.evidencias_recomendadas.length === 0
  );
  return (
    <Card className={item.selecionado ? "" : "opacity-70"}>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          <Checkbox checked={item.selecionado} disabled={readOnly} onCheckedChange={(v) => onToggle(!!v)} className="mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {item.codigo_origem && <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted">{item.codigo_origem}</span>}
              {item.nivel_recomendacao && <Badge className={NIVEL_COLOR[item.nivel_recomendacao] || "bg-muted"}>{item.nivel_recomendacao}</Badge>}
              {item.prioridade && <Badge className={PRIORIDADE_COLOR[item.prioridade] || "bg-muted"}>{item.prioridade}</Badge>}
              {item.grupo_transversal && <Badge variant="outline" className="text-[10px]">{item.grupo_transversal}</Badge>}
              {item.personalizado && <Badge variant="outline" className="text-[10px]">Personalizada</Badge>}
              {missing && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Pendente</Badge>}
              <span className="text-sm font-medium">{item.titulo}</span>
              <span className="ml-auto flex gap-2">
                {fatores.map((c) => <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c}</span>)}
                <button className="text-muted-foreground" onClick={() => setOpen((v) => !v)}>
                  <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {!readOnly && item.personalizado && (
                  <button className="text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /></button>
                )}
              </span>
            </div>
            {item.objetivo && !open && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.objetivo}</p>}

            {open && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {item.objetivo && (
                  <div className="md:col-span-2">
                    <Label className="text-[11px] uppercase text-muted-foreground">Objetivo</Label>
                    <p className="text-sm">{item.objetivo}</p>
                  </div>
                )}
                <div>
                  <Label className="text-[11px] uppercase text-muted-foreground">Orientações práticas</Label>
                  {item.orientacoes_praticas?.length ? <ul className="list-disc pl-5 text-sm">{item.orientacoes_praticas.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : <p className="text-xs text-muted-foreground">—</p>}
                </div>
                <div>
                  <Label className="text-[11px] uppercase text-muted-foreground">Exemplos</Label>
                  {item.exemplos_aplicacao?.length ? <ul className="list-disc pl-5 text-sm">{item.exemplos_aplicacao.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : <p className="text-xs text-muted-foreground">—</p>}
                </div>
                <div>
                  <Label className="text-xs">Responsável definido</Label>
                  <Input defaultValue={item.responsavel_definido || ""} disabled={readOnly}
                    onBlur={(e) => e.target.value !== (item.responsavel_definido || "") && onSave({ responsavel_definido: e.target.value || null })} />
                  <div className="mt-1"><ChipList items={item.responsaveis_sugeridos} empty="Sem sugestões" /></div>
                </div>
                <div>
                  <Label className="text-xs">Prazo (dias)</Label>
                  <Input type="number" defaultValue={item.prazo_sugerido_dias ?? ""} disabled={readOnly}
                    onBlur={(e) => Number(e.target.value || 0) !== (item.prazo_sugerido_dias ?? 0) && onSave({ prazo_sugerido_dias: Number(e.target.value) || null })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Evidências recomendadas (separe por vírgula)</Label>
                  <Input
                    defaultValue={(item.evidencias_recomendadas || []).join(", ")}
                    disabled={readOnly}
                    onBlur={(e) => {
                      const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                      const cur = item.evidencias_recomendadas || [];
                      if (JSON.stringify(arr) !== JSON.stringify(cur)) onSave({ evidencias_recomendadas: arr });
                    }}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Indicador</Label>
                  <Input defaultValue={item.indicador_sugerido || ""} disabled={readOnly}
                    onBlur={(e) => e.target.value !== (item.indicador_sugerido || "") && onSave({ indicador_sugerido: e.target.value || null })} />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
