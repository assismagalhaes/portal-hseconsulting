import { ClassificacaoRisco, PrioridadeFator, EscopoTipo } from "@/lib/psicoResultados";

// Rótulos "humanos"
export const CLASSIF_LABEL: Record<ClassificacaoRisco, string> = {
  irrelevante: "Risco Irrelevante",
  baixo: "Risco Baixo",
  medio: "Risco Médio",
  alto: "Risco Alto",
  critico: "Risco Crítico",
};

export const CLASSIF_SHORT: Record<ClassificacaoRisco, string> = {
  irrelevante: "Irrelevante",
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

export const PRIO_LABEL: Record<PrioridadeFator, string> = {
  monitoramento: "Monitoramento",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIO_ORDER: Record<PrioridadeFator, number> = {
  critica: 1, alta: 2, media: 3, monitoramento: 4,
};

export const TIPO_ESCOPO_LABEL: Record<EscopoTipo, string> = {
  global: "Resultado geral",
  funcao: "Função",
  setor: "Setor",
  unidade: "Unidade",
};

// Paleta semântica (HSL, contrastando com a identidade HSE)
export const RISK_COLOR: Record<ClassificacaoRisco, string> = {
  irrelevante: "hsl(198 75% 45%)",  // ciano/azul
  baixo:       "hsl(150 55% 40%)",  // verde
  medio:       "hsl(42 95% 52%)",   // âmbar
  alto:        "hsl(20 88% 50%)",   // laranja forte
  critico:     "hsl(348 78% 36%)",  // bordô
};

// Classes tailwind para badges de classificação
export function classifBadgeClass(c: ClassificacaoRisco): string {
  switch (c) {
    case "critico":     return "bg-rose-800 text-white hover:bg-rose-800";
    case "alto":        return "bg-orange-600 text-white hover:bg-orange-600";
    case "medio":       return "bg-amber-400 text-black hover:bg-amber-400";
    case "baixo":       return "bg-emerald-700 text-white hover:bg-emerald-700";
    case "irrelevante": return "bg-sky-600 text-white hover:bg-sky-600";
  }
}

export function prioBadgeClass(p: PrioridadeFator): string {
  switch (p) {
    case "critica":       return "bg-rose-800 text-white hover:bg-rose-800";
    case "alta":          return "bg-orange-600 text-white hover:bg-orange-600";
    case "media":         return "bg-amber-400 text-black hover:bg-amber-400";
    case "monitoramento": return "bg-slate-500 text-white hover:bg-slate-500";
  }
}

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${fmt(n, digits)}%`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch { return "—"; }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

// Texto de aviso metodológico fixo
export const AVISO_METODOLOGICO =
  "Os percentuais apresentados representam respostas válidas relacionadas às perguntas dos fatores. Os resultados não correspondem à classificação individual dos trabalhadores.";
