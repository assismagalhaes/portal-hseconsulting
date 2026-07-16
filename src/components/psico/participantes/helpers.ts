import { ParticipanteRow } from "@/lib/psicoParticipantes";

export function uniqueVals(rows: ParticipanteRow[], key: "funcao" | "setor" | "unidade") {
  const s = new Set<string>();
  rows.forEach((r) => { if (r[key]) s.add(r[key] as string); });
  return Array.from(s).sort();
}

export function contarGrupos(rows: ParticipanteRow[], key: "funcao" | "setor" | "unidade") {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = r[key];
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return Array.from(m.entries()).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
}