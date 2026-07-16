import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import {
  baixarVersao,
  gerarRelatorio,
  getRelatorio,
  listarVersoes,
  REL_STATUS_COLOR,
  REL_STATUS_LABEL,
  RelatorioVersaoStatus,
  revogarVersao,
  traduzirErroEmissao,
  validarEmissao,
} from "@/lib/psicoRelatorio";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";

function fmtBytes(n?: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PsicoRelatorioTab({ av, onReload }: { av: any; onReload: () => void }) {
  const { isAdmin } = useAuth();
  const [validacao, setValidacao] = useState<any>(null);
  const [relatorio, setRelatorio] = useState<any>(null);
  const [versoes, setVersoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTxt, setConfirmTxt] = useState("");
  const [descricao, setDescricao] = useState("");

  const [revogarAlvo, setRevogarAlvo] = useState<any>(null);
  const [motivoRevogar, setMotivoRevogar] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: val }, rel] = await Promise.all([validarEmissao(av.id), getRelatorio(av.id)]);
    setValidacao(val);
    setRelatorio(rel);
    if (rel?.id) setVersoes(await listarVersoes(rel.id));
    else setVersoes([]);
    setLoading(false);
  }, [av.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const proximaRev: string = validacao?.proxima_revisao || "R00";
  const isPrimeira = proximaRev === "R00";
  const podeEmitir: boolean = !!validacao?.pode_emitir;
  const erros: string[] = (validacao?.erros as string[]) || [];
  const emAndamento = versoes.find((v) => v.status === "preparando" || v.status === "gerando");
  const versaoAtiva = versoes.find((v) => v.id === relatorio?.versao_ativa_id);
  const codigoEsperado = `EMITIR ${av.codigo}`;

  async function handleEmitir() {
    if (confirmTxt !== codigoEsperado) {
      toast.error(`Digite exatamente: ${codigoEsperado}`);
      return;
    }
    if (!isPrimeira && descricao.trim().length < 10) {
      toast.error("Descreva o motivo da nova revisão (mín. 10 caracteres).");
      return;
    }
    setGerando(true);
    const { data, error } = await gerarRelatorio(av.id, codigoEsperado, isPrimeira ? undefined : descricao);
    setGerando(false);
    if (error) {
      const msg = (error as any)?.message || String(error);
      toast.error(traduzirErroEmissao(msg) || "Falha ao gerar relatório");
      await carregar();
      return;
    }
    if ((data as any)?.reutilizada) {
      toast.success("Emissão idêntica já existente — reutilizada.");
    } else {
      toast.success(`Relatório emitido: ${(data as any)?.codigo} ${(data as any)?.codigo_revisao}`);
    }
    setConfirmOpen(false);
    setConfirmTxt("");
    setDescricao("");
    await carregar();
    onReload?.();
  }

  async function handleBaixar(versaoId: string) {
    const { url, error } = await baixarVersao(versaoId);
    if (error || !url) {
      toast.error(traduzirErroEmissao(error || "arquivo_indisponivel"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRevogar() {
    if (!revogarAlvo) return;
    if (motivoRevogar.trim().length < 20) {
      toast.error("Descreva o motivo com pelo menos 20 caracteres.");
      return;
    }
    const { error } = await revogarVersao(revogarAlvo.id, motivoRevogar);
    if (error) return toast.error((error as any).message);
    toast.success("Versão revogada.");
    setRevogarAlvo(null);
    setMotivoRevogar("");
    await carregar();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
          Carregando estado do relatório…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Relatório de Avaliação de Fatores Psicossociais
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Modelo <span className="font-mono">HSE-PSICO-REL-1.0</span> · Próxima revisão{" "}
              <span className="font-mono">{proximaRev}</span>
              {relatorio?.codigo && (
                <> · Código <span className="font-mono">{relatorio.codigo}</span></>
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={carregar} disabled={gerando}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Checklist de prontidão */}
          <div className="grid gap-2 sm:grid-cols-2">
            <ChecklistItem ok={validacao?.processamento_valido} label="Processamento de resultado concluído" />
            <ChecklistItem ok={validacao?.revisao_tecnica_aprovada} label="Revisão técnica aprovada" />
            <ChecklistItem ok={validacao?.plano_aprovado} label="Plano de ação aprovado" />
            <ChecklistItem ok={validacao?.responsavel_tecnico_valido} label="Responsável técnico definido" />
          </div>

          {!podeEmitir && erros.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pendências para emissão</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm">
                  {erros.map((e, i) => (
                    <li key={i}>{traduzirErroEmissao(e)}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {emAndamento && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Emissão em andamento</AlertTitle>
              <AlertDescription>
                Revisão <span className="font-mono">{emAndamento.codigo_revisao}</span> está sendo gerada.
                Aguarde e clique em Atualizar.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button disabled={!podeEmitir || !!emAndamento || gerando}>
                  <FileText className="h-4 w-4 mr-2" />
                  {isPrimeira ? "Emitir relatório" : `Emitir nova revisão (${proximaRev})`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar emissão do relatório</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação gera o PDF oficial e o registra imutavelmente como{" "}
                    <span className="font-mono">{relatorio?.codigo || "novo"} {proximaRev}</span>. Para confirmar,
                    digite exatamente <span className="font-mono font-bold">{codigoEsperado}</span> abaixo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3">
                  {!isPrimeira && (
                    <div>
                      <Label>Motivo da nova revisão *</Label>
                      <Textarea
                        rows={3}
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Descreva o que motivou a nova revisão"
                      />
                    </div>
                  )}
                  <div>
                    <Label>Confirmação</Label>
                    <Input
                      value={confirmTxt}
                      onChange={(e) => setConfirmTxt(e.target.value)}
                      placeholder={codigoEsperado}
                      autoFocus
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleEmitir();
                    }}
                    disabled={gerando}
                  >
                    {gerando ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando…
                      </>
                    ) : (
                      "Confirmar emissão"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {versaoAtiva && (
              <Button variant="outline" onClick={() => handleBaixar(versaoAtiva.id)}>
                <Download className="h-4 w-4 mr-2" /> Baixar versão ativa ({versaoAtiva.codigo_revisao})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Versão ativa em destaque */}
      {versaoAtiva && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Versão ativa
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <Info label="Código" value={<span className="font-mono">{relatorio?.codigo} {versaoAtiva.codigo_revisao}</span>} />
            <Info label="Status" value={<Badge className={REL_STATUS_COLOR[versaoAtiva.status as RelatorioVersaoStatus]}>{REL_STATUS_LABEL[versaoAtiva.status as RelatorioVersaoStatus]}</Badge>} />
            <Info label="Emitido em" value={formatDateTime(versaoAtiva.emitido_em)} />
            <Info label="Páginas / Tamanho" value={`${versaoAtiva.arquivo_paginas ?? "—"} · ${fmtBytes(versaoAtiva.arquivo_tamanho_bytes)}`} />
            <Info label="Hash SHA-256" value={<span className="font-mono text-xs break-all">{versaoAtiva.pdf_hash_sha256}</span>} />
            <Info label="Código de validação" value={<span className="font-mono text-xs break-all">{versaoAtiva.codigo_validacao}</span>} />
          </CardContent>
        </Card>
      )}

      {/* Histórico de revisões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de revisões</CardTitle>
        </CardHeader>
        <CardContent>
          {versoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma emissão registrada até o momento.</p>
          ) : (
            <ul className="divide-y">
              {versoes.map((v) => {
                const st = v.status as RelatorioVersaoStatus;
                const podeBaixar = st === "emitido" || st === "substituido";
                const podeRevogar = isAdmin && podeBaixar;
                return (
                  <li key={v.id} className="py-3 flex items-start gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold">{v.codigo_revisao}</span>
                        <Badge className={REL_STATUS_COLOR[st]}>{REL_STATUS_LABEL[st]}</Badge>
                        {v.emitido_em && (
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(v.emitido_em)}
                          </span>
                        )}
                      </div>
                      {v.descricao_revisao && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {v.descricao_revisao}
                        </p>
                      )}
                      {st === "falhou" && v.erro_codigo && (
                        <p className="text-xs text-red-600 mt-1">
                          Falha: {traduzirErroEmissao(v.erro_codigo)}
                        </p>
                      )}
                      {st === "revogado" && v.motivo_revogacao && (
                        <p className="text-xs text-destructive mt-1">
                          Revogado em {formatDateTime(v.revogado_em)} — {v.motivo_revogacao}
                        </p>
                      )}
                      {podeBaixar && (
                        <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all">
                          hash {v.pdf_hash_sha256?.slice(0, 24)}… · {v.arquivo_paginas} pág · {fmtBytes(v.arquivo_tamanho_bytes)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {podeBaixar && (
                        <Button size="sm" variant="outline" onClick={() => handleBaixar(v.id)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                        </Button>
                      )}
                      {podeRevogar && (
                        <Button size="sm" variant="ghost" onClick={() => setRevogarAlvo(v)}>
                          <Ban className="h-3.5 w-3.5 mr-1 text-destructive" /> Revogar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de revogação */}
      <AlertDialog open={!!revogarAlvo} onOpenChange={(o) => !o && setRevogarAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar versão {revogarAlvo?.codigo_revisao}?</AlertDialogTitle>
            <AlertDialogDescription>
              A revogação é permanente. O PDF permanecerá arquivado, mas o download público será bloqueado.
              O motivo será registrado na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Motivo da revogação * (mín. 20 caracteres)</Label>
            <Textarea rows={3} value={motivoRevogar} onChange={(e) => setMotivoRevogar(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRevogar();
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );
}