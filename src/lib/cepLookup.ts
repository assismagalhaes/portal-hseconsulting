import { smartTitleCase } from "@/lib/cnpjLookup";

/**
 * CEP Lookup — ViaCEP (https://viacep.com.br), fonte pública dos Correios.
 * Fallback: BrasilAPI (/api/cep/v2/{cep}).
 */

export type CepLookupData = {
  cep: string;              // formatado 00000-000
  logradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  fonte: string;
};

export type CepLookupResult =
  | { status: "sucesso"; data: CepLookupData }
  | { status: "invalido" | "nao_encontrado" | "api_indisponivel" | "erro"; message: string };

function onlyDigits(v: string): string {
  return (v || "").replace(/\D+/g, "");
}

export function formatCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

async function fetchViaCep(cep: string): Promise<CepLookupResult> {
  let resp: Response;
  try {
    resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  } catch {
    return { status: "api_indisponivel", message: "Não foi possível conectar ao ViaCEP." };
  }
  if (!resp.ok) return { status: "api_indisponivel", message: `Falha ViaCEP (HTTP ${resp.status}).` };
  const raw: any = await resp.json().catch(() => null);
  if (!raw) return { status: "erro", message: "Resposta inválida do ViaCEP." };
  if (raw.erro) return { status: "nao_encontrado", message: "CEP não encontrado na base pública." };
  return {
    status: "sucesso",
    data: {
      cep: formatCep(cep),
      logradouro: smartTitleCase(raw.logradouro || null),
      complemento: smartTitleCase(raw.complemento || null),
      bairro: smartTitleCase(raw.bairro || null),
      cidade: smartTitleCase(raw.localidade || null),
      uf: raw.uf || null,
      fonte: "viacep",
    },
  };
}

async function fetchBrasilApiCep(cep: string): Promise<CepLookupResult> {
  let resp: Response;
  try {
    resp = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  } catch {
    return { status: "api_indisponivel", message: "Não foi possível conectar à BrasilAPI." };
  }
  if (resp.status === 404) return { status: "nao_encontrado", message: "CEP não encontrado." };
  if (!resp.ok) return { status: "api_indisponivel", message: `Falha BrasilAPI (HTTP ${resp.status}).` };
  const raw: any = await resp.json().catch(() => null);
  if (!raw) return { status: "erro", message: "Resposta inválida da BrasilAPI." };
  return {
    status: "sucesso",
    data: {
      cep: formatCep(cep),
      logradouro: smartTitleCase(raw.street || null),
      complemento: null,
      bairro: smartTitleCase(raw.neighborhood || null),
      cidade: smartTitleCase(raw.city || null),
      uf: raw.state || null,
      fonte: "brasilapi",
    },
  };
}

export async function consultarCep(cep: string): Promise<CepLookupResult> {
  const clean = onlyDigits(cep);
  if (clean.length !== 8) return { status: "invalido", message: "CEP inválido. Informe 8 dígitos." };
  const first = await fetchViaCep(clean);
  if (first.status === "sucesso") return first;
  if (first.status === "nao_encontrado") return first;
  const fallback = await fetchBrasilApiCep(clean);
  return fallback.status === "sucesso" ? fallback : first;
}

/**
 * Aplica os dados do CEP no formulário. Só preenche campos vazios.
 * O logradouro vira `endereco` quando este está vazio.
 */
export function aplicarDadosCep<T extends Record<string, any>>(
  form: T,
  data: CepLookupData,
  opts: { overwriteFilled?: boolean } = {}
): T {
  const { overwriteFilled = false } = opts;
  const patch: Record<string, any> = {
    cep: data.cep,
    endereco: data.logradouro,
    bairro: data.bairro,
    cidade: data.cidade,
    uf: data.uf,
  };
  const out: any = { ...form };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") continue;
    const empty = out[k] == null || out[k] === "";
    if (empty || overwriteFilled) out[k] = v;
  }
  return out as T;
}