const PREFIXOS_ERRO_PLANO = [
  "ITENS_SEM_RESPONSAVEL:",
  "ITENS_SEM_PRAZO:",
  "ITENS_SEM_EVIDENCIA:",
];

export function isErroBloqueantePlano(codigo: string) {
  return codigo === "FATOR_SIGNIFICATIVO_SEM_ACAO"
    || codigo === "PLANO_SEM_ACOES"
    || PREFIXOS_ERRO_PLANO.some((prefixo) => codigo.startsWith(prefixo));
}

export function separarErrosPorEtapa(erros: string[]) {
  return {
    plano: erros.filter(isErroBloqueantePlano),
    revisao: erros.filter((codigo) => !isErroBloqueantePlano(codigo)),
  };
}
