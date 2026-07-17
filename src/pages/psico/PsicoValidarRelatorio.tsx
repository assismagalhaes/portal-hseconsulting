import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { validarPublico } from "@/lib/psicoRelatorio";
import { formatDateTime } from "@/lib/format";

/**
 * Página pública para validação da autenticidade de um Relatório de
 * Avaliação de Fatores Psicossociais (RAFP) emitido pelo Portal HSE.
 * Não expõe conteúdo do relatório — apenas metadados de autenticidade.
 */
export default function PsicoValidarRelatorio() {
  const [sp, setSp] = useSearchParams();
  const [codigo, setCodigo] = useState(sp.get("codigo") || "");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [buscou, setBuscou] = useState(false);

  useEffect(() => {
    document.title = "Validar Relatório | Portal HSE";
  }, []);

  async function consultar(cod: string) {
    if (!cod || cod.trim().length < 20) {
      setRes({ valido: false });
      setBuscou(true);
      return;
    }
    setLoading(true);
    const { data, error } = await validarPublico(cod.trim());
    setLoading(false);
    setBuscou(true);
    if (error) {
      setRes({ valido: false, _erro: error.message });
      return;
    }
    setRes(data);
  }

  useEffect(() => {
    const q = sp.get("codigo");
    if (q) consultar(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSp(codigo ? { codigo } : {});
    consultar(codigo);
  }

  const valido = !!res?.valido;
  const statusTxt: string = res?.status || "";
  const revogado = statusTxt === "Revogado";

  return (
    <div className="min-h-dvh bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 grid place-items-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Validação de Relatório</h1>
          <p className="text-sm text-muted-foreground">
            Verifique a autenticidade de um Relatório de Avaliação de Fatores Psicossociais emitido pelo Portal HSE.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Código de validação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Cole o código impresso na capa do relatório</Label>
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex.: 3f9c1b7e4a...(código de 128 bits)"
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando…</>
                ) : (
                  <>Validar</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {buscou && !loading && (
          <Card>
            <CardContent className="py-6">
              {!valido ? (
                <Alert variant="destructive">
                  <ShieldX className="h-4 w-4" />
                  <AlertTitle>Código não localizado</AlertTitle>
                  <AlertDescription>
                    Não encontramos nenhum relatório emitido com este código. Verifique se copiou o valor
                    completo, sem espaços em branco.
                  </AlertDescription>
                </Alert>
              ) : revogado ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Relatório revogado</AlertTitle>
                  <AlertDescription>
                    Este código corresponde a uma versão que foi <strong>revogada</strong> pela HSE Consulting
                    e não deve mais ser utilizada como referência oficial.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertTitle className="text-emerald-700">Relatório autêntico</AlertTitle>
                  <AlertDescription>
                    Emitido pelo Portal HSE Consulting. Os metadados abaixo confirmam a integridade do documento.
                  </AlertDescription>
                </Alert>
              )}

              {valido && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 text-sm">
                  <Info label="Código RAFP" value={<span className="font-mono">{res.codigo_rafp}</span>} />
                  <Info label="Revisão" value={<span className="font-mono">{res.codigo_revisao}</span>} />
                  <Info
                    label="Situação"
                    value={
                      <Badge
                        className={
                          statusTxt === "Emitido"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : statusTxt === "Substituído"
                            ? "bg-muted text-muted-foreground"
                            : "bg-destructive/15 text-destructive"
                        }
                      >
                        {statusTxt}
                      </Badge>
                    }
                  />
                  <Info label="Data de emissão" value={res.data_emissao ? formatDateTime(res.data_emissao) : "—"} />
                  <Info label="Modelo" value={<span className="font-mono">{res.modelo}</span>} />
                  <Info
                    label="Responsável técnico"
                    value={
                      res.responsavel_tecnico?.nome ? (
                        <>
                          {res.responsavel_tecnico.nome}
                          {res.responsavel_tecnico.registro && (
                            <span className="text-xs text-muted-foreground"> · {res.responsavel_tecnico.registro}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <div className="sm:col-span-2">
                    <Info
                      label="Hash SHA-256 (abreviado)"
                      value={<span className="font-mono text-xs break-all">{res.hash_abreviado}…</span>}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-[11px] text-center text-muted-foreground">
          Esta página não expõe o conteúdo do relatório. Solicite o arquivo diretamente à organização
          responsável ou ao HSE Consulting.
        </p>
      </div>
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