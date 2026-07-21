import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Pencil } from "lucide-react";

type Pergunta = { numero: number; texto: string; exemplo: string | null };
type Opcao = { codigo: string; rotulo: string };
type Questionario = {
  nome: string;
  subtitulo: string | null;
  texto_abertura: string | null;
  aviso_nao_avaliacao_psicologica: string | null;
  orientacao_periodo_referencia: string | null;
  fonte_referencia: string | null;
  nota_metodologica: string | null;
  quantidade_perguntas: number;
  tempo_estimado_minutos: number;
  perguntas: Pergunta[];
  opcoes: Opcao[];
};
type CampoCfg = { ativo: boolean; obrigatorio: boolean };
type CamposIdent = { nome?: CampoCfg; funcao?: CampoCfg; setor?: CampoCfg; unidade?: CampoCfg };
type Bootstrap = {
  ok: true;
  disponivel: true;
  empresa: string | null;
  titulo: string;
  campos_identificacao: CamposIdent;
  registrar_participacao: boolean;
  questionario: Questionario;
} | { ok: true; disponivel: false; empresa: string | null; titulo: string; mensagem: string }
  | { ok: false; error: string; mensagem?: string };

type Fase = "carregando" | "indisponivel" | "identificacao" | "intro" | "form" | "review" | "enviando" | "sucesso" | "ja_respondido";

function chunkPerguntas(perguntas: Pergunta[]): [number, number][] {
  const total = perguntas.length;
  const passo = Math.max(5, Math.ceil(total / 5));
  const etapas: [number, number][] = [];
  for (let i = 0; i < total; i += passo) {
    const ini = perguntas[i].numero;
    const fim = perguntas[Math.min(i + passo - 1, total - 1)].numero;
    etapas.push([ini, fim]);
  }
  return etapas;
}

export default function PsicoResponderPublico() {
  const [token, setToken] = useState("");
  const [fase, setFase] = useState<Fase>("carregando");
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Identificação
  const [ident, setIdent] = useState({ nome: "", funcao: "", setor: "", unidade: "Matriz" });

  // Respostas
  const [etapaIdx, setEtapaIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const primeiraPendenteRef = useRef<HTMLDivElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    document.title = "Questionário Psicossocial | HSE";
    const meta = document.querySelector('meta[name="referrer"]') || (() => {
      const m = document.createElement("meta"); m.setAttribute("name", "referrer"); document.head.appendChild(m); return m;
    })();
    meta.setAttribute("content", "no-referrer");

    const raw = window.location.hash || "";
    const m = raw.match(/token=([^&]+)/);
    const tk = m ? decodeURIComponent(m[1]) : decodeURIComponent(raw.replace(/^#/, ""));
    if (tk) history.replaceState(null, "", window.location.pathname);
    setToken(tk);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("psico-responder-publico", {
          body: { action: "validar", token: tk },
        });
        if (error) throw error;
        setBoot(data as Bootstrap);
        const d = data as any;
        if (!d?.ok) setFase("indisponivel");
        else if (!d.disponivel) setFase("indisponivel");
        else setFase("identificacao");
      } catch {
        setBoot({ ok: false, error: "erro", mensagem: "Não foi possível validar este link." });
        setFase("indisponivel");
      }
    })();
  }, []);

  const disponivel = boot && (boot as any).ok && (boot as any).disponivel;
  const cfg: CamposIdent = disponivel ? (boot as any).campos_identificacao || {} : {};
  const questionario: Questionario | null = disponivel ? (boot as any).questionario : null;
  const empresa = boot ? (boot as any).empresa || null : null;

  const etapas = useMemo(() => questionario ? chunkPerguntas(questionario.perguntas) : [], [questionario]);

  function validarIdentificacao(): string | null {
    if (cfg.nome?.ativo && cfg.nome.obrigatorio && ident.nome.trim().length < 2) return "Informe seu nome.";
    if (cfg.funcao?.ativo && cfg.funcao.obrigatorio && ident.funcao.trim().length < 2) return "Informe sua função.";
    if (cfg.setor?.ativo && cfg.setor.obrigatorio && ident.setor.trim().length < 2) return "Informe seu setor.";
    if (cfg.unidade?.ativo && cfg.unidade.obrigatorio && ident.unidade.trim().length < 2) return "Informe sua unidade.";
    return null;
  }

  function iniciar() {
    const e = validarIdentificacao();
    if (e) { setErro(e); return; }
    setErro(null);
    setFase("intro");
  }

  function marcar(num: number, cod: string) {
    setRespostas((r) => ({ ...r, [num]: cod }));
    setErro(null);
  }

  function continuar() {
    if (!questionario) return;
    const [ini, fim] = etapas[etapaIdx];
    for (let n = ini; n <= fim; n++) {
      if (!respostas[n]) {
        setErro(`Responda a pergunta ${String(n).padStart(2, "0")} para continuar.`);
        setTimeout(() => primeiraPendenteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 20);
        return;
      }
    }
    if (etapaIdx < etapas.length - 1) { setEtapaIdx(etapaIdx + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else { setFase("review"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  async function enviar() {
    if (!questionario) return;
    setConfirmOpen(false);
    setFase("enviando");
    const respostasObj: Record<string, string> = {};
    for (const [k, v] of Object.entries(respostas)) respostasObj[k] = v;
    try {
      const { data, error } = await supabase.functions.invoke("psico-responder-publico", {
        body: {
          action: "submeter",
          token,
          identificacao: {
            nome: cfg.nome?.ativo ? ident.nome : "",
            funcao: cfg.funcao?.ativo ? ident.funcao : "",
            setor: cfg.setor?.ativo ? ident.setor : "",
            unidade: cfg.unidade?.ativo ? ident.unidade : "",
          },
          respostas: respostasObj,
        },
      });
      if (error) { setFase("review"); setErro("Não foi possível enviar. Tente novamente."); return; }
      const d = data as any;
      if (d?.status === "registrada") { setRespostas({}); setFase("sucesso"); }
      else if (d?.status === "ja_respondido") { setFase("ja_respondido"); }
      else { setFase("review"); setErro(d?.mensagem || "Não foi possível registrar sua resposta."); }
    } catch {
      setFase("review"); setErro("Falha de rede. Tente novamente.");
    }
  }

  return (
    <div className="min-h-dvh bg-background flex justify-center p-4 sm:p-6">
      <div className={`w-full ${fase === "form" || fase === "review" ? "max-w-2xl" : "max-w-lg"} space-y-4 text-center`}>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">HSE Consulting</div>
          {empresa && <div className="text-xs text-muted-foreground mt-1">Avaliação para: <strong>{empresa}</strong></div>}
        </div>

        {fase === "carregando" && <p className="text-sm text-muted-foreground py-8">Validando o link…</p>}

        {fase === "indisponivel" && (
          <div className="rounded-lg border p-6 bg-card space-y-2">
            <div className="text-destructive text-sm font-medium">Acesso indisponível</div>
            <p className="text-sm">{(boot as any)?.mensagem || "Link inválido ou expirado."}</p>
          </div>
        )}

        {fase === "identificacao" && questionario && (
          <div className="space-y-4 text-left">
            <h1 className="text-xl font-semibold text-center">{questionario.nome}</h1>
            <Card><CardContent className="py-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                As respostas são <strong>anônimas</strong>. Os dados abaixo são usados apenas para os
                recortes coletivos do relatório (por função, setor, unidade) e {boot && (boot as any).registrar_participacao ? "para controle de participação" : "não são vinculados às suas respostas"}.
              </p>
              {cfg.nome?.ativo && (
                <div>
                  <Label>Nome completo {cfg.nome.obrigatorio && <span className="text-destructive">*</span>}</Label>
                  <Input value={ident.nome} onChange={(e) => setIdent({ ...ident, nome: e.target.value })} maxLength={200} />
                </div>
              )}
              {cfg.funcao?.ativo && (
                <div>
                  <Label>Função / Cargo {cfg.funcao.obrigatorio && <span className="text-destructive">*</span>}</Label>
                  <Input value={ident.funcao} onChange={(e) => setIdent({ ...ident, funcao: e.target.value })} maxLength={150} />
                </div>
              )}
              {cfg.setor?.ativo && (
                <div>
                  <Label>Setor / Área {cfg.setor.obrigatorio && <span className="text-destructive">*</span>}</Label>
                  <Input value={ident.setor} onChange={(e) => setIdent({ ...ident, setor: e.target.value })} maxLength={150} />
                </div>
              )}
              {cfg.unidade?.ativo && (
                <div>
                  <Label>Unidade {cfg.unidade.obrigatorio && <span className="text-destructive">*</span>}</Label>
                  <Input value={ident.unidade} onChange={(e) => setIdent({ ...ident, unidade: e.target.value })} maxLength={150} />
                </div>
              )}
              {erro && <div className="text-sm text-destructive">{erro}</div>}
              <Button className="w-full" onClick={iniciar}>Continuar</Button>
            </CardContent></Card>
          </div>
        )}

        {fase === "intro" && questionario && (
          <div className="space-y-4 text-left">
            <h1 className="text-xl font-semibold text-center">{questionario.nome}</h1>
            {questionario.subtitulo && <p className="text-sm text-muted-foreground text-center">{questionario.subtitulo}</p>}
            {(questionario.texto_abertura || questionario.aviso_nao_avaliacao_psicologica || questionario.orientacao_periodo_referencia) && (
              <div className="text-sm space-y-3 bg-card border rounded p-4 whitespace-pre-line">
                {questionario.texto_abertura && <p>{questionario.texto_abertura}</p>}
                {questionario.aviso_nao_avaliacao_psicologica && <p>{questionario.aviso_nao_avaliacao_psicologica}</p>}
                {questionario.orientacao_periodo_referencia && <p>{questionario.orientacao_periodo_referencia}</p>}
              </div>
            )}
            <ul className="text-xs text-muted-foreground list-disc list-inside">
              <li>{questionario.quantidade_perguntas} perguntas — aproximadamente {questionario.tempo_estimado_minutos} minutos</li>
              <li>Todas as perguntas são obrigatórias</li>
              <li>Não há respostas certas ou erradas</li>
              <li>Após o envio não será possível alterar</li>
            </ul>
            <Button className="w-full" onClick={() => { setFase("form"); setEtapaIdx(0); }}>Iniciar questionário</Button>
          </div>
        )}

        {fase === "form" && questionario && (() => {
          const [ini, fim] = etapas[etapaIdx];
          const perguntas = questionario.perguntas.filter((p) => p.numero >= ini && p.numero <= fim);
          const primeiraPend = perguntas.find((p) => !respostas[p.numero])?.numero ?? null;
          const total = questionario.perguntas.length;
          const feitas = Object.keys(respostas).length;
          return (
            <div className="space-y-4 text-left">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{feitas} de {total} respondidas</span>
                  <span>Etapa {etapaIdx + 1}/{etapas.length}</span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((feitas / total) * 100)}%` }} />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Perguntas {ini}–{fim}</div>
              <div className="space-y-4">
                {perguntas.map((p) => {
                  const dest = primeiraPend === p.numero && !!erro;
                  return (
                    <div key={p.numero} ref={dest ? primeiraPendenteRef : undefined}>
                      <Card className={dest ? "border-destructive" : ""}>
                        <CardContent className="py-4 space-y-3">
                          <div>
                            <div className="text-xs text-muted-foreground font-mono">Pergunta {String(p.numero).padStart(2, "0")}</div>
                            <div className="text-sm font-medium mt-1">{p.texto}</div>
                            {p.exemplo && <div className="text-xs text-muted-foreground mt-1">{p.exemplo}</div>}
                          </div>
                          <RadioGroup value={respostas[p.numero] || ""} onValueChange={(v) => marcar(p.numero, v)} className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                            {questionario.opcoes.map((o) => (
                              <Label key={o.codigo} htmlFor={`p${p.numero}-${o.codigo}`}
                                className={`flex items-start gap-2 rounded border px-3 py-2 cursor-pointer text-sm ${respostas[p.numero] === o.codigo ? "border-primary bg-primary/5" : "border-input"}`}>
                                <RadioGroupItem value={o.codigo} id={`p${p.numero}-${o.codigo}`} className="shrink-0" />
                                <span className="leading-tight flex-1">{o.rotulo}</span>
                              </Label>
                            ))}
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
              {erro && <div role="alert" className="text-sm text-destructive">{erro}</div>}
              <div className="flex justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t">
                <Button variant="outline" onClick={() => { if (etapaIdx === 0) setFase("intro"); else { setEtapaIdx(etapaIdx - 1); setErro(null); } }}>Voltar</Button>
                <Button onClick={continuar}>{etapaIdx === etapas.length - 1 ? "Revisar respostas" : "Continuar"}</Button>
              </div>
            </div>
          );
        })()}

        {fase === "review" && questionario && (
          <div className="space-y-4 text-left">
            <h2 className="text-lg font-semibold">Revisão das respostas</h2>
            <p className="text-sm text-muted-foreground">Confira antes de enviar. Após o envio, não será possível alterar.</p>
            <div className="space-y-2">
              {etapas.map(([ini, fim], i) => (
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
              <Button variant="outline" onClick={() => { setFase("form"); setEtapaIdx(etapas.length - 1); }}>Voltar</Button>
              <Button onClick={() => setConfirmOpen(true)}>Enviar respostas</Button>
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar envio</DialogTitle>
                  <DialogDescription>
                    Suas respostas serão registradas de forma anônima e não poderão ser alteradas. A empresa recebe apenas resultados coletivos consolidados.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Voltar</Button>
                  <Button onClick={enviar}>Confirmar envio</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {fase === "enviando" && <p className="text-sm text-muted-foreground py-8">Enviando suas respostas…</p>}

        {fase === "sucesso" && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <h2 className="text-lg font-semibold">Participação registrada</h2>
            <p className="text-sm">Obrigado por participar. Suas respostas foram registradas de forma anônima.</p>
          </div>
        )}

        {fase === "ja_respondido" && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Participação já registrada</h2>
            <p className="text-sm">Já consta uma resposta com esse nome nesta avaliação.</p>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground pt-4 border-t">
          A HSE Consulting utiliza os dados apenas para gerar recortes coletivos (função, setor, unidade). Recortes com menos de 2 respostas são automaticamente suprimidos no relatório.
        </p>
      </div>
    </div>
  );
}