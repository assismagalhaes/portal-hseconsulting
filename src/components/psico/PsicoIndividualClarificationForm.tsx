import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { fatorLabel } from "@/lib/psicoLabels";
import { condicaoLabel } from "@/lib/psicoIndividualCondicoes";

type Pergunta = {
  id: string;
  tipo: "opcao" | "texto";
  obrigatoria: boolean;
  texto: string;
  limite?: number;
  opcoes?: [string, string][];
};

export type FormularioEsclarecimento = { titulo: string; perguntas: Pergunta[] };
export type ContextoEsclarecimento = {
  fator_codigo: string;
  perigo_codigo: string | null;
  descricao: string | null;
};

export default function PsicoIndividualClarificationForm({
  formulario, contexto, sessao,
}: {
  formulario: FormularioEsclarecimento;
  contexto: ContextoEsclarecimento;
  sessao: string;
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const obrigatoriasOk = useMemo(
    () => formulario.perguntas.filter((p) => p.obrigatoria).every((p) => !!respostas[p.id]?.trim()),
    [formulario.perguntas, respostas],
  );

  async function enviar() {
    if (!obrigatoriasOk) return setErro("Responda as três perguntas obrigatórias.");
    setEnviando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("psico-individual-esclarecimento-enviar", {
        body: { sessao, respostas },
      });
      const status = (data as { status?: string } | null)?.status;
      if (error || !status || !["registrada", "ja_respondido"].includes(status)) throw error || new Error("falha");
      setConcluido(true);
    } catch {
      setErro("Não foi possível enviar. Verifique o link ou tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
            <h1 className="text-xl font-semibold">Esclarecimento enviado</h1>
            <p className="text-sm text-muted-foreground">A equipe técnica receberá somente uma síntese organizacional. Você já pode fechar esta janela.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">HSE Consulting · esclarecimento complementar</div>
            <h1 className="text-xl font-semibold">{condicaoLabel(contexto.perigo_codigo)}</h1>
            <p className="text-sm text-muted-foreground">{fatorLabel(contexto.fator_codigo)}</p>
            {contexto.descricao && <p className="rounded-md bg-muted p-3 text-sm">{contexto.descricao}</p>}
            <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Responda apenas sobre a organização do trabalho. Não informe nomes, condições de saúde ou outros dados pessoais.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-6">
            {formulario.perguntas.map((pergunta) => (
              <div key={pergunta.id} className="space-y-2">
                <Label className="text-sm font-medium">
                  {pergunta.texto}{pergunta.obrigatoria && <span className="text-destructive"> *</span>}
                </Label>
                {pergunta.tipo === "opcao" ? (
                  <RadioGroup
                    value={respostas[pergunta.id] || ""}
                    onValueChange={(value) => setRespostas((atual) => ({ ...atual, [pergunta.id]: value }))}
                    className="grid gap-2"
                  >
                    {(pergunta.opcoes || []).map(([value, label]) => (
                      <div key={value} className="flex items-center gap-2 rounded-md border p-3">
                        <RadioGroupItem id={`${pergunta.id}-${value}`} value={value} />
                        <Label htmlFor={`${pergunta.id}-${value}`} className="cursor-pointer font-normal">{label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea
                    value={respostas[pergunta.id] || ""}
                    maxLength={pergunta.limite || 1000}
                    rows={3}
                    placeholder="Não inclua nomes nem dados pessoais."
                    onChange={(event) => setRespostas((atual) => ({ ...atual, [pergunta.id]: event.target.value }))}
                  />
                )}
              </div>
            ))}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <div className="flex justify-end">
              <Button onClick={enviar} disabled={enviando || !obrigatoriasOk}>
                {enviando ? "Enviando…" : "Enviar esclarecimento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
