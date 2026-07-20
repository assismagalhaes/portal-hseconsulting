// Gera os 18 cenários editoriais obrigatórios sem consultar banco ou dados reais.
// @deno-types="npm:@types/react@18.3.3"
import React from "npm:react@18.3.1";
import { renderToBuffer } from "npm:@react-pdf/renderer@3.4.5";
import { PsychosocialReportDocument } from "../supabase/functions/psico-gerar-relatorio/report-document.tsx";
import { HSE_LOGO_GREEN_DATA_URL } from "../supabase/functions/psico-gerar-relatorio/brand-assets.ts";

const factorSpecs = [
  ["carga_excessiva", "Carga excessiva de trabalho"],
  ["falta_autonomia", "Falta de autonomia no trabalho"],
  ["conflitos_hierarquicos", "Conflitos hierárquicos"],
  ["relacoes_interpessoais", "Qualidade das relações interpessoais"],
  ["conflitos_interpessoais", "Conflitos interpessoais"],
  ["falta_clareza", "Falta de clareza nas expectativas e responsabilidades"],
  ["gestao_mudancas", "Gestão de mudanças"],
];

const questionTexts = [
  "O volume de trabalho permite realizar as atividades com qualidade?",
  "Os prazos são compatíveis com os recursos disponíveis?",
  "Há tempo suficiente para pausas e recuperação durante a jornada?",
  "As demandas urgentes são distribuídas de forma equilibrada?",
  "A equipe dispõe dos recursos necessários para cumprir suas tarefas?",
];

function factors(significantCount: number) {
  return factorSpecs.map(([code, name], index) => {
    const significant = index < significantCount;
    const priority = index === 0 && significant ? "critica" : index < 3 && significant ? "alta" : significant ? "media" : "monitoramento";
    const score = significant ? Math.max(1.82, 3.42 - index * 0.25) : 0.58 + index * 0.11;
    return {
      fator_codigo: code, fator_nome: name, ordem: index + 1, score_medio: score,
      classificacao: score >= 3.2 ? "critico" : score >= 2.4 ? "alto" : score >= 1.6 ? "medio" : score >= 0.8 ? "baixo" : "irrelevante",
      percentual_medio_alto_critico: significant ? 72 - index * 3 : 18 + index,
      percentual_alto_critico: significant ? 48 - index * 2 : 8,
      percentual_critico: significant ? 22 - index : 2,
      criterio_principal: significant, criterio_agravamento: index < Math.min(significantCount, 3),
      criterio_critico_automatico: index === 0 && significant, significativo: significant, prioridade: priority,
      observacao: significant ? `O conjunto de indicadores de ${String(name).toLowerCase()} atingiu critério de significância e requer confronto com a organização real do trabalho.` : `O fator não atingiu critério de significância no período analisado; recomenda-se manter acompanhamento preventivo.`,
    };
  });
}

function questions() {
  return factorSpecs.flatMap(([code, name], factorIndex) => questionTexts.map((text, questionIndex) => {
    const numero = factorIndex * 5 + questionIndex + 1;
    const base = Math.max(0.25, 3.6 - factorIndex * 0.38 - questionIndex * 0.12);
    return { numero, texto: text.replace("atividades", `atividades relacionadas a ${String(name).toLowerCase()}`), fator_codigo: code, fator_nome: name, score_medio: base, classificacao: base >= 3.2 ? "critico" : base >= 2.4 ? "alto" : base >= 1.6 ? "medio" : base >= 0.8 ? "baixo" : "irrelevante", percentual_desfavoravel: Math.max(8, 86 - factorIndex * 8 - questionIndex * 3), percentual_alto_critico: Math.max(4, 65 - factorIndex * 7 - questionIndex * 2), percentual_critico: Math.max(0, 34 - factorIndex * 5 - questionIndex * 2) };
  }));
}

function actions(count: number, manyExamples = false) {
  return Array.from({ length: count }, (_, index) => ({
    id: `action-${index + 1}`, titulo: ["Reorganizar prioridades e capacidade de trabalho", "Implantar rotina de alinhamento entre liderança e equipe", "Definir papéis, interfaces e critérios de decisão"][index % 3],
    objetivo: "Reduzir exposições organizacionais e ampliar a previsibilidade do trabalho sem transferir a responsabilidade de controle às pessoas.",
    acao: "Mapear demandas, capacidade, gargalos e decisões recorrentes; pactuar ajustes com as áreas responsáveis e comunicar as mudanças às equipes.",
    orientacoes_praticas: ["Realizar oficina curta com liderança e representantes das equipes.", "Registrar prioridades, responsáveis e critérios de escalonamento.", "Revisar o funcionamento após o primeiro ciclo de implantação."],
    exemplos_aplicacao: manyExamples ? ["Quadro semanal de capacidade e prioridades.", "Reunião quinzenal de análise de gargalos.", "Matriz simples de papéis e decisões.", "Canal formal para sinalização de sobrecarga.", "Registro de ajustes de prazo e recursos."] : ["Quadro semanal de capacidade e prioridades.", "Matriz simples de papéis e decisões."],
    nivel: index === 0 ? "organizacional prioritário" : "organizacional", prioridade: index === 0 ? "critica" : index < 4 ? "alta" : "media", prazo_dias: index === 0 ? 30 : index < 4 ? 60 : 90,
    responsavel: "Gestão da unidade e RH", evidencias: ["ata da oficina", "plano atualizado", "comunicação às equipes"], indicador_eficacia: "Percentual de medidas implantadas e evolução do fator na reavaliação.", abrangencia: "Unidade avaliada", fatores: [factorSpecs[index % 7][0]],
  }));
}

const baseOpinion = {
  sintese_resultados: "A avaliação consolidou 35 perguntas em sete fatores e identificou prioridades coletivas que devem orientar a tomada de decisão da organização.",
  interpretacao_integrada: "Os resultados indicam condições relacionadas à organização do trabalho que precisam ser confrontadas com a rotina, os recursos, a comunicação e as práticas de gestão da unidade.",
  prioridades_intervencao: "A prioridade inicial é atuar nos fatores significativos e nas perguntas com maior concentração nas faixas alta e crítica, respeitando a sequência definida no plano.",
  recomendacoes: "A empresa deve designar responsáveis, recursos e prazos, comunicar as medidas às equipes, verificar a implantação e integrar os registros à gestão de riscos ocupacionais.",
  limitacoes: "Os dados representam percepções coletivas no período avaliado, não constituem diagnóstico individual e devem ser complementados pela análise do trabalho real.",
  conclusao: "Recomenda-se executar o plano aprovado, acompanhar evidências e indicadores de eficácia e repetir a avaliação após período suficiente para observar mudanças.",
};

type Scenario = { name: string; significant: number; respondents?: number; origin?: string; actionCount?: number; manyExamples?: boolean; ai?: boolean; signature?: boolean; noRegistration?: boolean; longClient?: boolean; revision?: string };
const scenarios: Scenario[] = [
  { name: "01-sem-fator-significativo", significant: 0 }, { name: "02-um-fator-significativo", significant: 1 },
  { name: "03-cinco-fatores-significativos", significant: 5 }, { name: "04-sete-fatores-significativos", significant: 7 },
  { name: "05-duas-respostas", significant: 1, respondents: 2 }, { name: "06-nove-respostas", significant: 2, respondents: 9 },
  { name: "07-avaliacao-importada", significant: 2, origin: "importacao_bruta" }, { name: "08-avaliacao-nativa", significant: 2, origin: "portal" },
  { name: "09-plano-uma-acao", significant: 1, actionCount: 1 }, { name: "10-plano-doze-acoes", significant: 5, actionCount: 12 },
  { name: "11-acoes-muitos-exemplos", significant: 3, actionCount: 4, manyExamples: true }, { name: "12-parecer-manual", significant: 2 },
  { name: "13-parecer-ia-editado", significant: 2, ai: true }, { name: "14-assinatura-em-branco", significant: 2 },
  { name: "15-assinatura-png", significant: 2, signature: true }, { name: "16-responsavel-sem-registro", significant: 2, noRegistration: true },
  { name: "17-cliente-nome-longo", significant: 2, longClient: true }, { name: "18-relatorio-r01", significant: 2, revision: "R01" },
];

const output = Deno.args[0] || "output/pdf/v1.4.0";
await Deno.mkdir(output, { recursive: true });
for (const [index, scenario] of scenarios.entries()) {
  const fs = factors(scenario.significant);
  const snapshot = {
    modelo: { codigo: "HSE-PSICO-REL-1.0", versao: "1.4.0" },
    origem: { coleta: scenario.origin || "portal", importacao: scenario.origin === "importacao_bruta" ? { id: "qa-importacao" } : null },
    avaliacao: { codigo: scenario.origin === "importacao_bruta" ? "IMP-QA-0001" : "AFP-QA-0001", periodo: { inicio: "2026-07-01", fim: "2026-07-20" }, metodologia: { codigo: "HSE-PSICO-2.0", versao: "2.0", criterio_principal_percentual: 50, criterio_agravamento_percentual: 30, criterio_critico_percentual: 10 } },
    resultado: { total_participantes: scenario.respondents ?? 18, participantes_elegiveis: 20, percentual_participacao: 90, indice_geral_descritivo: 1.84, fatores_significativos: scenario.significant, prioridade_maxima: scenario.significant ? "critica" : "monitoramento", amostra_reduzida: (scenario.respondents ?? 18) < 5 },
    revisao: { aprovada_em: "2026-07-20T15:00:00Z", responsavel: { nome_responsavel: "Assis Magalhães", cargo: "Coordenador Técnico", registro_profissional: scenario.noRegistration ? null : "Registro profissional 0000", assinatura_modo: scenario.signature ? "imagem" : "em_branco" }, parecer_conclusivo: baseOpinion, parecer_origem: scenario.ai ? "editado_ia" : "manual", parecer_prompt_codigo: scenario.ai ? "HSE-PSICO-IA-PARECER-1.0" : null, limitacoes: baseOpinion.limitacoes },
    fatores: fs, perguntas: questions(), plano: { itens: actions(scenario.actionCount ?? Math.max(1, scenario.significant), scenario.manyExamples) },
  };
  const clientName = scenario.longClient ? "ORGANIZAÇÃO DE SERVIÇOS INTEGRADOS, DESENVOLVIMENTO HUMANO E SOLUÇÕES OPERACIONAIS DO NORDESTE LTDA" : "Empresa de Homologação HSE";
  const buffer = await renderToBuffer(<PsychosocialReportDocument snapshot={snapshot} codigoRafp={`RAFP-QA-${String(index + 1).padStart(4, "0")}`} codigoRev={scenario.revision || "R00"} codigoValidacao="QA-V1-4" cliente={{ nome: clientName, razao_social: clientName, cnpj_cpf: "12345678000190", endereco: "Avenida da Homologação", numero: "100", bairro: "Centro", cidade: "Fortaleza", uf: "CE", cep: "60000-000" }} empresa={{ telefone: "(85) 9.9142-6534", email: "contato@hseconsulting.com.br", site: "hseconsulting.com.br" }} dataEmissao="2026-07-20T16:00:00Z" assinaturaDataUrl={scenario.signature ? HSE_LOGO_GREEN_DATA_URL : undefined} />);
  await Deno.writeFile(`${output}/${scenario.name}.pdf`, new Uint8Array(buffer));
  console.log(`${scenario.name}.pdf`);
}
