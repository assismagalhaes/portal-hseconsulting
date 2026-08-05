export type DelimitadorCsv = ',' | ';' | '\t'

export type ResultadoCsv = {
  rows: string[][]
  delimitador: DelimitadorCsv
  encapsulamento_recuperado: boolean
}

export function detectarDelimitador(text: string): DelimitadorCsv {
  const linha = text.split(/\r?\n/).find(l => l.trim().length > 0) || ''
  const virgulas = (linha.match(/,/g) || []).length
  const pontosVirgula = (linha.match(/;/g) || []).length
  const tabs = (linha.match(/\t/g) || []).length
  if (tabs > virgulas && tabs > pontosVirgula) return '\t'
  if (pontosVirgula > virgulas) return ';'
  return ','
}

export function parseCsv(text: string, delimitador?: string): string[][] {
  const sep = delimitador ?? detectarDelimitador(text)
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === sep) { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c !== '\r') field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  while (rows.length && rows[rows.length - 1].every(x => x.trim() === '')) rows.pop()
  return rows
}

// Recupera exportações em que cada linha CSV foi novamente serializada como
// uma única célula. Só aceita a recuperação se a tabela interna for retangular.
export function parseCsvComRecuperacao(text: string, delimitador?: string): ResultadoCsv {
  const delimitadorInicial = (delimitador as DelimitadorCsv | undefined) ?? detectarDelimitador(text)
  const rows = parseCsv(text, delimitadorInicial)
  if (!rows.length || !rows.every(row => row.length === 1)) {
    return { rows, delimitador: delimitadorInicial, encapsulamento_recuperado: false }
  }
  const conteudoInterno = rows.map(row => row[0]).join('\n')
  const delimitadorInterno = detectarDelimitador(conteudoInterno)
  const recuperadas = parseCsv(conteudoInterno, delimitadorInterno)
  const largura = recuperadas[0]?.length ?? 0
  const retangular = largura > 1 && recuperadas.every(row => row.length === largura)
  return retangular
    ? { rows: recuperadas, delimitador: delimitadorInterno, encapsulamento_recuperado: true }
    : { rows, delimitador: delimitadorInicial, encapsulamento_recuperado: false }
}
