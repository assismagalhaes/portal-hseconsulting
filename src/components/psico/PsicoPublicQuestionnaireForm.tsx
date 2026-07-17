import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Pencil } from "lucide-react";

type Pergunta = { numero: number; texto: string; exemplo: string | null };
type Opcao = { codigo: string; rotulo: string };

export type QuestionarioPublico = {
  nome: string;
  subtitulo: string | null;
  texto_abertura: string | null;
  aviso_nao_avaliacao_psicologica: string | null;
  orientacao_periodo_referencia: string | null;
  fonte_referencia: string | null;
  nota_metodologica: string | null;
  quantidade_perguntas: number; tempo_estimado_minutos: number;
  perguntas: Pergunta[]; opcoes: Opcao[];
};

type Fase = "intro" | "form" | "review" | "enviando" | "sucesso" | "ja_respondido" | "expirada";

const ETAPAS = [[1, 7], [8, 14], [15, 21], [22, 28], [29, 35]] as const;

export default function PsicoPublicQuestionnaireForm({
  questionario, sessao, empresa,
}: { questionario: QuestionarioPublico; sessao: string; empresa: string | null }) {
  const [fase, setFase] = useState<Fase>("intro");
  const [etapaIdx, setEtapaIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const primeiraPendenteRef = useRef<HTMLDivElement | null>(null);
  const sessaoRef = useRef<string>(sessao);

  // beforeunload após iniciar preenchimento
  useEffect(() => {
    if (fase !== "form" && fase !== "review") return;
    if (Object.keys(respostas).length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [fase, respostas]);

  const totalRespondidas = Object.keys(respostas).length;
  const perguntasPorEtapa = useMemo(() => {
    return ETAPAS.map(([ini, fim]) => questionario.perguntas.filter((p) => p.numero >= ini && p.numero <= fim));
  }, [questionario.perguntas]);

  function marcar(num: number, cod: string) {
    setRespostas((r) => ({ ...r, [num]: cod }));
    setErro(null);
  }

  function iniciar() { setFase("form"); setEtapaIdx(0); }

  function continuar() {
    const [ini, fim] = ETAPAS[etapaIdx];
    for (let n = ini; n <= fim; n++) {
      if (!respostas[n]) {
        setErro(`Responda a pergunta ${String(n).padStart(2, "0")} para continuar.`);
        setTimeout(() => primeiraPendenteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 20);
        return;
      }
    }
    if (etapaIdx < ETAPAS.length - 1) { setEtapaIdx(etapaIdx + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else { setFase("review"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  async function enviar() {
    setEnviando(true); setConfirmOpen(false); setFase("enviando");
    const payload = Array.from({ length: 35 }, (_, i) => ({ numero: i + 1, opcao: respostas[i + 1] }));
    try {
      const { data, error } = await supabase.functions.invoke("psico-enviar-respostas", {
        body: { sessao: sessaoRef.current, respostas: payload },
      });
      if (error) { setFase("review"); setErro("Não foi possível enviar. Tente novamente."); return; }
      const status = (data as any)?.status;
      if (status === "registrada") {
        setRespostas({}); sessaoRef.current = ""; setFase("sucesso");
      } else if (status === "ja_respondido") {
        setRespostas({}); sessaoRef.current = ""; setFase("ja_respondido");
      } else if (status === "rate_limited") {
        setFase("review");
        setErro("Não foi possível concluir o envio neste momento. Aguarde alguns minutos e tente novamente.");
      } else {
        setFase("review"); setErro("Não foi possível concluir o envio.");
      }
    } catch {
      setFase("review"); setErro("Falha de rede. Tente novamente.");
    } finally { setEnviando(false); }
  }

  if (fase === "intro") {
    return (
      <Layout>
        <Header empresa={empresa} />
        <h1 className="text-xl font-semibold">{questionario.nome}</h1>
        {questionario.subtitulo && (
          <p className="text-sm text-muted-foreground">{questionario.subtitulo}</p>
        )}
        {(questionario.texto_abertura || questionario.aviso_nao_avaliacao_psicologica || questionario.orientacao_periodo_referencia) && (
          <div className="text-sm space-y-3 text-left bg-card border rounded p-4 whitespace-pre-line">
            {questionario.texto_abertura && <p>{questionario.texto_abertura}</p>}
            {questionario.aviso_nao_avaliacao_psicologica && <p>{questionario.aviso_nao_avaliacao_psicologica}</p>}
            {questionario.orientacao_periodo_referencia && <p>{questionario.orientacao_periodo_referencia}</p>}
          </div>
        )}
        <ul className="text-xs text-muted-foreground list-disc list-inside text-left">
          <li>{questionario.quantidade_perguntas} perguntas — aproximadamente {questionario.tempo_estimado_minutos} minutos</li>
          <li>Todas as perguntas são obrigatórias</li>
          <li>Não há respostas certas ou erradas</li>
          <li>Após o envio não será possível alterar</li>
          <li>Não há salvamento parcial</li>
        </ul>
        {(questionario.fonte_referencia || questionario.nota_metodologica) && (
          <div className="text-[11px] text-muted-foreground text-left border-t pt-3 space-y-1 whitespace-pre-line">
            {questionario.fonte_referencia && <div><strong>Fonte:</strong> {questionario.fonte_referencia}</div>}
            {questionario.nota_metodologica && <div>{questionario.nota_metodologica}</div>}
          </div>
        )}
        <Button onClick={iniciar} className="w-full">Iniciar questionário</Button>
      </Layout>
    );
  }

  if (fase === "form") {
    const [ini, fim] = ETAPAS[etapaIdx];
    const perguntas = perguntasPorEtapa[etapaIdx];
    const primeiraSemResp = perguntas.find((p) => !respostas[p.numero])?.numero ?? null;
    return (
      <Layout wide>
        <Progress atual={totalRespondidas} etapa={etapaIdx + 1} />
        <div className="text-xs text-muted-foreground">Etapa {etapaIdx + 1} de {ETAPAS.length} · perguntas {ini}–{fim}</div>
        <div className="space-y-4">
          {perguntas.map((p) => {
            const isPend = primeiraSemResp === p.numero && !!erro;
            return (
              <div key={p.numero} ref={isPend ? primeiraPendenteRef : undefined}>
                <PerguntaCard p={p} opcoes={questionario.opcoes} valor={respostas[p.numero]} onChange={(c) => marcar(p.numero, c)} destacado={isPend} />
              </div>
            );
          })}
        </div>
        {erro && <div role="alert" className="text-sm text-destructive">{erro}</div>}
        <div className="flex justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t">
          <Button variant="outline" onClick={() => { if (etapaIdx === 0) setFase("intro"); else { setEtapaIdx(etapaIdx - 1); setErro(null); } }}>Voltar</Button>
          <Button onClick={continuar}>{etapaIdx === ETAPAS.length - 1 ? "Revisar respostas" : "Continuar"}</Button>
        </div>
      </Layout>
    );
  }

  if (fase === "review") {
    const faltando = questionario.perguntas.filter((p) => !respostas[p.numero]);
    return (
      <Layout wide>
        <h2 className="text-lg font-semibold">Revisão das respostas</h2>
        <p className="text-sm text-muted-foreground">Confira antes de enviar. Após o envio, não será possível alterar.</p>
        <div className="text-sm">{35 - faltando.length} de 35 perguntas respondidas.</div>
        {faltando.length > 0 && (
          <div className="text-sm text-destructive">Ainda existem {faltando.length} pergunta(s) sem resposta: {faltando.map((f) => String(f.numero).padStart(2, "0")).join(", ")}.</div>
        )}
        <div className="space-y-2">
          {ETAPAS.map(([ini, fim], i) => (
            <div key={i} className="border rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <strong className="text-sm">Etapa {i + 1} · perguntas {ini}–{fim}</strong>
                <Button size="sm" variant="ghost" onClick={() => { setEtapaIdx(i); setFase("form"); setErro(null); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
              </div>
              <ul className="space-y-1 text-xs">
                {questionario.perguntas.filter((p) => p.numero >= ini && p.numero <= fim).map((p) => (
                  <li key={p.numero} className="flex gap-2">
                    <span className="font-mono text-muted-foreground">{String(p.numero).padStart(2, "0")}</span>
                    <span className="flex-1 truncate">{p.texto}</span>
                    <span className="font-medium">{questionario.opcoes.find((o) => o.codigo === respostas[p.numero])?.rotulo ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {erro && <div role="alert" className="text-sm text-destructive">{erro}</div>}
        <div className="flex justify-between gap-3">
          <Button variant="outline" onClick={() => { setFase("form"); setEtapaIdx(ETAPAS.length - 1); }}>Voltar ao questionário</Button>
          <Button disabled={faltando.length > 0 || enviando} onClick={() => setConfirmOpen(true)}>Enviar respostas</Button>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar envio</DialogTitle>
              <DialogDescription>
                Após o envio, suas respostas serão registradas de forma definitiva e não poderão ser alteradas. Sua identificação permanecerá separada do conteúdo respondido.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Voltar e revisar</Button>
              <Button onClick={enviar} disabled={enviando}>Confirmar envio</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  if (fase === "enviando") {
    return <Layout><p className="text-sm text-muted-foreground py-8">Enviando suas respostas…</p></Layout>;
  }

  if (fase === "sucesso") {
    return (
      <Layout>
        <Header empresa={empresa} />
        <div className="flex flex-col items-center gap-3 py-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <h2 className="text-lg font-semibold">Participação registrada com sucesso</h2>
        </div>
        <p className="text-sm">Obrigado pela sua participação. Suas respostas foram registradas e serão utilizadas somente na análise coletiva da avaliação.</p>
        <p className="text-xs text-muted-foreground">A empresa receberá resultados coletivos consolidados, sem acesso às respostas individuais.</p>
      </Layout>
    );
  }

  if (fase === "ja_respondido") {
    return (
      <Layout>
        <Header empresa={empresa} />
        <h2 className="text-lg font-semibold">Participação já registrada</h2>
        <p className="text-sm">Este acesso já foi utilizado e a participação correspondente já foi registrada.</p>
      </Layout>
    );
  }

  return null;
}

function Layout({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-background flex justify-center p-4 sm:p-6">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} space-y-4 text-center`}>{children}</div>
    </div>
  );
}
function Header({ empresa }: { empresa: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">HSE Consulting</div>
      {empresa && <div className="text-xs text-muted-foreground mt-1">Avaliação para: <strong>{empresa}</strong></div>}
    </div>
  );
}
function Progress({ atual, etapa }: { atual: number; etapa: number }) {
  const pct = Math.round((atual / 35) * 100);
  return (
    <div className="text-left">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{atual} de 35 perguntas respondidas</span>
        <span>Etapa {etapa}/5</span>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
function PerguntaCard({ p, opcoes, valor, onChange, destacado }: { p: Pergunta; opcoes: Opcao[]; valor?: string; onChange: (c: string) => void; destacado?: boolean }) {
  const descId = p.exemplo ? `p${p.numero}-exemplo` : undefined;
  return (
    <Card className={destacado ? "border-destructive" : ""}>
      <CardContent className="py-4 text-left space-y-3">
        <div>
          <div className="text-xs text-muted-foreground font-mono">Pergunta {String(p.numero).padStart(2, "0")}</div>
          <div className="text-sm font-medium mt-1">{p.texto}</div>
          {p.exemplo && <div id={descId} className="text-xs text-muted-foreground mt-1">{p.exemplo}</div>}
        </div>
        <RadioGroup value={valor || ""} onValueChange={onChange} aria-describedby={descId} className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {opcoes.map((o) => (
            <Label key={o.codigo} htmlFor={`p${p.numero}-${o.codigo}`}
              className={`flex items-start gap-2 rounded border px-3 py-2 cursor-pointer text-sm min-w-0 ${valor === o.codigo ? "border-primary bg-primary/5" : "border-input"}`}>
              <RadioGroupItem value={o.codigo} id={`p${p.numero}-${o.codigo}`} className="shrink-0" />
              <span className="leading-tight break-words flex-1">{o.rotulo}</span>
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}