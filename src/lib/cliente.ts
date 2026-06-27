import { supabase } from "@/integrations/supabase/client";

export const CLIENTE_PERFIL_LABEL: Record<string, string> = {
  admin_cliente: "Administrador do Cliente",
  gestor_sst: "Gestor SST",
  rh: "RH",
  financeiro: "Financeiro",
  visualizador: "Visualizador",
  responsavel_pendencias: "Responsável por Pendências",
};

export const CLIENTE_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  convite_pendente: "Convite pendente",
  bloqueado: "Bloqueado",
};

export const PROPOSTA_STATUS_CLIENTE: Record<string, string> = {
  enviada: "Disponível",
  negociacao: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
  cancelada: "Cancelada",
};

export function validadeDocumento(dataVenc?: string | null): { cor: string; label: string; emoji: string } {
  if (!dataVenc) return { cor: "muted", label: "Sem validade", emoji: "⚪" };
  const hoje = new Date();
  const v = new Date(dataVenc);
  const dias = Math.floor((v.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { cor: "destructive", label: "Vencido", emoji: "🔴" };
  if (dias <= 30) return { cor: "warning", label: `Vence em ${dias}d`, emoji: "🟡" };
  return { cor: "success", label: "Vigente", emoji: "🟢" };
}

export async function registrarLogCliente(acao: string, detalhe?: string) {
  try { await supabase.rpc("cliente_log", { _acao: acao, _detalhe: detalhe ?? "" }); } catch {}
}