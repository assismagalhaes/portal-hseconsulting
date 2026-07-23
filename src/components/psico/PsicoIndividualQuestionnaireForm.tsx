import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ShieldAlert } from "lucide-react";

type Opcao = { id: string; rotulo: string; valor: number | null };
type Pergunta = {
  id: string;
  numero: string | null;
  texto: string;
  tipo: string; // 'likert' | 'texto' | ...
  fator: string | null;
  obrigatoria: boolean;
  limite_texto: number;
  opcoes: Opcao[];
};

export type FormularioIndividual = {
  titulo: string;
  tempo_estimado_minutos: number;
  perguntas: Pergunta[];
};

type Fase = "intro" | "form" | "review" | "enviando" | "sucesso" | "ja_respondido" | "erro";

export default function PsicoIndividualQuestionnaireForm({
  formulario, sessao, tipo, empresa,
}: {
  formulario: FormularioIndividual;
  sessao: string;
  tipo: "empregado" | "empregador";
  empresa: string | null;
}) {
  const [fase, setFase] = useState<Fase>("intro");
  const [respostas, setRespostas] = useState<Record<string, string>>({}); // pergunta_id -> opcao_id
  const [livres, setLivres] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const primeiraPendenteRef = useRef<HTMLDivElement | null>(null);
  const sessaoRef = useRef(sessao);

  // Agrupar por fator para "progresso por fator"
  const fatores = useMemo(() => {
    const g = new Map<string, Pergunta[]>();
    for (const p of formulario.perguntas) {
      const k = p.fator || "GERAL";
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(p);
    }
    return Array.from(g.entries()).map(([codigo, perguntas]) => ({ codigo, perguntas }));
  }, [formulario.perguntas]);

  useEffect(() => {
    if (fase !== "form" && fase !== "review") return;
    if (Object.keys(respostas).length === 0 && Object.keys(livres).length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [fase, respostas, livres]);

  const isEscala = (t: string) => t === "escala" || t === "likert";
  const totalObrigLikert = formulario.perguntas.filter((p) => p.obrigatoria && isEscala(p.tipo)).length;
  const totalRespondidas = Object.keys(respostas).length;

  function marcar(pid: string, oid: string) {
    setRespostas((r) => ({ ...r, [pid]: oid }));
    setErro(null);
  }
  function escrever(pid: string, txt: string) {
    setLivres((l) => ({ ...l, [pid]: txt }));
  }

  function validarObrigatorias(): { ok: boolean; pid?: string } {
    for (const p of formulario.perguntas) {
      if (!p.obrigatoria) continue;
      if (isEscala(p.tipo) && !respostas[p.id]) return { ok: false, pid: p.id };
      if (!isEscala(p.tipo) && !(livres[p.id] || "").trim()) return { ok: false, pid: p.id };
    }
    return { ok: true };
  }

  function avancarParaRevisao() {
    const r = validarObrigatorias();
    if (!r.ok) {
      setErro("Responda todas as perguntas obrigatórias para continuar.");
      setTimeout(() => primeiraPendenteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 20);
      return;
    }
    setFase("review"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function enviar() {
    setConfirmOpen(false); setFase("enviando");
    const payloadRespostas = Object.entries(respostas).map(([pergunta_id, opcao_id]) => ({ pergunta_id, opcao_id }));
    const payloadLivres = Object.entries(livres)
      .filter(([, v]) => v && v.trim())
      .map(([pergunta_id, conteudo]) => ({ pergunta_id, conteudo }));
    try {
      const { data, error } = await supabase.functions.invoke("psico-individual-enviar-respostas", {
        body: { sessao: sessaoRef.current, respostas: payloadRespostas, livres: payloadLivres },
      });
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === "registrada") setFase("sucesso");
      else if (status === "ja_respondido") setFase("ja_respondido");
      else setFase("erro");
    } catch {
      setFase("erro");
    }
  }

  const titulo = formulario.titulo;

  if (fase === "intro") {
    return (
      <div className="min-h-dvh bg-background p-6 flex items-center justify-center">
        <Card className="max-w-2xl w-full">
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">HSE Consulting — Avaliação individual</div>
            <h1 className="text-2xl font-semibold">{titulo}</h1>
            {empresa && <div className="text-sm text-muted-foreground">Empresa: <strong>{empresa}</strong></div>}
            <p className="text-sm">
              Este formulário faz parte da <strong>Avaliação Assistida Individual — Microempresa</strong>.
              Tempo estimado de preenchimento: aproximadamente <strong>{formulario.tempo_estimado_minutos} minutos</strong>.
            </p>
            <div className="rounded-md border p-4 bg-muted/40 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium"><ShieldAlert className="w-4 h-4" /> Privacidade e uso das respostas</div>
              <p>
                Por envolver apenas 1 empregado e 1 empregador, esta avaliação <strong>não é anônima</strong>.
                Suas respostas ficam armazenadas com identificação e são acessadas apenas pela equipe técnica interna e pelas rotinas do sistema.
              </p>
              <p>Não retornaremos suas respostas após o envio. Preencha com atenção.</p>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setFase("form")}>Começar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (fase === "sucesso") {
    return (
      <div className="min-h-dvh bg-background p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardContent className="p-6 space-y-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-semibold">Respostas enviadas com sucesso</h2>
            <p className="text-sm text-muted-foreground">Você já pode fechar esta janela. Obrigado pela colaboração.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (fase === "ja_respondido") {
    return (
      <div className="min-h-dvh bg-background p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardContent className="p-6 space-y-3 text-center">
            <h2 className="text-lg font-semibold">Este convite já foi utilizado</h2>
            <p className="text-sm text-muted-foreground">As respostas já foram registradas anteriormente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (fase === "erro") {
    return (
      <div className="min-h-dvh bg-background p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardContent className="p-6 space-y-3 text-center">
            <h2 className="text-lg font-semibold text-destructive">Não foi possível enviar</h2>
            <p className="text-sm text-muted-foreground">Tente novamente em instantes. Se o problema persistir, contate a HSE Consulting.</p>
            <Button variant="outline" onClick={() => setFase("review")}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // form + review
  return (
    <div className="min-h-dvh bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b pb-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">HSE Consulting</div>
          <h1 className="text-lg md:text-xl font-semibold">{titulo}</h1>
          <div className="text-xs text-muted-foreground">
            {totalRespondidas}/{totalObrigLikert} obrigatórias respondidas
          </div>
        </div>

        {erro && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3">
            {erro}
          </div>
        )}

        {fase === "form" && fatores.map((g) => (
          <Card key={g.codigo}>
            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Fator {g.codigo}</div>
              {g.perguntas.map((p) => {
                const pendente = erro && (
                  (isEscala(p.tipo) && p.obrigatoria && !respostas[p.id]) ||
                  (!isEscala(p.tipo) && p.obrigatoria && !(livres[p.id] || "").trim())
                );
                return (
                  <div key={p.id} ref={pendente ? primeiraPendenteRef : undefined} className={pendente ? "border-l-2 border-destructive pl-3" : ""}>
                    <div className="text-sm font-medium mb-2">
                      {p.numero ? `${p.numero}. ` : ""}{p.texto}
                      {p.obrigatoria && <span className="text-destructive ml-1">*</span>}
                    </div>
                    {isEscala(p.tipo) ? (
                      <RadioGroup
                        value={respostas[p.id] || ""}
                        onValueChange={(v) => marcar(p.id, v)}
                        className="grid gap-2"
                      >
                        {p.opcoes.map((o) => (
                          <div key={o.id} className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40">
                            <RadioGroupItem id={`${p.id}-${o.id}`} value={o.id} />
                            <Label htmlFor={`${p.id}-${o.id}`} className="text-sm cursor-pointer">{o.rotulo}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <div className="space-y-1">
                        <Textarea
                          maxLength={p.limite_texto || 500}
                          value={livres[p.id] || ""}
                          onChange={(e) => escrever(p.id, e.target.value)}
                          placeholder="Escreva sua resposta"
                          rows={3}
                        />
                        <div className="text-[11px] text-muted-foreground text-right">
                          {(livres[p.id] || "").length}/{p.limite_texto || 500}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {fase === "form" && (
          <div className="flex justify-end pt-2">
            <Button onClick={avancarParaRevisao}>Revisar e enviar</Button>
          </div>
        )}

        {fase === "review" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Revisar antes de enviar</h2>
              <p className="text-sm text-muted-foreground">
                Após confirmar, as respostas não poderão mais ser alteradas e não retornaremos os valores enviados.
              </p>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setFase("form")}>Voltar e ajustar</Button>
                <Button onClick={() => setConfirmOpen(true)}>Confirmar envio</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {fase === "enviando" && (
          <div className="text-sm text-muted-foreground">Enviando suas respostas…</div>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar envio</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja enviar as respostas? Esta ação é definitiva e o formulário não poderá ser respondido novamente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={enviar}>Confirmar e enviar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}