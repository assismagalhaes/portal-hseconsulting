import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PsicoPublicQuestionnaireForm, { QuestionarioPublico } from "@/components/psico/PsicoPublicQuestionnaireForm";
import PsicoIndividualQuestionnaireForm, { FormularioIndividual } from "@/components/psico/PsicoIndividualQuestionnaireForm";

type Resultado = {
  valido: boolean;
  estado: string;
  titulo_avaliacao?: string;
  empresa?: string | null;
  mensagem?: string;
  sessao?: string;
  questionario?: QuestionarioPublico;
  modalidade?: string;
  tipo?: "empregado" | "empregador";
  formulario?: FormularioIndividual;
};

export default function PsicoConvitePublico() {
  const [res, setRes] = useState<Resultado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Questionário de Percepção Psicoorganizacional | HSE";
    const meta = document.querySelector('meta[name="referrer"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "referrer");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute("content", "no-referrer");

    const raw = window.location.hash || "";
    let token = "";
    const m = raw.match(/token=([^&]+)/);
    if (m) token = decodeURIComponent(m[1]);
    // limpa o hash da barra de endereço
    if (token) history.replaceState(null, "", window.location.pathname);

    (async () => {
      try {
        // Token v2 (individual) começa com "v2."; caso contrário, tenta v1 (coletivo).
        const isV2 = token.startsWith("v2.");
        const fn = isV2 ? "psico-individual-validar-convite" : "psico-validar-convite";
        const { data, error } = await supabase.functions.invoke(fn, { body: { token } });
        if (error) throw error;
        setRes(data as Resultado);
      } catch {
        setRes({ valido: false, estado: "invalido", mensagem: "Link inválido ou expirado." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Render individual form fullscreen
  if (!loading && res?.valido && res.estado === "disponivel" && res.modalidade === "individual" && res.sessao && res.formulario && res.tipo) {
    return (
      <PsicoIndividualQuestionnaireForm
        formulario={res.formulario}
        sessao={res.sessao}
        tipo={res.tipo}
        empresa={res.empresa || null}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">HSE Consulting</div>
          <h1 className="text-xl font-semibold mt-2">Questionário de Percepção Psicoorganizacional no Trabalho</h1>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Validando seu acesso…</p>
        ) : res?.valido && res.estado === "disponivel" && res.sessao && res.questionario ? null : res?.valido ? (
          <div className="space-y-4 rounded-lg border p-6 bg-card">
            <div className="text-emerald-600 text-sm font-medium">Seu acesso individual foi validado.</div>
            <p className="text-sm">{res.mensagem}</p>
            <p className="text-xs text-muted-foreground">
              Guarde este link e aguarde a orientação da HSE Consulting ou da empresa responsável.
            </p>
            {res.empresa && (
              <div className="text-xs text-muted-foreground">Avaliação para: <strong>{res.empresa}</strong></div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border p-6 bg-card space-y-2">
            <div className="text-destructive text-sm font-medium">Não foi possível validar seu acesso</div>
            <p className="text-sm">{res?.mensagem || "Link inválido."}</p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground pt-4 border-t">
          Sua identificação é usada apenas para controle de participação e permanece tecnicamente separada do conteúdo das respostas.
          A empresa recebe somente resultados coletivos consolidados.
        </p>
      </div>
      {!loading && res?.valido && res.estado === "disponivel" && res.sessao && res.questionario && (
        <div className="fixed inset-0 overflow-auto bg-background z-10">
          <PsicoPublicQuestionnaireForm questionario={res.questionario} sessao={res.sessao} empresa={res.empresa || null} />
        </div>
      )}
    </div>
  );
}