type FunctionErrorPayload = {
  error?: string;
  detail?: string;
  motivo?: string;
  status?: string;
};

const MENSAGENS: Record<string, string> = {
  unauthorized: "Sua sessão expirou. Entre novamente para processar a conciliação.",
  forbidden: "Seu usuário não tem permissão para processar esta avaliação.",
  autorizacao_interna_falhou: "Não foi possível validar sua permissão. Tente novamente.",
  avaliacao_nao_encontrada: "A avaliação não foi encontrada.",
  modalidade_invalida: "Esta avaliação não utiliza a modalidade individual de microempresa.",
  ler_entradas_falhou: "Não foi possível carregar os formulários respondidos.",
  persistencia_falhou: "A conciliação foi calculada, mas não pôde ser salva.",
};

async function lerPayload(error: unknown, data?: unknown): Promise<FunctionErrorPayload | null> {
  if (data && typeof data === "object") return data as FunctionErrorPayload;

  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return null;

  try {
    return await context.clone().json() as FunctionErrorPayload;
  } catch {
    return null;
  }
}

export async function mensagemErroConciliacao(error: unknown, data?: unknown): Promise<string> {
  const payload = await lerPayload(error, data);
  const codigo = payload?.error;

  if (codigo && MENSAGENS[codigo]) return MENSAGENS[codigo];
  if (payload?.status === "bloqueado" || codigo === "bloqueado") {
    return "Os formulários do empregado e do empregador precisam estar concluídos.";
  }

  return "Não foi possível processar a conciliação. Tente novamente.";
}
