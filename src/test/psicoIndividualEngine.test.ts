import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSAO,
  processar,
  type EntradaMotor,
} from "../../supabase/functions/_shared/psico-individual-engine";

function entrada(): EntradaMotor {
  return {
    avaliacao_id: "00000000-0000-0000-0000-000000000001",
    formulario_empregado: { id: "emp", instrumento_versao_id: "aqi-e-1" },
    formulario_empregador: { id: "rep", instrumento_versao_id: "aqi-r-1" },
    respostas_empregado: [{
      pergunta_id: "AQI-E-01",
      fator: "F1",
      chave: "PAR-F1-CARGA",
      valor: 5,
      significa_exposicao: true,
    }],
    respostas_empregador: [{
      pergunta_id: "AQI-R-01",
      fator: "F1",
      chave: "PAR-F1-CARGA",
      valor: 1,
      significa_exposicao: true,
    }],
  };
}

describe("motor psicossocial individual", () => {
  it("processa as chaves PAR-* usadas pelo instrumento publicado", async () => {
    const resultado = await processar(entrada());
    expect(ENGINE_VERSAO).toContain("2.0");
    expect(resultado.bloqueado).toBe(false);
    expect(resultado.achados).toHaveLength(1);
    expect(resultado.achados[0]).toMatchObject({
      fator_codigo: "F1",
      frequencia_exposicao: "alta",
      necessita_acao: true,
    });
    expect(resultado.achados[0].estado_final).not.toBe("nao_aplicavel");
    expect(resultado.achados[0].perigo_codigo).toBeTruthy();
    expect(resultado.achados[0].descricao_organizacional).toBeTruthy();
  });

  it("gera um achado por perigo pareado, sem consolidar por média do fator", async () => {
    const dados = entrada();
    dados.respostas_empregado.push({
      pergunta_id: "AQI-E-02",
      fator: "F1",
      chave: "PAR-F1-RITMO",
      valor: 1,
      significa_exposicao: false,
    });
    dados.respostas_empregador.push({
      pergunta_id: "AQI-R-02",
      fator: "F1",
      chave: "PAR-F1-RITMO",
      valor: 5,
      significa_exposicao: false,
    });
    const resultado = await processar(dados);
    expect(resultado.achados).toHaveLength(2);
    expect(resultado.achados.map((a) => a.perigo_codigo).sort()).toEqual([
      "PAR-F1-CARGA",
      "PAR-F1-RITMO",
    ]);
  });

  it("é determinístico para a mesma entrada", async () => {
    const a = await processar(entrada());
    const b = await processar(entrada());
    expect(a.resultado_hash).toBe(b.resultado_hash);
  });

  it("bloqueia quando falta uma das duas fontes", async () => {
    const incompleta = entrada();
    incompleta.formulario_empregador = null;
    expect((await processar(incompleta)).bloqueado).toBe(true);
  });
});
