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
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  const lower = new Set(["de", "da", "do", "das", "dos", "e"]);
  return s
    .split(/\s+/)
    .map((w, i) => (i > 0 && lower.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
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

  const logradouro = raw.logradouro || null;
  const numero = raw.numero ? String(raw.numero) : null;
  const complemento = raw.complemento || null;
  const endereco = [logradouro, numero, complemento].filter(Boolean).join(", ").trim() || null;

  const cnaesSec = Array.isArray(raw.cnaes_secundarios)
    ? raw.cnaes_secundarios
        .filter((x: any) => x?.codigo)
        .map((x: any) => ({ codigo: String(x.codigo), descricao: x.descricao || "" }))
    : [];

  const cnaePrincipal = raw.cnae_fiscal
    ? `${raw.cnae_fiscal} — ${raw.cnae_fiscal_descricao || ""}`.trim()
    : null;

  const data: CnpjLookupData = {
    cnpj: formatCnpj(c),
    razao_social: raw.razao_social || raw.nome_empresarial || "",
    nome_fantasia: raw.nome_fantasia || raw.fantasia || "",
    situacao_cadastral: raw.descricao_situacao_cadastral || raw.situacao || null,
    data_abertura: raw.data_inicio_atividade || raw.abertura || null,
    cnae_principal: cnaePrincipal,
    cnaes_secundarios: cnaesSec,
    natureza_juridica: raw.natureza_juridica || raw.codigo_natureza_juridica || null,
    porte: raw.porte || raw.descricao_porte || null,
    cep: raw.cep ? onlyDigits(raw.cep).replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
    endereco,
    logradouro,
    numero,
    complemento,
    bairro: raw.bairro || null,
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

  const result = await fetchBrasilApi(clean);

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
      fonte: "brasilapi",
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