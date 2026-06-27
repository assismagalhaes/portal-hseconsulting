export const brl = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pct = (n: number | null | undefined, digits = 1) =>
  `${(Number(n ?? 0) * 100).toFixed(digits)}%`;

export const num = (n: number | null | undefined, digits = 2) =>
  Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatCnpjCpf = (v: string) => {
  const d = (v || "").replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, e) =>
      [a, b, c].filter(Boolean).join(".") + (e ? "-" + e : ""));
  }
  return d.replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/, (_, a, b, c, d2, e) =>
    `${a}${b ? "." + b : ""}${c ? "." + c : ""}${d2 ? "/" + d2 : ""}${e ? "-" + e : ""}`);
};

export const proposalStatusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  negociacao: "Em negociação",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

export const execStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};