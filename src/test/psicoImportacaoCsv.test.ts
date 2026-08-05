import { describe, expect, it } from 'vitest'
import { parseCsvComRecuperacao } from '../../supabase/functions/_shared/psico-importacao-csv'

describe('CSV da importação psicossocial', () => {
  it('mantém CSV normal sem recuperação', () => {
    const result = parseCsvComRecuperacao('Data,01. Pergunta?,02. Pergunta?\n2026-07-16,Sempre,Nunca')
    expect(result.encapsulamento_recuperado).toBe(false)
    expect(result.rows).toEqual([
      ['Data', '01. Pergunta?', '02. Pergunta?'],
      ['2026-07-16', 'Sempre', 'Nunca'],
    ])
  })

  it('recupera linhas encapsuladas em uma única coluna', () => {
    const wrapped = [
      '"Carimbo de data/hora,""Nome completo"",""01. Pergunta?"",""02. Pergunta?"""',
      '"2026/07/16 10:28,""Pessoa"",""Sempre"",""As vezes"""',
    ].join('\n')
    const result = parseCsvComRecuperacao(wrapped)
    expect(result.encapsulamento_recuperado).toBe(true)
    expect(result.rows).toEqual([
      ['Carimbo de data/hora', 'Nome completo', '01. Pergunta?', '02. Pergunta?'],
      ['2026/07/16 10:28', 'Pessoa', 'Sempre', 'As vezes'],
    ])
  })

  it('não força recuperação quando a tabela interna é irregular', () => {
    const result = parseCsvComRecuperacao('"a,b"\n"c,d,e"')
    expect(result.encapsulamento_recuperado).toBe(false)
    expect(result.rows).toEqual([['a,b'], ['c,d,e']])
  })
})
