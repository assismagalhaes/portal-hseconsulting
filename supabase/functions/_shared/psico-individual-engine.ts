// HSE-PSICO-IND-ENGINE-1.0
// Motor determinístico de conciliação individual (empregado × empregador).
// Puro TypeScript, sem IA, sem I/O, sem dependências externas.
// Determinismo: idem entradas → idem saída (mesmo hash).
//
// Convenções de dados:
// - Cada resposta estruturada carrega: fator (código), chave (pareamento),
//   valor (numérico 0..N) e significa_exposicao (booleano indicando se a
//   opção escolhida representa uma exposição/deficit de controle).
// - "chave" agrupa perguntas equivalentes entre empregado e empregador:
//     * frequencia_exposicao
//     * intensidade_exigencia
//     * controle_existente
//     * eficacia_controle
//     * outros — ignorados pelo motor de conciliação (usados só na fundamentação).
// - Texto livre NUNCA entra aqui.

export const ENGINE_VERSAO = "HSE-PSICO-IND-ENGINE-1.0";
export const REGRAS_VERSAO = "HSE-PSICO-IND-REGRAS-1.0";

export type EstadoAchado =
  | "controlado"
  | "atencao_preventiva"
  | "requer_intervencao"
  | "prioritario"
  | "divergente"
  | "evidencia_insuficiente"
  | "nao_aplicavel";

export type EstadoConvergencia =
  | "convergente"
  | "divergente"
  | "apenas_empregador"
  | "apenas_empregado"
  | "indeterminado";

export type NivelExposicao = "nenhuma" | "baixa" | "media" | "alta";
export type NivelControle = "inexistente" | "ineficaz" | "parcial" | "eficaz" | "desconhecido";

export interface RespostaEstruturada {
  pergunta_id: string;
  fator: string;
  chave: string | null;
  periodo?: string | null;
  valor: number | null;
  significa_exposicao: boolean | null;
}

export interface EntradaMotor {
  avaliacao_id: string;
  formulario_empregado: { id: string; instrumento_versao_id: string } | null;
  formulario_empregador: { id: string; instrumento_versao_id: string } | null;
  respostas_empregado: RespostaEstruturada[];
  respostas_empregador: RespostaEstruturada[];
}

export interface Achado {
  fator_codigo: string;
  perigo_codigo: string | null;
  descricao_organizacional: string | null;
  frequencia_exposicao: NivelExposicao | null;
  intensidade_exigencia: NivelExposicao | null;
  controle_existente: NivelControle | null;
  eficacia_controle: NivelControle | null;
  condicao_preliminar: EstadoAchado;
  nivel_evidencia: "alto" | "medio" | "baixo" | "insuficiente";
  estado_convergencia: EstadoConvergencia;
  fundamentacao_sanitizada: string;
  regra_codigo: string;
  regra_versao: string;
  estado_final: EstadoAchado;
  necessita_acao: boolean;
}

export interface SaidaMotor {
  engine_versao: string;
  regras_versao: string;
  resultado_hash: string;
  achados: Achado[];
  convergencias: string[]; // fatores
  divergencias: string[];  // fatores
  evidencia_insuficiente: string[]; // fatores
  bloqueado: boolean;
  motivo_bloqueio?: string;
}

// ---------- utilitários puros ----------

function classifExposicao(valor: number | null | undefined, significa: boolean | null | undefined): NivelExposicao {
  if (valor == null) return "nenhuma";
  // Escala Likert 1..5. Só conta como exposição se a opção marca significa_exposicao=true.
  if (significa !== true) return "nenhuma";
  if (valor >= 5) return "alta";
  if (valor >= 4) return "alta";
  if (valor >= 3) return "media";
  if (valor >= 2) return "baixa";
  return "nenhuma";
}

function nivelRank(n: NivelExposicao): number {
  return n === "alta" ? 3 : n === "media" ? 2 : n === "baixa" ? 1 : 0;
}

function classifControle(valor: number | null | undefined, significa: boolean | null | undefined): NivelControle {
  if (valor == null) return "desconhecido";
  // Aqui, significa_exposicao=true significa "há déficit de controle" (ex: "não existe").
  if (significa === true) {
    if (valor >= 4) return "inexistente";
    if (valor >= 3) return "ineficaz";
    return "parcial";
  }
  if (valor >= 4) return "eficaz";
  if (valor >= 3) return "parcial";
  return "ineficaz";
}

function maxExposicao(arr: RespostaEstruturada[]): NivelExposicao {
  let m: NivelExposicao = "nenhuma";
  for (const r of arr) {
    const n = classifExposicao(r.valor, r.significa_exposicao);
    if (nivelRank(n) > nivelRank(m)) m = n;
  }
  return m;
}

function agregaControle(arr: RespostaEstruturada[]): NivelControle {
  // Pior nível declarado prevalece (mais conservador).
  const rank: Record<NivelControle, number> = {
    inexistente: 4, ineficaz: 3, parcial: 2, eficaz: 1, desconhecido: 0,
  };
  let melhor: NivelControle = "desconhecido";
  let piorRank = -1;
  for (const r of arr) {
    const n = classifControle(r.valor, r.significa_exposicao);
    if (rank[n] > piorRank) { piorRank = rank[n]; melhor = n; }
  }
  return melhor;
}

function agrupaPorFator(respostas: RespostaEstruturada[]): Map<string, RespostaEstruturada[]> {
  const m = new Map<string, RespostaEstruturada[]>();
  for (const r of respostas) {
    if (!r.fator) continue;
    const arr = m.get(r.fator) ?? [];
    arr.push(r);
    m.set(r.fator, arr);
  }
  return m;
}

function filtraChave(arr: RespostaEstruturada[], chave: string): RespostaEstruturada[] {
  return arr.filter((r) => (r.chave || "").toLowerCase() === chave);
}

function canonSort<T extends { fator_codigo: string; regra_codigo: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    a.fator_codigo.localeCompare(b.fator_codigo) ||
    a.regra_codigo.localeCompare(b.regra_codigo),
  );
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- núcleo determinístico ----------

/**
 * Combina exposições declaradas pelas duas fontes SEM calcular média.
 * Regra: prevalece a maior exposição observada; se apenas o empregado relata,
 * o empregador não anula.
 */
function combinarExposicao(emp: NivelExposicao, rep: NivelExposicao): {
  nivel: NivelExposicao;
  convergencia: EstadoConvergencia;
  divergenciaForte: boolean;
} {
  if (emp === "nenhuma" && rep === "nenhuma") return { nivel: "nenhuma", convergencia: "convergente", divergenciaForte: false };
  if (emp !== "nenhuma" && rep === "nenhuma") return { nivel: emp, convergencia: "apenas_empregado", divergenciaForte: nivelRank(emp) >= 2 };
  if (emp === "nenhuma" && rep !== "nenhuma") return { nivel: rep, convergencia: "apenas_empregador", divergenciaForte: false };
  const dif = Math.abs(nivelRank(emp) - nivelRank(rep));
  const conv: EstadoConvergencia = dif === 0 ? "convergente" : "divergente";
  const nivel = nivelRank(emp) >= nivelRank(rep) ? emp : rep;
  return { nivel, convergencia: conv, divergenciaForte: dif >= 2 };
}

function decidirEstado(
  exposicao: NivelExposicao,
  controle: NivelControle,
  convergencia: EstadoConvergencia,
  divergenciaForte: boolean,
): { estado: EstadoAchado; regra: string; necessita_acao: boolean } {
  // R000: bloqueio superior — divergência forte
  if (divergenciaForte) return { estado: "divergente", regra: "R000-DIVERGENCIA-FORTE", necessita_acao: true };

  if (exposicao === "nenhuma") return { estado: "nao_aplicavel", regra: "R040-SEM-EXPOSICAO", necessita_acao: false };

  if (exposicao === "alta") {
    if (controle === "inexistente") return { estado: "prioritario", regra: "R010", necessita_acao: true };
    if (controle === "ineficaz" || controle === "desconhecido") return { estado: "requer_intervencao", regra: "R011", necessita_acao: true };
    if (controle === "parcial") return { estado: "requer_intervencao", regra: "R012", necessita_acao: true };
    return { estado: "atencao_preventiva", regra: "R013", necessita_acao: true };
  }
  if (exposicao === "media") {
    if (controle === "inexistente") return { estado: "requer_intervencao", regra: "R020", necessita_acao: true };
    if (controle === "ineficaz") return { estado: "atencao_preventiva", regra: "R021", necessita_acao: true };
    if (controle === "parcial") return { estado: "atencao_preventiva", regra: "R022", necessita_acao: true };
    if (controle === "desconhecido") return { estado: "atencao_preventiva", regra: "R023", necessita_acao: true };
    return { estado: "controlado", regra: "R024", necessita_acao: false };
  }
  // baixa
  if (controle === "inexistente") return { estado: "atencao_preventiva", regra: "R030", necessita_acao: true };
  return { estado: "controlado", regra: "R031", necessita_acao: false };
}

function nivelEvidencia(
  temEmpregado: boolean,
  temEmpregador: boolean,
  convergencia: EstadoConvergencia,
): "alto" | "medio" | "baixo" | "insuficiente" {
  if (!temEmpregado || !temEmpregador) return "insuficiente";
  if (convergencia === "convergente") return "alto";
  if (convergencia === "divergente") return "baixo";
  return "medio";
}

function fundamentacao(
  fator: string, exposicao: NivelExposicao, controle: NivelControle,
  convergencia: EstadoConvergencia, regra: string,
): string {
  const labelExp: Record<NivelExposicao, string> = {
    nenhuma: "sem exposição declarada", baixa: "exposição baixa",
    media: "exposição moderada", alta: "exposição alta",
  };
  const labelCtrl: Record<NivelControle, string> = {
    inexistente: "sem controles",
    ineficaz: "controles insuficientes",
    parcial: "controles parciais",
    eficaz: "controles adequados",
    desconhecido: "controles não informados",
  };
  const labelConv: Record<EstadoConvergencia, string> = {
    convergente: "concordância entre empregado e empregador",
    divergente: "divergência entre empregado e empregador",
    apenas_empregado: "relato exclusivo do empregado",
    apenas_empregador: "relato exclusivo do empregador",
    indeterminado: "evidência insuficiente",
  };
  return `Fator ${fator}: ${labelExp[exposicao]} com ${labelCtrl[controle]} (${labelConv[convergencia]}). Regra ${regra}.`;
}

// ---------- API pública do motor ----------

export async function processar(entrada: EntradaMotor): Promise<SaidaMotor> {
  const bloqueado =
    !entrada.formulario_empregado || !entrada.formulario_empregador;

  if (bloqueado) {
    // Sem um dos formulários: engine devolve saída consistente e vazia (nenhum achado gravável).
    const canon = JSON.stringify({ v: ENGINE_VERSAO, r: REGRAS_VERSAO, bloqueado: true });
    return {
      engine_versao: ENGINE_VERSAO,
      regras_versao: REGRAS_VERSAO,
      resultado_hash: await sha256Hex(canon),
      achados: [],
      convergencias: [],
      divergencias: [],
      evidencia_insuficiente: [],
      bloqueado: true,
      motivo_bloqueio: !entrada.formulario_empregado
        ? "formulario_empregado_ausente"
        : "formulario_empregador_ausente",
    };
  }

  const empPorFator = agrupaPorFator(entrada.respostas_empregado);
  const repPorFator = agrupaPorFator(entrada.respostas_empregador);
  const fatores = new Set<string>([...empPorFator.keys(), ...repPorFator.keys()]);

  const achados: Achado[] = [];
  const convergencias: string[] = [];
  const divergencias: string[] = [];
  const evInsuf: string[] = [];

  for (const fator of [...fatores].sort()) {
    const emp = empPorFator.get(fator) ?? [];
    const rep = repPorFator.get(fator) ?? [];

    const freqEmp = maxExposicao(filtraChave(emp, "frequencia_exposicao"));
    const intEmp = maxExposicao(filtraChave(emp, "intensidade_exigencia"));
    const freqRep = maxExposicao(filtraChave(rep, "frequencia_exposicao"));
    const intRep = maxExposicao(filtraChave(rep, "intensidade_exigencia"));

    // Exposição = combinação frequência + intensidade (maior dos dois).
    const expEmp = nivelRank(freqEmp) >= nivelRank(intEmp) ? freqEmp : intEmp;
    const expRep = nivelRank(freqRep) >= nivelRank(intRep) ? freqRep : intRep;

    const combi = combinarExposicao(expEmp, expRep);

    const ctrlRep = agregaControle(filtraChave(rep, "controle_existente"));
    const ctrlEmp = agregaControle(filtraChave(emp, "controle_existente"));
    // Se ambos declararem, prevalece o pior; se só um, usa o único.
    const controle = (function combinar() {
      const rank: Record<NivelControle, number> = {
        inexistente: 4, ineficaz: 3, parcial: 2, eficaz: 1, desconhecido: 0,
      };
      const a = rank[ctrlRep], b = rank[ctrlEmp];
      if (a === 0 && b === 0) return "desconhecido" as NivelControle;
      if (a === 0) return ctrlEmp;
      if (b === 0) return ctrlRep;
      return a >= b ? ctrlRep : ctrlEmp;
    })();

    const efic = agregaControle(filtraChave(rep, "eficacia_controle"));

    const decisao = decidirEstado(combi.nivel, controle, combi.convergencia, combi.divergenciaForte);
    const evid = nivelEvidencia(emp.length > 0, rep.length > 0, combi.convergencia);

    let estadoFinal: EstadoAchado = decisao.estado;
    let regra = decisao.regra;
    if (evid === "insuficiente") {
      estadoFinal = "evidencia_insuficiente";
      regra = "R100-EVIDENCIA-INSUFICIENTE";
    }

    const fund = fundamentacao(fator, combi.nivel, controle, combi.convergencia, regra);

    const achado: Achado = {
      fator_codigo: fator,
      perigo_codigo: null,
      descricao_organizacional: null,
      frequencia_exposicao: nivelRank(freqEmp) >= nivelRank(freqRep) ? freqEmp : freqRep,
      intensidade_exigencia: nivelRank(intEmp) >= nivelRank(intRep) ? intEmp : intRep,
      controle_existente: controle,
      eficacia_controle: efic,
      condicao_preliminar: decisao.estado,
      nivel_evidencia: evid,
      estado_convergencia: combi.convergencia,
      fundamentacao_sanitizada: fund,
      regra_codigo: regra,
      regra_versao: REGRAS_VERSAO,
      estado_final: estadoFinal,
      necessita_acao: decisao.necessita_acao && estadoFinal !== "evidencia_insuficiente" && estadoFinal !== "nao_aplicavel",
    };
    achados.push(achado);

    if (estadoFinal === "evidencia_insuficiente") evInsuf.push(fator);
    else if (estadoFinal === "divergente") divergencias.push(fator);
    else if (combi.convergencia === "convergente") convergencias.push(fator);
  }

  const canonico = JSON.stringify({
    v: ENGINE_VERSAO,
    r: REGRAS_VERSAO,
    achados: canonSort(achados).map((a) => ({
      f: a.fator_codigo,
      exp: a.frequencia_exposicao, int: a.intensidade_exigencia,
      ctrl: a.controle_existente, efi: a.eficacia_controle,
      cp: a.condicao_preliminar, ev: a.nivel_evidencia,
      cv: a.estado_convergencia, rg: a.regra_codigo,
      ef: a.estado_final, na: a.necessita_acao,
    })),
  });
  const hash = await sha256Hex(canonico);

  return {
    engine_versao: ENGINE_VERSAO,
    regras_versao: REGRAS_VERSAO,
    resultado_hash: hash,
    achados,
    convergencias,
    divergencias,
    evidencia_insuficiente: evInsuf,
    bloqueado: false,
  };
}

// ---------- suite mínima de auto-teste (executada apenas quando chamada) ----------
// Cobre: exposição × controle × eficácia × divergência + idempotência + ordem indiferente.
export async function runSelfTests(): Promise<{ ok: boolean; details: string[] }> {
  const details: string[] = [];
  const mk = (papel: "empregado" | "empregador"): EntradaMotor => ({
    avaliacao_id: "test",
    formulario_empregado: { id: "e", instrumento_versao_id: "ev" },
    formulario_empregador: { id: "r", instrumento_versao_id: "rv" },
    respostas_empregado: [],
    respostas_empregador: [],
  });

  const cenarios: Array<{ nome: string; exp: number; ctrl: number; ctrlSign: boolean; esperado: EstadoAchado }> = [
    { nome: "alta + sem controle", exp: 5, ctrl: 5, ctrlSign: true, esperado: "prioritario" },
    { nome: "alta + controle eficaz", exp: 5, ctrl: 5, ctrlSign: false, esperado: "atencao_preventiva" },
    { nome: "media + sem controle", exp: 3, ctrl: 5, ctrlSign: true, esperado: "requer_intervencao" },
    { nome: "baixa + controle eficaz", exp: 2, ctrl: 5, ctrlSign: false, esperado: "controlado" },
    { nome: "sem exposicao", exp: 1, ctrl: 5, ctrlSign: false, esperado: "nao_aplicavel" },
  ];

  for (const c of cenarios) {
    const entrada = mk("empregado");
    entrada.respostas_empregado = [
      { pergunta_id: "p1", fator: "F1", chave: "frequencia_exposicao", valor: c.exp, significa_exposicao: c.exp >= 2 },
    ];
    entrada.respostas_empregador = [
      { pergunta_id: "p2", fator: "F1", chave: "frequencia_exposicao", valor: c.exp, significa_exposicao: c.exp >= 2 },
      { pergunta_id: "p3", fator: "F1", chave: "controle_existente", valor: c.ctrl, significa_exposicao: c.ctrlSign },
    ];
    const out = await processar(entrada);
    const estado = out.achados[0]?.estado_final;
    if (estado !== c.esperado) {
      details.push(`falha "${c.nome}": esperado ${c.esperado}, obtido ${estado}`);
    }
  }

  // Idempotência
  const e1 = mk("empregado");
  e1.respostas_empregado = [{ pergunta_id: "p1", fator: "F1", chave: "frequencia_exposicao", valor: 4, significa_exposicao: true }];
  e1.respostas_empregador = [{ pergunta_id: "p2", fator: "F1", chave: "controle_existente", valor: 5, significa_exposicao: true }];
  const h1 = (await processar(e1)).resultado_hash;
  const h2 = (await processar(e1)).resultado_hash;
  if (h1 !== h2) details.push("falha idempotência: hashes distintos para mesma entrada");

  // Ordem indiferente
  const e2 = mk("empregado");
  e2.respostas_empregado = [...e1.respostas_empregado].reverse();
  e2.respostas_empregador = [...e1.respostas_empregador].reverse();
  const h3 = (await processar(e2)).resultado_hash;
  if (h3 !== h1) details.push("falha ordem-indiferente: hashes divergem ao trocar ordem");

  // Bloqueio quando falta formulário
  const e3 = mk("empregado");
  e3.formulario_empregador = null;
  const outB = await processar(e3);
  if (!outB.bloqueado) details.push("falha bloqueio: processou mesmo sem empregador");

  return { ok: details.length === 0, details };
}