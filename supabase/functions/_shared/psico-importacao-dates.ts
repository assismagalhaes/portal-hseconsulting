function dataIsoValida(ano: number, mes: number, dia: number): string | null {
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (
    data.getUTCFullYear() !== ano
    || data.getUTCMonth() !== mes - 1
    || data.getUTCDate() !== dia
  ) return null

  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function normalizarData(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null

  // Google Forms pode exportar ano/mês/dia com barras, hífens e horário/sufixo de fuso.
  const anoPrimeiro = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?=$|[ T])/.exec(s)
  if (anoPrimeiro) {
    return dataIsoValida(Number(anoPrimeiro[1]), Number(anoPrimeiro[2]), Number(anoPrimeiro[3]))
  }

  // Exportações localizadas em pt-BR: dia/mês/ano ou dia-mês-ano.
  const diaPrimeiro = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?=$|[ T])/.exec(s)
  if (diaPrimeiro) {
    return dataIsoValida(Number(diaPrimeiro[3]), Number(diaPrimeiro[2]), Number(diaPrimeiro[1]))
  }

  return null
}
