import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Play, CalendarClock, Square } from "lucide-react";
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
  const [conf, setConf] = useState("");
  const [novaData, setNovaData] = useState("");
  const [motivo, setMotivo] = useState("");

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

  async function handleAbrir() {
    const { error } = await abrirColeta(av.id, conf.trim());
    if (error) return toast.error(error.message);
    toast.success("Coleta aberta");
    setOpenAbrir(false); setConf(""); onReload();
  }
  async function handleProrrogar() {
    if (!novaData) return toast.error("Informe a nova data");
    if (motivo.trim().length < 10) return toast.error("Motivo mínimo 10 caracteres");
    const { error } = await prorrogarColeta(av.id, novaData, motivo.trim());
    if (error) return toast.error(error.message);
    toast.success("Prazo prorrogado");
    setOpenProrrogar(false); setNovaData(""); setMotivo(""); onReload();
  }
  async function handleEncerrar() {
    const { error } = await encerrarColeta(av.id, conf.trim(), motivo.trim() || undefined);
    if (error) return toast.error(error.message);
    toast.success("Coleta encerrada");
    setOpenEncerrar(false); setConf(""); setMotivo(""); onReload();
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
      <Dialog open={openAbrir} onOpenChange={setOpenAbrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir coleta — {codigo}</DialogTitle>
            <DialogDescription>
              Após a abertura, os participantes poderão acessar e enviar o questionário. A versão metodológica permanecerá bloqueada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>Digite <span className="font-mono font-semibold">ABRIR {codigo}</span> para confirmar:</div>
            <Input value={conf} onChange={(e) => setConf(e.target.value)} placeholder={`ABRIR ${codigo}`} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenAbrir(false)}>Cancelar</Button>
            <Button onClick={handleAbrir}>Abrir coleta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog prorrogar */}
      <Dialog open={openProrrogar} onOpenChange={setOpenProrrogar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prorrogar prazo</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>Prazo atual: <strong>{av.data_fim_prevista ? formatDate(av.data_fim_prevista) : "—"}</strong></div>
            <div><Label>Nova data</Label><Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} /></div>
            <div><Label>Motivo (mín. 10 caracteres)</Label><Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenProrrogar(false)}>Cancelar</Button>
            <Button onClick={handleProrrogar}>Confirmar prorrogação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog encerrar */}
      <Dialog open={openEncerrar} onOpenChange={setOpenEncerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar coleta — {codigo}</DialogTitle>
            <DialogDescription>Pendentes serão expirados. Respondidos permanecem inalterados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>Digite <span className="font-mono font-semibold">ENCERRAR {codigo}</span>:</div>
            <Input value={conf} onChange={(e) => setConf(e.target.value)} placeholder={`ENCERRAR ${codigo}`} />
            <Label>Motivo (opcional, mín. 10 caracteres se informado)</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenEncerrar(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEncerrar}>Confirmar encerramento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <Card><CardContent className="py-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </CardContent></Card>
  );
}