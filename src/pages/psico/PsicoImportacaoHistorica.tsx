// Fase 9 — Wizard de Importação de Avaliações Históricas (Modo Bruto)
// Fluxo:
//  1) Contexto: cliente, questionário legado, metodologia, observação
//  2) Upload do arquivo (CSV/XLSX)
//  3) Mapeamento de colunas → tipo (data, função, setor, unidade) e pergunta→coluna
//  4) Validação (staging técnico) + resumo de erros/avisos
//  5) Confirmação da avaliação histórica + commit
//  6) Sucesso ou cancelamento
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BASE = "/operacoes/avaliacao-fatores-psicossociais";
const sb: any = supabase;

type Cliente = { id: string; razao_social: string; nome_fantasia: string | null };
type Questionario = {
  id: string; codigo: string; nome: string; versao: string;
  vigente: boolean; metodologia_versao_id: string;
};
type UploadResp = {
  importacao_id: string; formato: "csv" | "xlsx";
  hash_sha256: string; tamanho_bytes: number;
  cabecalhos: string[]; amostra: string[][];
};
type ValidarResp = { ok: true; resumo: any; erros_registrados: number };

const CAMPO_LABEL: Record<string, string> = {
  none: "— não usar —",
};

function useAuthedFunctionCall() {
  return async (name: string, init: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const url = `https://ujctjiugstfrlaasgrop.supabase.co/functions/v1/${name}`;
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    if (!headers.has("apikey")) headers.set("apikey", (supabase as any).supabaseKey || "");
    return fetch(url, { ...init, headers });
  };
}

export default function PsicoImportacaoHistorica() {
  const nav = useNavigate();
  const call = useAuthedFunctionCall();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [tipo, setTipo] = useState<"bruta_respondentes" | "agregada_perguntas">("bruta_respondentes");

  // Passo 1: contexto
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [questionarios, setQuestionarios] = useState<Questionario[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [questId, setQuestId] = useState("");
  const [obsOrigem, setObsOrigem] = useState("Coleta realizada em campo antes do Portal HSE (Google Forms / planilha).");

  // Passo 2: upload
  const [file, setFile] = useState<File | null>(null);
  const [uploadResp, setUploadResp] = useState<UploadResp | null>(null);
  const [perguntasNumeros, setPerguntasNumeros] = useState<number[]>([]);

  // Passo 3: mapeamento
  const [mapData, setMapData] = useState("none");
  const [mapFuncao, setMapFuncao] = useState("none");
  const [mapSetor, setMapSetor] = useState("none");
  const [mapUnidade, setMapUnidade] = useState("none");
  const [mapPerguntas, setMapPerguntas] = useState<Record<string, string>>({}); // numero → header
  const [ignoradas, setIgnoradas] = useState<Set<string>>(new Set());

  // Passo 4: validação
  const [validarResp, setValidarResp] = useState<ValidarResp | null>(null);
  const [errosDetalhados, setErrosDetalhados] = useState<any[]>([]);

  // Passo 5: commit
  const [avalTitulo, setAvalTitulo] = useState("");
  const [avalUnidade, setAvalUnidade] = useState("Geral");
  const [avalDataInicio, setAvalDataInicio] = useState("");
  const [avalDataFim, setAvalDataFim] = useState("");
  const [commitResult, setCommitResult] = useState<any>(null);

  useEffect(() => {
    document.title = "Importar Avaliação Histórica | Portal HSE";
    (async () => {
      const [c, q] = await Promise.all([
        supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
        sb.from("psico_questionarios_versoes")
          .select("id, codigo, nome, versao, vigente, metodologia_versao_id")
          .order("codigo"),
      ]);
      setClientes((c.data as Cliente[]) || []);
      setQuestionarios((q.data as Questionario[]) || []);
      const legado = (q.data as Questionario[] || []).find(x => x.codigo?.startsWith("QPPOT-1.0-LEGADO"));
      if (legado) setQuestId(legado.id);
    })();
  }, []);

  useEffect(() => {
    if (!questId) { setPerguntasNumeros([]); return; }
    (async () => {
      const { data } = await sb.from("psico_perguntas")
        .select("numero").eq("questionario_versao_id", questId).order("numero");
      setPerguntasNumeros((data || []).map((p: any) => p.numero));
    })();
  }, [questId]);

  useEffect(() => {
    if (clienteId && !avalTitulo) {
      const c = clientes.find(x => x.id === clienteId);
      const nome = c?.nome_fantasia || c?.razao_social || "";
      if (nome) setAvalTitulo(`Avaliação histórica — ${nome} — ${new Date().getFullYear() - 1}`);
    }
  }, [clienteId, clientes]);

  const questSelecionado = useMemo(
    () => questionarios.find(q => q.id === questId) || null,
    [questionarios, questId]
  );

  // ---------------- ações ----------------
  async function doUpload() {
    if (!file || !clienteId || !questSelecionado) { toast.error("Selecione cliente, questionário e arquivo"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Arquivo maior que 25 MB"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("arquivo", file);
    fd.append("cliente_id", clienteId);
    fd.append("tipo", tipo);
    fd.append("questionario_versao_id", questSelecionado.id);
    fd.append("metodologia_versao_id", questSelecionado.metodologia_versao_id);
    fd.append("idempotency_key", crypto.randomUUID());
    try {
      const r = await call("psico-importacao-upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detalhe || j.error || "Falha no upload");
      setUploadResp(j as UploadResp);
      // Modo agregado: pula mapear/validar (colunas fixas) e vai para confirmação (step 5)
      setStep(tipo === "agregada_perguntas" ? 5 : 3);
    } catch (e: any) { toast.error(e.message || "Falha no upload"); }
    finally { setBusy(false); }
  }

  async function doValidar() {
    if (!uploadResp) return;
    if (Object.values(mapPerguntas).filter(Boolean).length === 0) {
      toast.error("Mapeie ao menos uma pergunta"); return;
    }
    setBusy(true);
    const payload = {
      importacao_id: uploadResp.importacao_id,
      mapeamento: {
        data_resposta: mapData !== "none" ? mapData : undefined,
        funcao: mapFuncao !== "none" ? mapFuncao : undefined,
        setor: mapSetor !== "none" ? mapSetor : undefined,
        unidade: mapUnidade !== "none" ? mapUnidade : undefined,
        perguntas: Object.fromEntries(Object.entries(mapPerguntas).filter(([, v]) => !!v)),
        ignoradas: Array.from(ignoradas),
      },
    };
    try {
      const r = await call("psico-importacao-validar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detalhe || j.error || "Falha na validação");
      setValidarResp(j as ValidarResp);
      const { data } = await sb.from("psico_importacoes_erros")
        .select("numero_linha, codigo, campo, severidade, mensagem")
        .eq("importacao_id", uploadResp.importacao_id).order("numero_linha").limit(200);
      setErrosDetalhados(data || []);
      setStep(5);
    } catch (e: any) { toast.error(e.message || "Falha na validação"); }
    finally { setBusy(false); }
  }

  async function doCommit() {
    if (!uploadResp) return;
    setBusy(true);
    try {
      const endpoint = tipo === "agregada_perguntas"
        ? "psico-importacao-agregada-commit"
        : "psico-importacao-commit";
      const r = await call(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          importacao_id: uploadResp.importacao_id,
          titulo: avalTitulo,
          unidade: avalUnidade,
          data_inicio: avalDataInicio || null,
          data_fim: avalDataFim || null,
          observacao_origem: obsOrigem,
          purgar_arquivo: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detalhe || j.error || "Falha no commit");
      setCommitResult(j);
      setStep(6);
      toast.success("Importação concluída");
    } catch (e: any) { toast.error(e.message || "Falha no commit"); }
    finally { setBusy(false); }
  }

  async function doCancelar() {
    if (!uploadResp) { nav(BASE); return; }
    setBusy(true);
    try {
      await call("psico-importacao-cancelar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importacao_id: uploadResp.importacao_id, motivo: "cancelado_pelo_usuario" }),
      });
      toast.success("Importação cancelada e arquivo removido");
      nav(BASE);
    } catch { toast.error("Falha ao cancelar"); }
    finally { setBusy(false); }
  }

  // ---------------- render ----------------
  return (
    <div>
      <PageHeader
        title="Importar Avaliação Histórica"
        subtitle="Modo Bruto — uma linha do arquivo = um respondente anônimo."
        actions={
          <Button variant="ghost" onClick={() => nav(BASE)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        }
      />
      <div className="p-6 space-y-6 max-w-5xl">
        <StepIndicator step={step} />

        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Privacidade e rigor metodológico</AlertTitle>
          <AlertDescription className="text-sm space-y-1">
            <div>• Nomes, e-mails e telefones do arquivo <b>nunca serão persistidos</b>. Só metadados anonimizados (função, setor, unidade) e as respostas.</div>
            <div>• Convites artificiais <b>não</b> serão criados. Respostas ficam marcadas como <code>origem_registro=importacao_bruta</code>.</div>
            <div>• O arquivo original permanece em bucket privado apenas até a conclusão desta importação — depois é removido.</div>
          </AlertDescription>
        </Alert>

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>1. Contexto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Modo de importação *</Label>
                <div className="grid md:grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setTipo("bruta_respondentes")}
                    className={`text-left border rounded p-3 ${tipo === "bruta_respondentes" ? "border-primary bg-primary/5" : "border-muted"}`}
                  >
                    <div className="font-medium text-sm">Bruto (um respondente por linha)</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      CSV/XLSX do Google Forms ou export similar. Permite segmentação por função/setor/unidade.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("agregada_perguntas")}
                    className={`text-left border rounded p-3 ${tipo === "agregada_perguntas" ? "border-primary bg-primary/5" : "border-muted"}`}
                  >
                    <div className="font-medium text-sm">Agregado (contagens por pergunta)</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Colunas: <code>numero</code>, <code>quantidade_nunca</code> … <code>quantidade_sempre</code>.
                      <b> Sem segmentação</b> e sem % de participação.
                    </div>
                  </button>
                </div>
                {tipo === "agregada_perguntas" && (
                  <p className="text-xs text-amber-700 mt-2">
                    ⚠ No modo agregado a avaliação fica marcada como <code>segmentacao_disponivel=false</code> e
                    <code> participacao_calculavel=false</code>. Nenhuma resposta individual é criada.
                  </p>
                )}
              </div>
              <div>
                <Label>Cliente *</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Questionário *</Label>
                <Select value={questId} onValueChange={setQuestId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a versão" /></SelectTrigger>
                  <SelectContent>
                    {questionarios.map(q => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.codigo} — {q.nome} (v{q.versao}) {q.vigente ? "· vigente" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {questSelecionado?.codigo?.startsWith("QPPOT-1.0-LEGADO") && (
                  <p className="text-xs text-muted-foreground mt-1">
                    QPPOT-1.0-LEGADO — questionário histórico (35 perguntas). Não vigente para novas coletas.
                  </p>
                )}
              </div>
              <div>
                <Label>Observação de origem</Label>
                <Textarea value={obsOrigem} onChange={e => setObsOrigem(e.target.value)} rows={2} />
                <p className="text-xs text-muted-foreground mt-1">Ficará registrada na avaliação criada.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => nav(BASE)}>Cancelar</Button>
                <Button disabled={!clienteId || !questId} onClick={() => setStep(2)}>
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>2. Upload do arquivo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Arquivo (CSV ou XLSX, até 25 MB)</Label>
                <Input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} />
                {file && (
                  <div className="text-sm text-muted-foreground mt-2">
                    <b>{file.name}</b> · {(file.size / 1024).toFixed(1)} KB
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Cada linha representa um respondente. Colunas com nome/e-mail/telefone podem existir no arquivo — serão
                marcadas como ignoradas no próximo passo e não serão gravadas.
              </p>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
                <Button disabled={!file || busy} onClick={doUpload}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Enviar e detectar colunas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && uploadResp && (
          <MapeamentoStep
            headers={uploadResp.cabecalhos}
            amostra={uploadResp.amostra}
            perguntasNumeros={perguntasNumeros}
            mapData={mapData} setMapData={setMapData}
            mapFuncao={mapFuncao} setMapFuncao={setMapFuncao}
            mapSetor={mapSetor} setMapSetor={setMapSetor}
            mapUnidade={mapUnidade} setMapUnidade={setMapUnidade}
            mapPerguntas={mapPerguntas} setMapPerguntas={setMapPerguntas}
            ignoradas={ignoradas} setIgnoradas={setIgnoradas}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>4. Validação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vamos ler o arquivo, normalizar as opções de resposta e gerar um staging técnico sem PII.
                Nenhuma resposta é ainda gravada nas tabelas finais.
              </p>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
                <Button disabled={busy} onClick={doValidar}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Validar arquivo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && validarResp && (
          <>
            <Card>
              <CardHeader><CardTitle>5. Resumo da validação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Linhas totais" value={validarResp.resumo.total_linhas} />
                  <MetricCard label="Válidas" value={validarResp.resumo.linhas_validas} good />
                  <MetricCard label="Inválidas" value={validarResp.resumo.linhas_invalidas} bad />
                  <MetricCard label="Avisos" value={validarResp.resumo.avisos || 0} warn />
                </div>
                {errosDetalhados.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">
                      Ocorrências ({errosDetalhados.length}{errosDetalhados.length >= 200 ? "+" : ""})
                    </div>
                    <div className="max-h-64 overflow-auto border rounded">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Linha</TableHead><TableHead>Severidade</TableHead>
                          <TableHead>Código</TableHead><TableHead>Mensagem</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {errosDetalhados.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell>{e.numero_linha ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant={e.severidade === "erro" ? "destructive" : "secondary"}>{e.severidade}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">{e.codigo}</TableCell>
                              <TableCell className="text-xs">{e.mensagem}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                {validarResp.resumo.linhas_validas === 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Sem linhas válidas</AlertTitle>
                    <AlertDescription>Revise o mapeamento e retorne para tentar novamente.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Confirmação da avaliação histórica</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input value={avalTitulo} onChange={e => setAvalTitulo(e.target.value)} />
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <Label>Unidade</Label>
                    <Input value={avalUnidade} onChange={e => setAvalUnidade(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data início (coleta original)</Label>
                    <Input type="date" value={avalDataInicio} onChange={e => setAvalDataInicio(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data fim (coleta original)</Label>
                    <Input type="date" value={avalDataFim} onChange={e => setAvalDataFim(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="ghost" onClick={doCancelar} disabled={busy}>
                    <X className="h-4 w-4 mr-2" /> Cancelar importação
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(3)} disabled={busy}>Ajustar mapeamento</Button>
                    <Button
                      disabled={busy || !avalTitulo || validarResp.resumo.linhas_validas === 0}
                      onClick={doCommit}
                    >
                      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Concluir importação
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {step === 6 && commitResult && (
          <Card>
            <CardHeader><CardTitle>Importação concluída</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-green-700">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <div className="font-medium">{commitResult.respondentes_importados} respondentes importados</div>
                  <div className="text-sm text-muted-foreground">{commitResult.total_itens_importados} respostas gravadas</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => nav(`${BASE}/avaliacoes/${commitResult.avaliacao_id}`)}>Abrir avaliação</Button>
                <Button variant="outline" onClick={() => nav(BASE)}>Voltar à lista</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Contexto", "Upload", "Mapear", "Validar", "Confirmar", "Concluído"];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-7 min-w-7 px-2 rounded-full text-xs font-medium flex items-center justify-center ${
              done ? "bg-green-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{done ? "✓" : n}</div>
            <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            {n < steps.length && <span className="text-muted-foreground">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, good, bad, warn }: { label: string; value: number | string; good?: boolean; bad?: boolean; warn?: boolean }) {
  const cls = good ? "text-green-700" : bad ? "text-destructive" : warn ? "text-amber-700" : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

// ---------- Passo 3 componente separado ----------
function MapeamentoStep(props: {
  headers: string[]; amostra: string[][]; perguntasNumeros: number[];
  mapData: string; setMapData: (v: string) => void;
  mapFuncao: string; setMapFuncao: (v: string) => void;
  mapSetor: string; setMapSetor: (v: string) => void;
  mapUnidade: string; setMapUnidade: (v: string) => void;
  mapPerguntas: Record<string, string>; setMapPerguntas: (v: Record<string, string>) => void;
  ignoradas: Set<string>; setIgnoradas: (v: Set<string>) => void;
  onBack: () => void; onNext: () => void;
}) {
  const { headers, amostra, perguntasNumeros } = props;

  // Sugestão automática: colunas cujo header contenha "?" ou termine em número → mapeadas em ordem
  useEffect(() => {
    if (Object.keys(props.mapPerguntas).length > 0) return;
    const candidatos = headers.filter(h =>
      /\?/.test(h) || /^\d+\s*[-.)]/.test(h)
    );
    const alvo = perguntasNumeros.slice(0, candidatos.length);
    const map: Record<string, string> = {};
    alvo.forEach((n, i) => { map[String(n)] = candidatos[i]; });
    props.setMapPerguntas(map);
    // Marca como ignorada colunas típicas de PII
    const piiRegex = /(nome|e-?mail|correio|telefone|celular|whatsapp|carimbo|timestamp)/i;
    const ign = new Set<string>();
    headers.forEach(h => { if (piiRegex.test(h)) ign.add(h); });
    props.setIgnoradas(ign);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headersDisponiveis = ["none", ...headers];
  const usadosContexto = new Set([props.mapData, props.mapFuncao, props.mapSetor, props.mapUnidade].filter(v => v !== "none"));

  function togglaIgnorada(h: string) {
    const s = new Set(props.ignoradas);
    if (s.has(h)) s.delete(h); else s.add(h);
    props.setIgnoradas(s);
  }

  const mapeadas = Object.values(props.mapPerguntas).filter(Boolean);
  const perguntasCount = mapeadas.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Mapear colunas</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {headers.length} colunas detectadas · {perguntasNumeros.length} perguntas no questionário · {perguntasCount} mapeadas
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="text-sm font-medium">Metadados (opcionais)</div>
          <div className="grid md:grid-cols-2 gap-3">
            <MapSelect label="Data da resposta" value={props.mapData} onChange={props.setMapData} options={headersDisponiveis} />
            <MapSelect label="Função" value={props.mapFuncao} onChange={props.setMapFuncao} options={headersDisponiveis} />
            <MapSelect label="Setor" value={props.mapSetor} onChange={props.setMapSetor} options={headersDisponiveis} />
            <MapSelect label="Unidade" value={props.mapUnidade} onChange={props.setMapUnidade} options={headersDisponiveis} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-medium">Perguntas do questionário → coluna do arquivo</div>
          <div className="max-h-96 overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nº</TableHead>
                  <TableHead>Coluna do arquivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perguntasNumeros.map(n => (
                  <TableRow key={n}>
                    <TableCell className="font-medium">{n}</TableCell>
                    <TableCell>
                      <Select
                        value={props.mapPerguntas[String(n)] || "none"}
                        onValueChange={v => {
                          const m = { ...props.mapPerguntas };
                          if (v === "none") delete m[String(n)]; else m[String(n)] = v;
                          props.setMapPerguntas(m);
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— não mapear —</SelectItem>
                          {headers.map(h => (
                            <SelectItem key={h} value={h} disabled={usadosContexto.has(h)}>
                              {h.length > 80 ? h.slice(0, 80) + "…" : h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-medium">Colunas de PII (não serão persistidas)</div>
          <div className="flex flex-wrap gap-2">
            {headers.map(h => (
              <button
                key={h} type="button" onClick={() => togglaIgnorada(h)}
                className={`text-xs px-2 py-1 rounded border ${
                  props.ignoradas.has(h)
                    ? "bg-amber-100 border-amber-400 text-amber-900"
                    : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
                }`}
                title={props.ignoradas.has(h) ? "Marcada como ignorada — clique para desmarcar" : "Marcar como ignorada"}
              >
                {props.ignoradas.has(h) ? "🚫 " : ""}{h.length > 40 ? h.slice(0, 40) + "…" : h}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Colunas ignoradas nunca são lidas do arquivo além do parse — o edge function não as envia ao staging.
          </p>
        </section>

        {amostra.length > 0 && (
          <section className="space-y-2">
            <div className="text-sm font-medium">Prévia (5 primeiras linhas)</div>
            <div className="max-h-56 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>{headers.slice(0, 8).map(h => <TableHead key={h}>{h.slice(0, 30)}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {amostra.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {headers.slice(0, 8).map((_, j) => <TableCell key={j} className="text-xs">{(row[j] || "").slice(0, 40)}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={props.onBack}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
          <Button disabled={perguntasCount === 0} onClick={props.onNext}>
            Ir para validação <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MapSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(h => (
            <SelectItem key={h} value={h}>
              {h === "none" ? "— não usar —" : (h.length > 60 ? h.slice(0, 60) + "…" : h)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}