export type SinteseEsclarecimento = {
  resultado: "convergente" | "parcial" | "divergente";
  criterios_convergentes: number;
  criterios_avaliados: number;
  convergencia_frequencia: boolean;
  convergencia_controle: boolean;
  convergencia_aplicacao: boolean;
  exemplos_fornecidos: number;
  evidencias_fornecidas: number;
  fundamentacao: string;
};

export type Esclarecimento = {
  id: string;
  achado_id: string;
  fator_codigo: string;
  perigo_codigo: string | null;
  status: "aguardando_respostas" | "parcial" | "concluido" | "revogado";
  empregado_status: string;
  empregador_status: string;
  expira_em: string;
  sintese_sanitizada: SinteseEsclarecimento | null;
  solicitado_em: string;
  concluido_em: string | null;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function gerarTokenEsclarecimento() {
  return `esc.${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

export async function hashTokenEsclarecimento(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function linkEsclarecimento(token: string) {
  return `${window.location.origin}/avaliacao/psicossocial#token=${encodeURIComponent(token)}`;
}
