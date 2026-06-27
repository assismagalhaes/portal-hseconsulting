import type { Json } from "@/integrations/supabase/types";

export const TIPOS_DOCUMENTO = [
  { value: "PGR", label: "PGR — Programa de Gerenciamento de Riscos" },
  { value: "PCMSO", label: "PCMSO — Programa de Controle Médico" },
  { value: "LTCAT", label: "LTCAT" },
  { value: "Laudo_Insalubridade", label: "Laudo de Insalubridade" },
  { value: "Laudo_Periculosidade", label: "Laudo de Periculosidade" },
  { value: "Avaliacao_Ergonomica", label: "Avaliação Ergonômica" },
  { value: "Avaliacao_Psicossocial", label: "Avaliação de Fatores Psicossociais" },
  { value: "Parecer_Tecnico", label: "Parecer Técnico" },
  { value: "Relatorio_Tecnico", label: "Relatório Técnico" },
  { value: "Relatorio_Visita", label: "Relatório de Visita" },
  { value: "Relatorio_Medicao", label: "Relatório de Medição" },
  { value: "Certificado_Treinamento", label: "Certificado de Treinamento" },
  { value: "Lista_Presenca", label: "Lista de Presença" },
  { value: "OS_SST", label: "Ordem de Serviço de SST" },
  { value: "PPP", label: "PPP" },
  { value: "Outros", label: "Outros" },
] as const;

export type DocumentoTipo = (typeof TIPOS_DOCUMENTO)[number]["value"];

export const tipoLabel = (t: string | null | undefined) =>
  TIPOS_DOCUMENTO.find((x) => x.value === t)?.label ?? t ?? "—";

export const STATUS_DOCUMENTO = [
  { value: "rascunho", label: "Rascunho", color: "bg-muted text-muted-foreground" },
  { value: "em_elaboracao", label: "Em elaboração", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { value: "em_revisao", label: "Em revisão", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "aguardando_cliente", label: "Aguardando cliente", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "aguardando_assinatura", label: "Aguardando assinatura", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { value: "aprovado", label: "Aprovado", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "emitido", label: "Emitido", color: "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300" },
  { value: "entregue", label: "Entregue", color: "bg-green-600/20 text-green-700 dark:text-green-300" },
  { value: "revisado", label: "Revisado", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { value: "cancelado", label: "Cancelado", color: "bg-destructive/15 text-destructive" },
  { value: "vencido", label: "Vencido", color: "bg-red-500/20 text-red-700 dark:text-red-300" },
] as const;

export type DocumentoStatus = (typeof STATUS_DOCUMENTO)[number]["value"];

export const statusLabel = (s: string | null | undefined) =>
  STATUS_DOCUMENTO.find((x) => x.value === s)?.label ?? s ?? "—";

export const statusColor = (s: string | null | undefined) =>
  STATUS_DOCUMENTO.find((x) => x.value === s)?.color ?? "bg-muted text-muted-foreground";

/** Próximo status do fluxo de aprovação. */
export function proximoStatus(s: DocumentoStatus | string): DocumentoStatus | null {
  const fluxo: DocumentoStatus[] = [
    "rascunho", "em_elaboracao", "em_revisao", "aprovado", "emitido", "entregue",
  ];
  const i = fluxo.indexOf(s as DocumentoStatus);
  if (i < 0 || i >= fluxo.length - 1) return null;
  return fluxo[i + 1];
}

export function statusValidade(data_vencimento: string | null | undefined): {
  rotulo: string; cor: string; dias: number | null;
} {
  if (!data_vencimento) return { rotulo: "Sem validade", cor: "bg-muted text-muted-foreground", dias: null };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(data_vencimento + "T00:00:00");
  const dias = Math.round((venc.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { rotulo: `Vencido há ${Math.abs(dias)}d`, cor: "bg-red-500/20 text-red-700 dark:text-red-300", dias };
  if (dias <= 30) return { rotulo: `Vence em ${dias}d`, cor: "bg-amber-500/20 text-amber-700 dark:text-amber-300", dias };
  return { rotulo: `Vigente (${dias}d)`, cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dias };
}

/** Resolve {{chaves}} no texto a partir de um contexto de dados. */
export function resolverVariaveis(texto: string, ctx: Record<string, any>): string {
  if (!texto) return "";
  return texto.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => {
    const v = ctx[k];
    return v === undefined || v === null || v === "" ? `{{${k}}}` : String(v);
  });
}

/** Monta contexto de variáveis a partir das entidades vinculadas. */
export function montarContexto(args: {
  documento: any;
  cliente?: any;
  proposta?: any;
  execucao?: any;
  os?: any;
  profissional?: any;
}): Record<string, any> {
  const { documento, cliente, proposta, execucao, os, profissional } = args;
  return {
    razao_social: cliente?.razao_social,
    nome_fantasia: cliente?.nome_fantasia,
    cnpj: cliente?.cnpj,
    endereco: cliente?.endereco,
    cidade: cliente?.cidade,
    estado: cliente?.estado,
    quantidade_funcionarios: cliente?.quantidade_funcionarios,
    servico: execucao?.titulo,
    numero_proposta: proposta?.numero,
    numero_os: os?.numero,
    responsavel_tecnico: profissional?.nome,
    registro_profissional: profissional?.registro_profissional,
    cargo_responsavel: profissional?.cargo,
    numero_documento: documento?.numero,
    data_emissao: documento?.data_emissao,
    data_validade: documento?.data_vencimento,
  };
}

export type ConteudoDoc = { html: string } | Json;