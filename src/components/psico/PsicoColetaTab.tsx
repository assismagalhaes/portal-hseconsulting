import { useEffect, useState } from "react";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Play, CalendarClock, Square, ShieldAlert, Loader2 } from "lucide-react";
import {
  ResumoColeta, ChecklistItem, calcularChecklist, getResumoColeta,
  abrirColeta, prorrogarColeta, encerrarColeta,
} from "@/lib/psicoColeta";
import { formatDate, formatDateTime } from "@/lib/format";

export default function PsicoColetaTab({ av, onReload }: { av: any; onReload: () => void }) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [resumo, setResumo] = useState<ResumoColeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [openAbrir, setOpenAbrir] = useState(false);
  const [openProrrogar, setOpenProrrogar] = useState(false);
  const [openEncerrar, setOpenEncerrar] = useState(false);
  const [confAbrir, setConfAbrir] = useState("");
  const [confEncerrar, setConfEncerrar] = useState("");
  const [novaData, setNovaData] = useState("");
  const [motivoProrrogar, setMotivoProrrogar] = useState("");
  const [motivoEncerrar, setMotivoEncerrar] = useState("");

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [av.id, av.status]);
  useEffect(() => {
    if (av.status !== "coleta_em_andamento") return;
    const t = setInterval(() => { void loadResumo(); }, 30000);
    return () => clearInterval(t);
  }, [av.id, av.status]);

  async function refresh() {
    setLoading(true);
    if (av.status === "rascunho") setChecklist(await calcularChecklist(av));
    if (["coleta_em_andamento", "coleta_encerrada"].includes(av.status)) await loadResumo();
    setLoading(false);
  }
  async function loadResumo() {
    const { data, error } = await getResumoColeta(av.id);
    if (!error) setResumo(data as ResumoColeta);
  }

  const podeAbrir = checklist.length > 0 && checklist.every((c) => c.ok);
  const codigo = av.codigo;

  function handleAbrirOpenChange(open: boolean) {
    setOpenAbrir(open);
    if (!open) setConfAbrir("");
  }

  function handleProrrogarOpenChange(open: boolean) {
    setOpenProrrogar(open);
    if (!open) {
      setNovaData("");
      setMotivoProrrogar("");
    }
  }

  function handleEncerrarOpenChange(open: boolean) {
    setOpenEncerrar(open);
    if (!open) {
      setConfEncerrar("");
      setMotivoEncerrar("");
    }
  }

  async function handleAbrir() {
    const { error } = await abrirColeta(av.id, confAbrir.trim());
    if (error) return toast.error(error.message);
    toast.success("Coleta aberta");
    handleAbrirOpenChange(false); onReload();
  }
  async function handleProrrogar() {
    if (!novaData) return toast.error("Informe a nova data");
    if (motivoProrrogar.trim().length < 10) return toast.error("Motivo mínimo 10 caracteres");
    const { error } = await prorrogarColeta(av.id, novaData, motivoProrrogar.trim());
    if (error) return toast.error(error.message);
    toast.success("Prazo prorrogado");
    handleProrrogarOpenChange(false); onReload();
  }
  async function handleEncerrar() {
    const { error } = await encerrarColeta(av.id, confEncerrar.trim(), motivoEncerrar.trim() || undefined);
    if (error) return toast.error(error.message);
    toast.success("Coleta encerrada");
    handleEncerrarOpenChange(false); onReload();
  }

  if (av.status === "cancelada") {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Avaliação cancelada.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {av.status === "rascunho" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Checklist de abertura</CardTitle>
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((c) => (
              <div key={c.chave} className="flex items-center gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <span>{c.label}</span>
                {!c.ok && c.erro && <span className="text-xs text-muted-foreground">({c.erro})</span>}
              </div>
            ))}
            <div className="pt-3 flex items-center gap-3">
              <Button disabled={!podeAbrir} onClick={() => setOpenAbrir(true)}>
                <Play className="h-4 w-4 mr-2" /> Abrir coleta
              </Button>
              {!podeAbrir && <span className="text-xs text-muted-foreground">Corrija os itens marcados acima.</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {(av.status === "coleta_em_andamento" || av.status === "coleta_encerrada") && resumo && (
        <>
          {!resumo.integridade_ok && (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>Foi identificada divergência entre o controle de participação e a quantidade de respostas. Não encerre ou processe a coleta até a correção técnica.</span>
            </div>
          )}
          {av.status === "coleta_em_andamento" && resumo.prazo_expirado && (
            <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-3 text-sm">
              O prazo da coleta terminou, mas a avaliação ainda não foi encerrada formalmente.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Participantes ativos" value={resumo.participantes_ativos_atuais} />
            <Kpi label="Acessaram" value={resumo.acessaram} />
            <Kpi label="Respondidos" value={resumo.respondidos} />
            <Kpi label="Pendentes" value={resumo.pendentes} />
            <Kpi label="Participação" value={`${resumo.percentual_participacao}%`} />
            <Kpi label="Prazo" value={resumo.prazo ? formatDate(resumo.prazo) : "—"} />
            <Kpi label="Na abertura" value={resumo.participantes_na_abertura ?? "—"} />
            <Kpi label="Respostas anônimas" value={resumo.respostas_anonimas} />
          </div>

          <Card>
            <CardContent className="py-4 grid gap-2 sm:grid-cols-2 text-sm">
              <div>Aberta em: <strong>{resumo.coleta_aberta_em ? formatDateTime(resumo.coleta_aberta_em) : "—"}</strong></div>
              <div>Encerrada em: <strong>{resumo.coleta_encerrada_em ? formatDateTime(resumo.coleta_encerrada_em) : "—"}</strong></div>
              <div>Convites ativos: <strong>{resumo.convites_ativos}</strong></div>
              <div>Convites distribuídos: <strong>{resumo.convites_distribuidos}</strong></div>
            </CardContent>
          </Card>

          {av.status === "coleta_em_andamento" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadResumo}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button>
              <Button variant="outline" onClick={() => setOpenProrrogar(true)}><CalendarClock className="h-4 w-4 mr-2" /> Prorrogar prazo</Button>
              <Button variant="destructive" onClick={() => setOpenEncerrar(true)}><Square className="h-4 w-4 mr-2" /> Encerrar coleta</Button>
            </div>
          )}

          {av.status === "coleta_encerrada" && (
            <Card><CardContent className="py-3 text-sm">
              {resumo.respostas_anonimas === 0 && "Nenhuma resposta foi coletada."}
              {resumo.respostas_anonimas === 1 && "A amostra não atende ao mínimo global de 2 respondentes."}
              {resumo.respostas_anonimas >= 2 && resumo.respostas_anonimas < 5 && "Amostra reduzida. O processamento futuro deverá omitir segmentações."}
              {resumo.respostas_anonimas >= 5 && "A coleta foi encerrada e está pronta para a futura etapa de processamento."}
            </CardContent></Card>
          )}
        </>
      )}

      {/* Dialog abrir */}
      <Dialog open={openAbrir} onOpenChange={handleAbrirOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir coleta — {codigo}</DialogTitle>
            <DialogDescription>
              Após a abertura, os participantes poderão acessar e enviar o questionário. A versão metodológica permanecerá bloqueada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>Digite <span className="font-mono font-semibold">ABRIR {codigo}</span> para confirmar:</div>
            <Input value={confAbrir} onChange={(e) => setConfAbrir(e.target.value)} placeholder={`ABRIR ${codigo}`} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleAbrirOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleAbrir}>Abrir coleta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog prorrogar */}
      <Dialog open={openProrrogar} onOpenChange={handleProrrogarOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prorrogar prazo</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>Prazo atual: <strong>{av.data_fim_prevista ? formatDate(av.data_fim_prevista) : "—"}</strong></div>
            <div><Label>Nova data</Label><Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} /></div>
            <div><Label>Motivo (mín. 10 caracteres)</Label><Textarea rows={3} value={motivoProrrogar} onChange={(e) => setMotivoProrrogar(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleProrrogarOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleProrrogar}>Confirmar prorrogação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog encerrar */}
      <Dialog open={openEncerrar} onOpenChange={handleEncerrarOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Encerrar coleta — {codigo}</DialogTitle>
            <DialogDescription>Pendentes serão expirados. Respondidos permanecem inalterados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
            {openEncerrar && <PreviewEncerramento av={av} />}
            <div>Digite <span className="font-mono font-semibold">ENCERRAR {codigo}</span>:</div>
            <Input value={confEncerrar} onChange={(e) => setConfEncerrar(e.target.value)} placeholder={`ENCERRAR ${codigo}`} />
            <Label>Motivo (opcional, mín. 10 caracteres se informado)</Label>
            <Textarea rows={2} value={motivoEncerrar} onChange={(e) => setMotivoEncerrar(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleEncerrarOpenChange(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEncerrar}>Confirmar encerramento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewEncerramento({ av }: { av: any }) {
  const [loading, setLoading] = useState(true);
  const [totalPublico, setTotalPublico] = useState(0);
  const [identificadas, setIdentificadas] = useState(0);
  const [respostas, setRespostas] = useState<Array<{ funcao_normalizada: string | null; setor_normalizada: string | null; unidade_normalizada: string | null; funcao: string | null; setor: string | null; unidade: string | null; hash_nome: string | null }>>([]);

  useEffect(() => {
    if (av.modo_coleta !== "publico_anonimo") { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("psico_respostas_publicas")
        .select("funcao, setor, unidade, funcao_normalizada, setor_normalizada, unidade_normalizada, hash_nome")
        .eq("avaliacao_id", av.id)
        .limit(5000);
      if (cancel) return;
      const rs = (data || []) as any[];
      setRespostas(rs);
      setTotalPublico(rs.length);
      setIdentificadas(rs.filter((r) => r.hash_nome).length);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [av?.id, av?.modo_coleta]);

  const breakdown = useMemo(() => {
    function agg(dim: "funcao" | "setor" | "unidade") {
      const m = new Map<string, { rotulo: string; total: number }>();
      for (const r of respostas) {
        const norm = (r as any)[`${dim}_normalizada`] as string | null;
        if (!norm) continue;
        const rot = ((r as any)[dim] as string | null) || norm;
        const cur = m.get(norm) || { rotulo: rot, total: 0 };
        cur.total += 1;
        m.set(norm, cur);
      }
      const arr = Array.from(m.values()).sort((a, b) => b.total - a.total);
      const visiveis = arr.filter((x) => x.total >= 2);
      const suprimidos = arr.length - visiveis.length;
      return { arr, visiveis, suprimidos };
    }
    return { funcao: agg("funcao"), setor: agg("setor"), unidade: agg("unidade") };
  }, [respostas]);

  if (av.modo_coleta !== "publico_anonimo") {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Coleta nominal</AlertTitle>
        <AlertDescription>
          Convites pendentes serão marcados como expirados. Respostas já enviadas permanecem imutáveis.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <div className="py-4 text-center text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-2" />Calculando prévia…</div>;
  }

  const totalSuprimidos = breakdown.funcao.suprimidos + breakdown.setor.suprimidos + breakdown.unidade.suprimidos;

  return (
    <div className="space-y-3">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Prévia do encerramento</AlertTitle>
        <AlertDescription>
          Ao encerrar, as respostas públicas são materializadas em respostas oficiais e o resultado
          consolidado passa a ser gerado. Esta prévia mostra o que será processado.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2">
        <div className="border rounded p-2 text-center">
          <div className="text-2xl font-semibold">{totalPublico}</div>
          <div className="text-[11px] text-muted-foreground">Respostas anônimas coletadas</div>
        </div>
        <div className="border rounded p-2 text-center">
          <div className="text-2xl font-semibold">{identificadas}</div>
          <div className="text-[11px] text-muted-foreground">Com hash de identificação (dedup)</div>
        </div>
      </div>

      {totalPublico === 0 ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Nenhuma resposta recebida</AlertTitle>
          <AlertDescription>Encerrar agora manterá a avaliação sem resultado consolidado.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-2 md:grid-cols-3">
          {(["setor", "funcao", "unidade"] as const).map((dim) => {
            const b = breakdown[dim];
            if (b.arr.length === 0) return null;
            return (
              <div key={dim} className="border rounded p-2 text-xs space-y-1">
                <div className="font-medium capitalize">{dim === "funcao" ? "Por função" : `Por ${dim}`}</div>
                <ul className="space-y-0.5 max-h-32 overflow-auto">
                  {b.arr.slice(0, 8).map((x, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{x.rotulo}</span>
                      <span className="flex items-center gap-1">
                        <span className="font-mono">{x.total}</span>
                        {x.total < 2 && <Badge variant="outline" className="h-4 text-[9px] border-amber-400 text-amber-700">n&lt;2</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
                {b.suprimidos > 0 && (
                  <div className="text-[10px] text-amber-700">{b.suprimidos} recorte(s) serão suprimidos por sigilo.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalSuprimidos > 0 && (
        <div className="text-[11px] text-muted-foreground border-t pt-2">
          Total de recortes suprimidos por n&lt;2: <strong>{totalSuprimidos}</strong>. Esses grupos não
          aparecerão em nenhum relatório para preservar o anonimato exigido pela NR‑01.
        </div>
      )}
    </div>
  );
}

function AlertCircleIcon() { return <AlertTriangle className="h-4 w-4" />; }

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <Card><CardContent className="py-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </CardContent></Card>
  );
}
