// Rótulos humanos para códigos técnicos usados no módulo psicossocial.
// Sempre exibir estes rótulos no lugar dos códigos crus (carga_excessiva, jornada_pausas, ...).

export const FATOR_LABEL: Record<string, string> = {
  demandas: "Demandas",
  controle: "Controle sobre o trabalho",
  apoio_chefia: "Apoio da chefia",
  apoio_operacional: "Apoio operacional",
  relacionamentos: "Relacionamentos",
  papel: "Clareza de papel",
  mudancas: "Gestão de mudanças",
  F1: "Demandas e carga de trabalho (AQI 1.0)",
  F2: "Controle e autonomia (AQI 1.0)",
  F3: "Apoio e liderança (AQI 1.0)",
  F4: "Relacionamentos (AQI 1.0)",
  F5: "Reconhecimento e crescimento (AQI 1.0)",
  F6: "Justiça organizacional (AQI 1.0)",
  F7: "Trabalho e vida pessoal (AQI 1.0)",
  carga_excessiva: "Carga excessiva de trabalho",
  conflitos_hierarquicos: "Conflitos hierárquicos",
  conflitos_interpessoais: "Conflitos interpessoais",
  falta_autonomia: "Falta de autonomia",
  falta_clareza: "Falta de clareza de papéis",
  gestao_mudancas: "Ausência de gestão de mudanças",
  relacoes_interpessoais: "Qualidade das relações interpessoais",
};

export const GRUPO_TRANSVERSAL_LABEL: Record<string, string> = {
  diversidade_inclusao: "Diversidade e inclusão",
  feedback_reconhecimento: "Feedback e reconhecimento",
  comunicacao: "Comunicação",
  jornada_pausas: "Jornada e pausas",
  treinamento_capacitacao: "Treinamento e capacitação",
  gestao_mudancas: "Gestão de mudanças",
  lideranca: "Liderança",
  clareza_papeis: "Clareza de papéis",
  metas_carga: "Metas e carga",
  saude_mental_suporte: "Saúde mental e suporte",
  trabalho_colaborativo: "Trabalho colaborativo",
  conflitos_respeito: "Conflitos e respeito",
  participacao_autonomia: "Participação e autonomia",
  organizacao_trabalho: "Organização do trabalho",
};

export const NIVEL_MEDIDA_LABEL: Record<string, string> = {
  essencial: "Essencial",
  estruturante: "Estruturante",
  complementar: "Complementar",
  basica: "Básica",
  intermediaria: "Intermediária",
  avancada: "Avançada",
  transversal: "Transversal",
};

export const PRIORIDADE_LABEL: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  monitoramento: "Monitoramento",
};

function humanize(code: string): string {
  return code
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function fatorLabel(code?: string | null): string {
  if (!code) return "—";
  return FATOR_LABEL[code] ?? humanize(code);
}

export function grupoTransversalLabel(code?: string | null): string {
  if (!code) return "";
  return GRUPO_TRANSVERSAL_LABEL[code] ?? humanize(code);
}

export function nivelMedidaLabel(code?: string | null): string {
  if (!code) return "";
  return NIVEL_MEDIDA_LABEL[code] ?? humanize(code);
}

export function prioridadeLabel(code?: string | null): string {
  if (!code) return "";
  return PRIORIDADE_LABEL[code] ?? humanize(code);
}
