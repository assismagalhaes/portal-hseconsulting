import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ParticipanteRow,
  isEmailValido,
  isFoneValido,
  mascararEmail,
  mascararTelefone,
  normEmail,
  normFone,
  normTexto,
} from "@/lib/psicoParticipantes";

const sb: any = supabase;

const HEADER_MAP: Record<string, string[]> = {
  nome: ["nome", "nome completo", "colaborador", "trabalhador", "funcionario", "funcionário"],
  email: ["email", "e-mail", "correio eletronico", "correio eletrônico"],
  telefone: ["telefone", "celular", "whatsapp", "contato"],
  funcao: ["funcao", "função", "cargo", "ocupacao", "ocupação"],
  setor: ["setor", "departamento", "area", "área"],
  unidade: ["unidade", "filial", "estabelecimento", "local"],
};

const EXEMPLO_EMAILS = new Set(["maria@empresa.com.br", "joao@empresa.com.br"]);

type Linha = {
  n: number;
  nome: string;
  email: string;
  telefone: string;
  funcao: string;
  setor: string;
  unidade: string;
  status: "valida" | "aviso" | "erro" | "duplicada";
  msgs: string[];
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  avaliacaoId: string;
  existentes: ParticipanteRow[];
  onDone: () => void;
}

export function PsicoImportWizard({ open, onOpenChange, avaliacaoId, existentes, onDone }: Props) {
  const [etapa, setEtapa] = useState(1);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEtapa(1); setArquivo(null); setLinhas([]); setImportando(false);
  }

  async function processarArquivo(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error("Arquivo acima do limite de 5MB.");
    const nome = file.name.toLowerCase();
    if (!nome.endsWith(".csv") && !nome.endsWith(".xlsx")) {
      return toast.error("Somente arquivos .csv ou .xlsx são aceitos.");
    }
    if (nome.endsWith(".xlsm") || nome.endsWith(".xls")) {
      return toast.error("Formato não suportado.");
    }
    setArquivo(file);
    let rawRows: any[][] = [];
    if (nome.endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse(text, { skipEmptyLines: true });
      rawRows = parsed.data as any[][];
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellFormula: false, cellHTML: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];
    }
    if (rawRows.length === 0) return toast.error("Arquivo vazio.");
    if (rawRows.length > 5001) return toast.error("Máximo de 5.000 linhas por importação.");

    // mapeia colunas
    const header = (rawRows[0] || []).map((h: any) => normTexto(String(h)) || "");
    const col: Record<string, number> = {};
    for (const [k, aliases] of Object.entries(HEADER_MAP)) {
      const idx = header.findIndex((h) => aliases.map((a) => normTexto(a)).includes(h));
      if (idx >= 0) col[k] = idx;
    }
    if (col.nome === undefined) return toast.error("Arquivo sem coluna de nome.");

    const emailsExist = new Set(existentes.filter((e) => e.ativo).map((e) => e.email_normalizado).filter(Boolean) as string[]);
    const fonesExist = new Set(existentes.filter((e) => e.ativo).map((e) => e.telefone_normalizado).filter(Boolean) as string[]);

    const seenEmails = new Set<string>();
    const seenFones = new Set<string>();
    const seenNomes = new Set<string>();

    const parsedLinhas: Linha[] = [];
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i] || [];
      const l: Linha = {
        n: i + 1,
        nome: String(row[col.nome] ?? "").trim(),
        email: String(row[col.email ?? -1] ?? "").trim(),
        telefone: String(row[col.telefone ?? -1] ?? "").trim(),
        funcao: String(row[col.funcao ?? -1] ?? "").trim(),
        setor: String(row[col.setor ?? -1] ?? "").trim(),
        unidade: String(row[col.unidade ?? -1] ?? "").trim(),
        status: "valida",
        msgs: [],
      };
      // linha totalmente vazia
      if (!l.nome && !l.email && !l.telefone) continue;
      if (!l.nome) { l.status = "erro"; l.msgs.push("Nome ausente"); }
      if (l.email && !isEmailValido(l.email)) { l.status = "erro"; l.msgs.push("E-mail inválido"); }
      if (l.telefone && !isFoneValido(l.telefone)) { l.status = "erro"; l.msgs.push("Telefone incompatível"); }
      if (!l.email && !l.telefone && l.status === "valida") { l.status = "aviso"; l.msgs.push("Sem e-mail e sem telefone"); }

      const ne = normEmail(l.email);
      const nf = normFone(l.telefone);
      const nnKey = `${normTexto(l.nome)}|${normTexto(l.funcao)}|${normTexto(l.setor)}|${normTexto(l.unidade)}`;

      const dupBanco = (ne && emailsExist.has(ne)) || (nf && fonesExist.has(nf));
      const dupArquivo = (ne && seenEmails.has(ne)) || (nf && seenFones.has(nf)) || seenNomes.has(nnKey);
      if (dupBanco || dupArquivo) {
        l.status = l.status === "erro" ? "erro" : "duplicada";
        l.msgs.push(dupBanco ? "Já existe no cadastro" : "Duplicada no arquivo");
      }
      if (EXEMPLO_EMAILS.has((ne || "").toLowerCase())) {
        l.status = "aviso"; l.msgs.push("Linha do modelo de exemplo");
      }
      if (ne) seenEmails.add(ne);
      if (nf) seenFones.add(nf);
      seenNomes.add(nnKey);
      parsedLinhas.push(l);
    }
    setLinhas(parsedLinhas);
    setEtapa(3);
  }

  async function confirmar() {
    const validas = linhas.filter((l) => l.status === "valida" || l.status === "aviso");
    if (!validas.length) return toast.info("Nenhuma linha válida para importar.");
    setImportando(true);
    try {
      const { data: imp, error: iErr } = await sb.from("psico_importacoes_participantes").insert({
        avaliacao_id: avaliacaoId,
        nome_arquivo: arquivo?.name || "arquivo",
        formato: (arquivo?.name || "").toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
        status: "processando",
        total_linhas: linhas.length,
        linhas_validas: validas.length,
        linhas_com_erro: linhas.filter((l) => l.status === "erro").length,
        linhas_com_aviso: linhas.filter((l) => l.status === "aviso").length,
        estrategia_duplicidade: "ignorar",
      }).select("id").single();
      if (iErr) throw iErr;

      const rows = validas.map((l) => ({
        avaliacao_id: avaliacaoId,
        nome: l.nome,
        email: l.email || null,
        telefone: l.telefone || null,
        funcao: l.funcao || null,
        setor: l.setor || null,
        unidade: l.unidade || null,
        origem_cadastro: "importacao",
        importacao_id: imp.id,
      }));
      // insere em lote
      const { error: pErr, count } = await sb.from("psico_participantes").insert(rows, { count: "exact" });
      if (pErr) throw pErr;

      await sb.from("psico_importacoes_participantes").update({
        status: "concluida",
        linhas_importadas: rows.length,
        linhas_ignoradas: linhas.filter((l) => l.status === "erro" || l.status === "duplicada").length,
        concluido_em: new Date().toISOString(),
        resumo: { linhas: linhas.filter((l) => l.status === "erro").map((l) => ({ linha: l.n, codigo: l.msgs[0] || "ERRO" })) },
      }).eq("id", imp.id);

      await sb.from("psico_auditoria").insert({
        entidade: "avaliacao", entidade_id: avaliacaoId,
        acao: "importacao_concluida",
        metadados: { quantidade: rows.length, ignoradas: linhas.length - rows.length },
      });

      toast.success(`${rows.length} participante(s) importado(s).`);
      onDone();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Falha na importação");
    } finally {
      setImportando(false);
    }
  }

  const resumo = useMemo(() => ({
    total: linhas.length,
    validas: linhas.filter((l) => l.status === "valida").length,
    avisos: linhas.filter((l) => l.status === "aviso").length,
    erros: linhas.filter((l) => l.status === "erro").length,
    duplicadas: linhas.filter((l) => l.status === "duplicada").length,
  }), [linhas]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Importar participantes — Etapa {etapa} de 4</DialogTitle></DialogHeader>

        {etapa === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aceitos: CSV e XLSX. Limite: 5 MB e 5.000 linhas. Colunas: Nome (obrigatório), E-mail, Telefone, Função, Setor, Unidade.
            </p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={(e) => e.target.files?.[0] && processarArquivo(e.target.files[0])} />
          </div>
        )}

        {etapa === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2 text-sm">
              <div className="rounded border p-2"><div className="text-xs">Total</div><div className="font-semibold">{resumo.total}</div></div>
              <div className="rounded border p-2"><div className="text-xs">Válidas</div><div className="font-semibold text-emerald-600">{resumo.validas}</div></div>
              <div className="rounded border p-2"><div className="text-xs">Avisos</div><div className="font-semibold text-amber-600">{resumo.avisos}</div></div>
              <div className="rounded border p-2"><div className="text-xs">Erros</div><div className="font-semibold text-destructive">{resumo.erros}</div></div>
              <div className="rounded border p-2"><div className="text-xs">Duplicadas</div><div className="font-semibold">{resumo.duplicadas}</div></div>
            </div>
            <div className="max-h-[400px] overflow-auto border rounded">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Linha</TableHead><TableHead>Nome</TableHead><TableHead>Contato</TableHead>
                  <TableHead>Função</TableHead><TableHead>Setor</TableHead><TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow key={l.n}>
                      <TableCell>{l.n}</TableCell>
                      <TableCell>{l.nome}</TableCell>
                      <TableCell className="text-xs">
                        <div>{mascararEmail(l.email)}</div>
                        <div>{mascararTelefone(l.telefone)}</div>
                      </TableCell>
                      <TableCell>{l.funcao}</TableCell>
                      <TableCell>{l.setor}</TableCell>
                      <TableCell>{l.unidade}</TableCell>
                      <TableCell>
                        <Badge variant={l.status === "erro" ? "destructive" : l.status === "valida" ? "default" : "outline"}>{l.status}</Badge>
                        {l.msgs.length > 0 && <div className="text-[10px] text-muted-foreground mt-1">{l.msgs.join(" · ")}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {etapa === 1 && <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>}
          {etapa === 3 && (
            <>
              <Button variant="ghost" onClick={reset}>Recomeçar</Button>
              <Button disabled={importando || resumo.validas + resumo.avisos === 0} onClick={confirmar}>
                Importar {resumo.validas + resumo.avisos} linha(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}