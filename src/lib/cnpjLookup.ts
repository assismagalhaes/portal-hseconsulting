import { supabase } from "@/integrations/supabase/client";

/* ============================================================
 * CNPJ Lookup Service
 * Fonte primária: BrasilAPI (https://brasilapi.com.br/api/cnpj/v1/{cnpj})
 * Estrutura desacoplada para permitir trocar/encadear ReceitaWS, SERPRO etc.
 * ============================================================ */

export type CnpjLookupStatus =
  | "sucesso"
  | "nao_encontrado"
  | "invalido"
  | "api_indisponivel"
  | "erro";

export type CnpjLookupData = {
  cnpj: string;                       // formatado
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string | null;
  data_abertura: string | null;       // ISO yyyy-mm-dd
  cnae_principal: string | null;
  cnaes_secundarios: { codigo: string; descricao: string }[];
  natureza_juridica: string | null;
  porte: string | null;
  cep: string | null;
  endereco: string | null;            // logradouro + número + complemento
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  fonte: string;
};

export type CnpjLookupResult =
  | { status: "sucesso"; data: CnpjLookupData }
  | { status: Exclude<CnpjLookupStatus, "sucesso">; message: string };

/* ------------ helpers ------------ */
export function onlyDigits(v: string): string {
  return (v || "").replace(/\D+/g, "");
}

export function formatCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Normaliza cidade vinda em CAIXA ALTA / sem acento para Title Case ("Fortaleza"). */
export function normalizeCidade(v: string | null): string | null {
  if (!v) return v;
  return smartTitleCase(v);
}

/* ============================================================
 * Normalização tipográfica dos textos vindos da Receita
 * A base pública devolve tudo em CAIXA ALTA e sem acentos.
 * Aqui reconstruímos acentuação por dicionário + Title Case,
 * preservando siglas, tipos societários, UFs e numerais.
 * ============================================================ */
const LOWERCASE_WORDS = new Set([
  "de","da","do","das","dos","e","em","na","no","nas","nos",
  "para","por","com","a","o","as","os","à","às","ao","aos",
  "sob","sobre","entre","sem",
]);
const UPPERCASE_TOKENS = new Set([
  "LTDA","ME","EPP","EIRELI","SA","S/A","MEI","CIA","EPI","EPC",
  "CNPJ","CPF","CEP","UF","BR",
  "SP","RJ","MG","RS","PR","SC","BA","PE","CE","GO","DF","PA","AM","MT","MS",
  "ES","MA","PI","RN","PB","AL","SE","TO","AP","AC","RO","RR",
  "II","III","IV","VI","VII","VIII","IX","XI","XII","XIII","XIV","XV","XX",
]);
const ACCENT_DICT: Record<string,string> = {
  "comercio":"Comércio","comercial":"Comercial","servico":"Serviço","servicos":"Serviços",
  "industria":"Indústria","industrial":"Industrial","producao":"Produção",
  "construcao":"Construção","construcoes":"Construções","engenharia":"Engenharia",
  "administracao":"Administração","gestao":"Gestão","operacao":"Operação","operacoes":"Operações",
  "solucao":"Solução","solucoes":"Soluções","importacao":"Importação","exportacao":"Exportação",
  "distribuicao":"Distribuição","representacao":"Representação","representacoes":"Representações",
  "participacao":"Participação","participacoes":"Participações",
  "consultoria":"Consultoria","assessoria":"Assessoria","auditoria":"Auditoria",
  "tecnologia":"Tecnologia","tecnologias":"Tecnologias","informatica":"Informática",
  "logistica":"Logística","transportes":"Transportes","veiculos":"Veículos",
  "medico":"Médico","medica":"Médica","medicos":"Médicos","medicas":"Médicas",
  "juridico":"Jurídico","juridica":"Jurídica","publico":"Público","publica":"Pública",
  "publicos":"Públicos","publicas":"Públicas",
  "saude":"Saúde","seguranca":"Segurança","trabalho":"Trabalho","educacao":"Educação",
  "alimentacao":"Alimentação","conservacao":"Conservação","manutencao":"Manutenção",
  "instalacao":"Instalação","instalacoes":"Instalações","reparacao":"Reparação",
  "fabricacao":"Fabricação","confeccao":"Confecção","confeccoes":"Confecções",
  "associacao":"Associação","cooperativa":"Cooperativa","fundacao":"Fundação",
  "instituicao":"Instituição","organizacao":"Organização",
  "avenida":"Avenida","praca":"Praça","travessa":"Travessa","rodovia":"Rodovia",
  "estrada":"Estrada","alameda":"Alameda","quadra":"Quadra","conjunto":"Conjunto",
  "condominio":"Condomínio","edificio":"Edifício","residencial":"Residencial",
  "sao":"São","santo":"Santo","santa":"Santa","andre":"André","antonio":"Antônio",
  "americo":"Américo","cassio":"Cássio","cicero":"Cícero","eugenio":"Eugênio",
  "fabio":"Fábio","flavio":"Flávio","ines":"Inês","italo":"Ítalo",
  "julio":"Júlio","junior":"Júnior","mario":"Mário","otavio":"Otávio",
  "sergio":"Sérgio","vinicius":"Vinícius",
  "brasil":"Brasil","america":"América","goias":"Goiás","maranhao":"Maranhão",
  "amapa":"Amapá","ceara":"Ceará","piaui":"Piauí","parana":"Paraná","rondonia":"Rondônia",
  "belem":"Belém","vitoria":"Vitória","brasilia":"Brasília","goiania":"Goiânia",
  "florianopolis":"Florianópolis","maceio":"Maceió","cuiaba":"Cuiabá","teresina":"Teresina",
  "tecnico":"Técnico","tecnica":"Técnica","tecnicos":"Técnicos","tecnicas":"Técnicas",
  "atividades":"Atividades","especializados":"Especializados","especializado":"Especializado",
  "especializada":"Especializada","escritorio":"Escritório","gerencia":"Gerência",
  "diretoria":"Diretoria","unidade":"Unidade","matriz":"Matriz","filial":"Filial",
  "atacado":"Atacado","varejo":"Varejo","mercadorias":"Mercadorias",
  "maquinas":"Máquinas","equipamentos":"Equipamentos","materiais":"Materiais",
  "quimico":"Químico","quimica":"Química","quimicos":"Químicos","quimicas":"Químicas",
  "eletrico":"Elétrico","eletrica":"Elétrica","eletronicos":"Eletrônicos",
  "hidraulica":"Hidráulica","hidraulicos":"Hidráulicos","petroleo":"Petróleo",
  "energia":"Energia","combustivel":"Combustível","combustiveis":"Combustíveis",
  "familia":"Família","genero":"Gênero","numero":"Número",
  "geral":"Geral","gerais":"Gerais",
};

function titleCaseWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Title Case inteligente com reacentuação de termos usuais da Receita.
 * Preserva siglas, numerais romanos, dígitos, tipos societários e conectivos.
 * Se o texto já vier em mixed-case, respeita a formatação original.
 */
export function smartTitleCase(input: string | null | undefined): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const hasLower = /[a-zà-ÿ]/.test(raw);
  const hasUpper = /[A-ZÀ-Ÿ]/.test(raw);
  if (hasLower && hasUpper) return raw;
  const tokens = raw.split(/(\s+|[\/\-,])/);
  const out = tokens.map((tok, idx) => {
    if (!tok || /^\s+$/.test(tok) || /^[\/\-,]$/.test(tok)) return tok;
    const upper = tok.toUpperCase();
    const lower = tok.toLowerCase();
    if (UPPERCASE_TOKENS.has(upper)) return upper;
    if (/^\d+[ºª°]?$/.test(tok)) return tok;
    if (/^\d+[A-Za-z]{1,2}$/.test(tok)) return tok.toUpperCase();
    if (/^[A-Za-z]\.([A-Za-z]\.)+$/.test(tok)) return upper;
    if (LOWERCASE_WORDS.has(lower) && idx > 0) return lower;
    if (ACCENT_DICT[lower]) return ACCENT_DICT[lower];
    return titleCaseWord(tok);
  });
  return out.join("");
}

function fixCnae(v: string | null | undefined): string | null {
  if (!v) return v ?? null;
  const m = String(v).match(/^(\d[\d\/\.\-]*)\s*(?:[—\-–])\s*(.+)$/);
  if (m) return `${m[1]} — ${smartTitleCase(m[2]) || ""}`.trim();
  return smartTitleCase(v);
}

/** True quando a situação cadastral está ativa. */
export function isSituacaoAtiva(s: string | null | undefined): boolean {
  if (!s) return true; // sem info — não bloqueia
  return /ativa/i.test(String(s));
}

/** Valida CNPJ pelos dígitos verificadores. */
export function isValidCnpj(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const calc = (slice: string, weights: number[]) => {
    const sum = slice.split("").reduce((a, ch, i) => a + Number(ch) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(c.slice(0, 12), w1);
  const d2 = calc(c.slice(0, 12) + d1, w2);
  return d1 === Number(c[12]) && d2 === Number(c[13]);
}

/** Valida CPF pelos dígitos verificadores. */
export function isValidCpf(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const calc = (slice: string) => {
    const size = slice.length;
    const sum = slice.split("").reduce((a, ch, i) => a + Number(ch) * (size + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(c.slice(0, 9));
  const d2 = calc(c.slice(0, 9) + d1);
  return d1 === Number(c[9]) && d2 === Number(c[10]);
}

/**
 * Detecta CAEPF (Cadastro de Atividade Econômica de Pessoa Física).
 * Estrutura: 14 dígitos = CPF válido (11) + sufixo do estabelecimento (3).
 * Regra prática: se os 11 primeiros formam um CPF válido *e* o número não
 * passa na validação de CNPJ, tratamos como CAEPF.
 */
export function isCaepf(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14) return false;
  return isValidCpf(c.slice(0, 11)) && !isValidCnpj(c);
}

/** Formata um CAEPF no padrão 000.000.000/001-01 (mesma máscara do CNPJ). */
export function formatCaepf(value: string): string {
  return formatCnpj(value);
}

/* ------------ providers ------------ */
async function fetchBrasilApi(cnpj: string): Promise<CnpjLookupResult> {
  const c = onlyDigits(cnpj);
  let resp: Response;
  try {
    resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`, { method: "GET" });
  } catch {
    return { status: "api_indisponivel", message: "Não foi possível conectar à API pública de CNPJ." };
  }
  if (resp.status === 404) {
    return { status: "nao_encontrado", message: "CNPJ não encontrado na base pública." };
  }
  if (!resp.ok) {
    return { status: "api_indisponivel", message: `Falha na consulta (HTTP ${resp.status}).` };
  }
  const raw: any = await resp.json().catch(() => null);
  if (!raw) return { status: "erro", message: "Resposta inválida da API." };

  const logradouro = smartTitleCase(raw.logradouro || null);
  const numero = raw.numero ? String(raw.numero) : null;
  const complemento = smartTitleCase(raw.complemento || null);
  const endereco = [logradouro, numero, complemento].filter(Boolean).join(", ").trim() || null;

  const cnaesSec = Array.isArray(raw.cnaes_secundarios)
    ? raw.cnaes_secundarios
        .filter((x: any) => x?.codigo)
        .map((x: any) => ({ codigo: String(x.codigo), descricao: smartTitleCase(x.descricao || "") || "" }))
    : [];

  const cnaePrincipal = raw.cnae_fiscal
    ? `${raw.cnae_fiscal} — ${smartTitleCase(raw.cnae_fiscal_descricao || "") || ""}`.trim()
    : null;

  const data: CnpjLookupData = {
    cnpj: formatCnpj(c),
    razao_social: smartTitleCase(raw.razao_social || raw.nome_empresarial || "") || "",
    nome_fantasia: smartTitleCase(raw.nome_fantasia || raw.fantasia || "") || "",
    situacao_cadastral: smartTitleCase(raw.descricao_situacao_cadastral || raw.situacao || null),
    data_abertura: raw.data_inicio_atividade || raw.abertura || null,
    cnae_principal: cnaePrincipal,
    cnaes_secundarios: cnaesSec,
    natureza_juridica: smartTitleCase(raw.natureza_juridica || raw.codigo_natureza_juridica || null),
    porte: smartTitleCase(raw.porte || raw.descricao_porte || null),
    cep: raw.cep ? onlyDigits(raw.cep).replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
    endereco,
    logradouro,
    numero,
    complemento,
    bairro: smartTitleCase(raw.bairro || null),
    cidade: normalizeCidade(raw.municipio || raw.cidade || null),
    uf: raw.uf || null,
    email: raw.email || null,
    telefone: raw.ddd_telefone_1
      ? String(raw.ddd_telefone_1).replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")
      : (raw.telefone || null),
    fonte: "brasilapi",
  };
  return { status: "sucesso", data };
}

async function fetchPublicaCnpjWs(cnpj: string): Promise<CnpjLookupResult> {
  const c = onlyDigits(cnpj);
  let resp: Response;
  try {
    resp = await fetch(`https://publica.cnpj.ws/cnpj/${c}`, { method: "GET" });
  } catch {
    return { status: "api_indisponivel", message: "Não foi possível conectar à API pública (publica.cnpj.ws)." };
  }
  if (resp.status === 404) {
    return { status: "nao_encontrado", message: "CNPJ não encontrado na base pública." };
  }
  if (resp.status === 429) {
    return { status: "api_indisponivel", message: "Limite de consultas excedido na fonte secundária. Tente novamente em instantes." };
  }
  if (!resp.ok) {
    return { status: "api_indisponivel", message: `Falha na consulta secundária (HTTP ${resp.status}).` };
  }
  const raw: any = await resp.json().catch(() => null);
  if (!raw) return { status: "erro", message: "Resposta inválida da API secundária." };

  const est = raw.estabelecimento || {};
  const logradouro = smartTitleCase([est.tipo_logradouro, est.logradouro].filter(Boolean).join(" ").trim() || null);
  const numero = est.numero ? String(est.numero) : null;
  const complemento = smartTitleCase(est.complemento || null);
  const endereco = [logradouro, numero, complemento].filter(Boolean).join(", ").trim() || null;

  const ap = est.atividade_principal;
  const cnaePrincipal = ap?.subclasse
    ? `${String(ap.subclasse).replace(/\D/g, "")} — ${smartTitleCase(ap.descricao || "") || ""}`.trim()
    : smartTitleCase(ap?.descricao || null);

  const cnaesSec = Array.isArray(est.atividades_secundarias)
    ? est.atividades_secundarias
        .filter((x: any) => x?.subclasse || x?.descricao)
        .map((x: any) => ({
          codigo: String(x.subclasse || "").replace(/\D/g, ""),
          descricao: smartTitleCase(x.descricao || "") || "",
        }))
    : [];

  const telRaw = est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : null;
  const telefone = telRaw
    ? telRaw.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")
    : null;

  const data: CnpjLookupData = {
    cnpj: formatCnpj(c),
    razao_social: smartTitleCase(raw.razao_social || "") || "",
    nome_fantasia: smartTitleCase(est.nome_fantasia || "") || "",
    situacao_cadastral: smartTitleCase(est.situacao_cadastral || null),
    data_abertura: est.data_inicio_atividade || null,
    cnae_principal: cnaePrincipal,
    cnaes_secundarios: cnaesSec,
    natureza_juridica: smartTitleCase(raw.natureza_juridica?.descricao || null),
    porte: smartTitleCase(raw.porte?.descricao || null),
    cep: est.cep ? onlyDigits(est.cep).replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
    endereco,
    logradouro,
    numero,
    complemento,
    bairro: smartTitleCase(est.bairro || null),
    cidade: normalizeCidade(est.cidade?.nome || null),
    uf: est.estado?.sigla || null,
    email: est.email || null,
    telefone,
    fonte: "publica.cnpj.ws",
  };
  return { status: "sucesso", data };
}

/* ------------ public api ------------ */

/**
 * Consulta o CNPJ na fonte pública e grava log interno.
 * Lança nada — sempre retorna um resultado tipado.
 */
export async function consultarCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const clean = onlyDigits(cnpj);
  if (clean.length !== 14 || !isValidCnpj(clean)) {
    return { status: "invalido", message: "CNPJ inválido. Confira os 14 dígitos." };
  }

  let result = await fetchBrasilApi(clean);
  let fonteUsada = "brasilapi";

  // Fallback automático: se a BrasilAPI não tiver o CNPJ ou estiver indisponível,
  // tenta a fonte secundária (publica.cnpj.ws) antes de declarar não encontrado.
  if (result.status === "nao_encontrado" || result.status === "api_indisponivel" || result.status === "erro") {
    const fallback = await fetchPublicaCnpjWs(clean);
    if (fallback.status === "sucesso") {
      result = fallback;
      fonteUsada = "publica.cnpj.ws";
    } else if (result.status !== "nao_encontrado" && fallback.status === "nao_encontrado") {
      // BrasilAPI estava indisponível e o fallback confirmou que não existe → reportar não encontrado.
      result = fallback;
      fonteUsada = "publica.cnpj.ws";
    }
  }

  // log interno (best-effort, não interfere no fluxo)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // Payload sanitizado — apenas dados cadastrais da empresa.
    // Nunca persistimos sócios, representantes, e-mail/telefone pessoais ou
    // qualquer outro dado pessoal que a API porventura traga.
    const sanitizedPayload = result.status === "sucesso"
      ? {
          cnpj: result.data.cnpj,
          razao_social: result.data.razao_social,
          nome_fantasia: result.data.nome_fantasia,
          situacao_cadastral: result.data.situacao_cadastral,
          data_abertura: result.data.data_abertura,
          cnae_principal: result.data.cnae_principal,
          natureza_juridica: result.data.natureza_juridica,
          porte: result.data.porte,
          cidade: result.data.cidade,
          uf: result.data.uf,
        }
      : null;
    await supabase.from("cnpj_consultas_log").insert({
      cnpj: clean,
      fonte: fonteUsada,
      resultado: result.status,
      mensagem: result.status === "sucesso" ? null : result.message,
      user_id: user?.id ?? null,
      payload: sanitizedPayload as any,
    } as any);
  } catch { /* noop */ }

  return result;
}

/**
 * Verifica se já existe cliente cadastrado com o mesmo CNPJ.
 * Retorna o registro encontrado ou null.
 */
export async function buscarClienteExistentePorCnpj(cnpj: string): Promise<any | null> {
  const clean = onlyDigits(cnpj);
  if (!clean) return null;
  const formatted = formatCnpj(clean);
  const { data } = await supabase
    .from("clients")
    .select("*")
    .or(`cnpj_cpf.eq.${formatted},cnpj_cpf.eq.${clean}`)
    .maybeSingle();
  return data || null;
}

/**
 * Aplica os dados retornados num formulário de cliente, retornando um novo objeto.
 * - Sempre sobrescreve quando o campo do form está vazio.
 * - Quando `overwriteFilled` é true, sobrescreve mesmo campos preenchidos.
 * - Nunca toca em campos "não automáticos" (solicitante, cargo, qtd_funcionarios, observações comerciais).
 */
export function aplicarDadosCnpj<T extends Record<string, any>>(
  form: T,
  data: CnpjLookupData,
  opts: { overwriteFilled?: boolean } = {}
): T {
  const { overwriteFilled = false } = opts;
  const mapped: Record<string, any> = {
    cnpj_cpf: data.cnpj,
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia,
    situacao_cadastral: data.situacao_cadastral,
    data_abertura: data.data_abertura,
    cnae_principal: data.cnae_principal,
    cnaes_secundarios: data.cnaes_secundarios,
    natureza_juridica: data.natureza_juridica,
    porte: data.porte,
    cep: data.cep,
    endereco: data.endereco,
    numero: data.numero,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.cidade,
    uf: data.uf,
    email: data.email,
    telefone: data.telefone,
    ultima_consulta_cnpj: new Date().toISOString(),
    fonte_consulta_cnpj: data.fonte,
  };
  const out: any = { ...form };
  for (const [k, v] of Object.entries(mapped)) {
    if (v == null || v === "") continue;
    const currentEmpty = out[k] == null || out[k] === "" || (Array.isArray(out[k]) && out[k].length === 0);
    if (currentEmpty || overwriteFilled) out[k] = v;
  }
  return out as T;
}

/** Campos que serão tocados pela aplicação dos dados — útil pra detectar conflito. */
export const CNPJ_AUTOFILL_FIELDS = [
  "razao_social", "nome_fantasia", "cep", "endereco", "numero", "complemento",
  "bairro", "cidade", "uf", "email", "telefone",
] as const;

export function hasConflict(form: Record<string, any>, data: CnpjLookupData): boolean {
  for (const k of CNPJ_AUTOFILL_FIELDS) {
    const current = form?.[k];
    const incoming = (data as any)[k];
    if (current && incoming && String(current).trim() !== "" && String(current) !== String(incoming)) {
      return true;
    }
  }
  return false;
}