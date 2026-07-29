import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { validarPublico } from "@/lib/psicoRelatorio";

const VALIDATION_CODE_PATTERN = /[0-9a-f]{4}(?:-[0-9a-f]{4}){7}/i;

export function normalizeValidationCode(value: string) {
  const extracted = value.match(VALIDATION_CODE_PATTERN)?.[0];
  return (extracted ?? value.replace(/\s+/g, "")).trim().toUpperCase();
}

export default function PsicoValidarRelatorio() {
  const [sp, setSp] = useSearchParams();
  const [codigo, setCodigo] = useState(() => normalizeValidationCode(sp.get("codigo") || ""));
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [buscou, setBuscou] = useState(false);

  useEffect(() => {
    document.title = "Validar Relatório | Portal HSE";
  }, []);

  async function consultar(cod: string) {
    const normalizado = normalizeValidationCode(cod);
    setCodigo(normalizado);

    if (normalizado.length < 20) {
      setRes({ encontrado: false, valido: false });
      setBuscou(true);
      return;
    }

    setLoading(true);
    const { data, error } = await validarPublico(normalizado);
    setLoading(false);
    setBuscou(true);

    if (error) {
      setRes({ encontrado: false, valido: false, _erro: error.message });
      return;
    }

    setRes(data);
  }

  useEffect(() => {
    const q = sp.get("codigo");
    if (q) void consultar(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizado = normalizeValidationCode(codigo);
    setSp(normalizado ? { codigo: normalizado } : {});
    void consultar(normalizado);
  }

  const encontrado = res?.encontrado === undefined ? !!res?.valido : !!res.encontrado;
  const valido = !!res?.valido;
  const erroConsulta = !!res?._erro;
  const status: string = res?.status || "";
  const emitido = status === "Emitido";
  const substituido = status === "Substituído";
  const revogado = status === "Revogado";

  return (
    <div className="min-h-dvh bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 grid place-items-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Validação de Relatório</h1>
          <p className="text-sm text-muted-foreground">
            Confirme a autenticidade e a situação atual de um Relatório de Avaliação de Fatores Psicossociais.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Código de validação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Cole o código ou o texto completo impresso no relatório</Label>
                <Input
                  value={codigo}
                  onChange={(event) => setCodigo(event.target.value)}
                  placeholder="Ex.: 56B4-2E6A-BACE-821B-75DD-D258-383B-7A91"
                  className="font-mono"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Letras maiúsculas ou minúsculas e espaços são aceitos.
                </p>
              </div>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando…
                  </>
                ) : (
                  "Validar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {buscou && !loading && (
          <Card>
            <CardContent className="py-6">
              {erroConsulta ? (
                <Alert variant="destructive">
                  <ShieldX className="h-4 w-4" />
                  <AlertTitle>Não foi possível validar agora</AlertTitle>
                  <AlertDescription>
                    O serviço de validação não respondeu. Tente novamente em alguns instantes.
                  </AlertDescription>
                </Alert>
              ) : !encontrado ? (
                <Alert variant="destructive">
                  <ShieldX className="h-4 w-4" />
                  <AlertTitle>Código não localizado</AlertTitle>
                  <AlertDescription>
                    Não encontramos um documento associado a este código. Confira se o valor foi copiado integralmente.
                  </AlertDescription>
                </Alert>
              ) : !valido ? (
                <Alert variant="destructive">
                  <ShieldX className="h-4 w-4" />
                  <AlertTitle>Documento indisponível</AlertTitle>
                  <AlertDescription>
                    O código foi reconhecido, mas esta emissão não está disponível como documento oficial.
                  </AlertDescription>
                </Alert>
              ) : revogado ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Relatório revogado</AlertTitle>
                  <AlertDescription>
                    Esta versão foi revogada pela HSE Consulting e não deve ser utilizada como referência oficial.
                  </AlertDescription>
                </Alert>
              ) : substituido ? (
                <Alert className="border-amber-300 bg-amber-50 text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <AlertTitle>Versão autêntica, mas substituída</AlertTitle>
                  <AlertDescription>
                    Esta revisão pertence ao histórico do relatório, mas não é mais a versão vigente.
                    {res.revisao_vigente ? (
                      <> A revisão vigente é <strong>{res.revisao_vigente}</strong>.</>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <AlertTitle>Relatório autêntico e vigente</AlertTitle>
                  <AlertDescription>
                    Os metadados abaixo confirmam a emissão oficial pelo Portal HSE Consulting.
                  </AlertDescription>
                </Alert>
              )}

              {encontrado && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
                  <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                    <Info label="Organização avaliada" value={res.organizacao || "Não informada"} />
                    {res.cnpj_mascarado ? (
                      <div className="mt-2">
                        <Info label="CNPJ" value={<span className="font-mono">{res.cnpj_mascarado}</span>} />
                      </div>
                    ) : null}
                  </div>
                  <Info label="Código RAFP" value={<span className="font-mono">{res.codigo_rafp}</span>} />
                  <Info label="Revisão consultada" value={<span className="font-mono">{res.codigo_revisao}</span>} />
                  <Info
                    label="Situação"
                    value={<StatusBadge status={status} emitido={emitido} substituido={substituido} />}
                  />
                  <Info label="Data de emissão" value={res.data_emissao ? formatDateTime(res.data_emissao) : "—"} />
                  {substituido && res.revisao_vigente ? (
                    <Info
                      label="Revisão vigente"
                      value={<span className="font-mono font-semibold">{res.revisao_vigente}</span>}
                    />
                  ) : null}
                  <Info label="Modelo" value={<span className="font-mono">{res.modelo}</span>} />
                  <Info
                    label="Responsável técnico"
                    value={
                      res.responsavel_tecnico?.nome ? (
                        <>
                          {res.responsavel_tecnico.nome}
                          {res.responsavel_tecnico.registro ? (
                            <span className="text-xs text-muted-foreground">
                              {" "}· {res.responsavel_tecnico.registro}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <div className="sm:col-span-2">
                    <Info
                      label="Hash SHA-256 (abreviado)"
                      value={<span className="font-mono text-xs break-all">{res.hash_abreviado || "—"}…</span>}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-[11px] text-center text-muted-foreground">
          Esta consulta apresenta somente metadados de autenticidade. O conteúdo da avaliação e os dados dos
          participantes permanecem protegidos.
        </p>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  emitido,
  substituido,
}: {
  status: string;
  emitido: boolean;
  substituido: boolean;
}) {
  const className = emitido
    ? "bg-emerald-100 text-emerald-800"
    : substituido
      ? "bg-amber-100 text-amber-900"
      : "bg-destructive/15 text-destructive";

  return <Badge className={className}>{status || "Indisponível"}</Badge>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
