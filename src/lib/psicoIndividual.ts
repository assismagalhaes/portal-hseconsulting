// Feature flag e tipos base da modalidade "Avaliação Assistida Individual — Microempresa".
// PR1: apenas fundação. Nenhuma UI é exposta enquanto a flag estiver desativada.

export const PSICO_INDIVIDUAL_ENABLED: boolean =
  ((import.meta as any).env?.VITE_PSICO_INDIVIDUAL_ENABLED ?? "false")
    .toString()
    .toLowerCase() === "true";

export type PsicoModalidade = "coletiva_hse" | "individual_microempresa";

export const PSICO_MODALIDADE_LABEL: Record<PsicoModalidade, string> = {
  coletiva_hse: "Coletiva (metodologia HSE)",
  individual_microempresa: "Assistida individual — Microempresa",
};

export type PsicoIndividualPapel = "empregador" | "empregado";

export type PsicoIndividualEstadoConvergencia =
  | "convergente"
  | "divergente"
  | "apenas_empregador"
  | "apenas_empregado"
  | "indeterminado";
