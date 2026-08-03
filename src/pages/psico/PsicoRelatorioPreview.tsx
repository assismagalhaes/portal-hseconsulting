import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Download, FileText, Loader2, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { previewRelatorio, traduzirErroEmissao } from "@/lib/psicoRelatorio";

export default function PsicoRelatorioPreview() {
  const { id } = useParams();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const backUrl = useMemo(
    () => `/operacoes/avaliacao-fatores-psicossociais/avaliacoes/${id ?? ""}`,
    [id]
  );

  async function loadPreview() {
    if (!id) {
      setError("Avaliação não informada.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    const { blob, error: previewError } = await previewRelatorio(id);
    if (previewError || !blob) {
      const message = previewError instanceof Error ? previewError.message : "ERRO_RENDERIZACAO";
      setError(traduzirErroEmissao(message));
      setLoading(false);
      return;
    }

    setPdfUrl(URL.createObjectURL(blob));
    setLoading(false);
  }

  useEffect(() => {
    document.title = "Prévia do Relatório | Portal HSE";
    loadPreview();

    return () => {
      setPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to={backUrl}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate text-base font-semibold">
                <FileText className="h-4 w-4 shrink-0" />
                Prévia do relatório psicossocial
              </h1>
              <p className="text-xs text-muted-foreground">Prévia sem validade documental</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadPreview} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Recarregar
            </Button>
            {pdfUrl && (
              <Button asChild size="sm">
                <a href={pdfUrl} download="previa-relatorio-psicossocial.pdf">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PDF
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-4">
        {loading && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-md border bg-card text-card-foreground">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Gerando prévia do PDF…</p>
            <p className="mt-1 text-xs text-muted-foreground">Aguarde, relatórios maiores podem levar alguns segundos.</p>
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível carregar a prévia</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && pdfUrl && (
          <div className="h-[calc(100vh-104px)] overflow-hidden rounded-md border bg-muted">
            <object data={pdfUrl} type="application/pdf" className="h-full w-full">
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">Seu navegador não exibiu o PDF embutido.</p>
                <Button asChild>
                  <a href={pdfUrl} download="previa-relatorio-psicossocial.pdf">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar PDF
                  </a>
                </Button>
              </div>
            </object>
          </div>
        )}
      </section>
    </main>
  );
}