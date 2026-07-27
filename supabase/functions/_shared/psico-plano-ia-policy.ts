export type FatorPlanoIA = {
  codigo: string;
  tratamento: "acao_recomendada" | "monitoramento_preventivo" | "sem_acao_especifica";
};

export type MedidaPlanoIA = {
  id: string;
  fator_codigo: string;
  nivel: string;
  grupo_transversal?: string | null;
};

export type SelecaoPlanoIA = {
  medida_modelo_id: string;
  fatores_codes: string[];
  [key: string]: unknown;
};

export function normalizarSelecoesPlanoIA(
  selecoes: unknown[],
  fatores: FatorPlanoIA[],
  catalogo: MedidaPlanoIA[],
) {
  const fatorPorCodigo = new Map(fatores.map((fator) => [fator.codigo, fator]));
  const medidaPorId = new Map(catalogo.map((medida) => [medida.id, medida]));
  const monitoramentosUsados = new Set<string>();
  const medidasUsadas = new Set<string>();
  const aceitas: SelecaoPlanoIA[] = [];
  let descartadas = 0;

  for (const valor of selecoes) {
    if (!valor || typeof valor !== "object") {
      descartadas += 1;
      continue;
    }

    const selecao = valor as Record<string, unknown>;
    const medidaId = typeof selecao.medida_modelo_id === "string"
      ? selecao.medida_modelo_id
      : "";
    const medida = medidaPorId.get(medidaId);
    const codigosInformados = Array.isArray(selecao.fatores_codes)
      ? [...new Set(selecao.fatores_codes.filter((codigo): codigo is string => typeof codigo === "string"))]
      : [];

    if (!medida || medidasUsadas.has(medidaId)) {
      descartadas += 1;
      continue;
    }

    const codigosPermitidos = codigosInformados.filter((codigo) => {
      const fator = fatorPorCodigo.get(codigo);
      const medidaAplicavel = medida.fator_codigo === codigo || Boolean(medida.grupo_transversal);
      return fator && fator.tratamento !== "sem_acao_especifica" && medidaAplicavel;
    });
    const codigosAcao = codigosPermitidos.filter(
      (codigo) => fatorPorCodigo.get(codigo)?.tratamento === "acao_recomendada",
    );

    if (codigosAcao.length > 0) {
      aceitas.push({ ...selecao, medida_modelo_id: medidaId, fatores_codes: codigosPermitidos });
      medidasUsadas.add(medidaId);
      continue;
    }

    const codigosMonitoramento = codigosPermitidos.filter(
      (codigo) =>
        fatorPorCodigo.get(codigo)?.tratamento === "monitoramento_preventivo"
        && !monitoramentosUsados.has(codigo),
    );

    if (medida.nivel !== "essencial" || codigosMonitoramento.length === 0) {
      descartadas += 1;
      continue;
    }

    aceitas.push({
      ...selecao,
      medida_modelo_id: medidaId,
      fatores_codes: codigosMonitoramento,
      prioridade: "monitoramento",
    });
    medidasUsadas.add(medidaId);
    codigosMonitoramento.forEach((codigo) => monitoramentosUsados.add(codigo));
  }

  return { selecoes: aceitas, descartadas };
}
