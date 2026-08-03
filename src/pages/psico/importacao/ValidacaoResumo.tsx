import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard, type ValidarResp } from "./shared";

export function ValidacaoResumo({
  validarResp, errosDetalhados, confirmNome, setConfirmNome, confirmFuncao, setConfirmFuncao,
}: {
  validarResp: ValidarResp;
  errosDetalhados: any[];
  confirmNome: boolean; setConfirmNome: (v: boolean) => void;
  confirmFuncao: boolean; setConfirmFuncao: (v: boolean) => void;
}) {
  return (
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
        {validarResp.resumo.layout && (
          <div className="border rounded-md p-4 bg-muted/40 space-y-2">
            <div className="text-sm font-medium">Layout detectado</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Layout:</span> <span className="font-mono">{validarResp.resumo.layout}</span></div>
              <div><span className="text-muted-foreground">Identificador:</span> {validarResp.resumo.coluna_identificador || "—"} ({validarResp.resumo.tipo_identificador})</div>
              <div><span className="text-muted-foreground">Nome encontrado:</span> {validarResp.resumo.nome_presente ? "Sim" : "Não"}</div>
              <div><span className="text-muted-foreground">Função encontrada:</span> {validarResp.resumo.funcao_presente ? "Sim" : "Não"}</div>
              <div><span className="text-muted-foreground">Perguntas:</span> {validarResp.resumo.perguntas_mapeadas}/35</div>
              <div><span className="text-muted-foreground">Período detectado:</span> {validarResp.resumo.data_resposta_minima && validarResp.resumo.data_resposta_maxima ? `${validarResp.resumo.data_resposta_minima} → ${validarResp.resumo.data_resposta_maxima}` : "Não detectado"}</div>
              <div><span className="text-muted-foreground">Segmentação por função:</span> {validarResp.resumo.segmentacao_funcao_disponivel ? "Disponível (≥3)" : "Indisponível"}</div>
              <div><span className="text-muted-foreground">Delimitador:</span> {validarResp.resumo.delimitador || "—"}</div>
              <div><span className="text-muted-foreground">Codificação:</span> {validarResp.resumo.codificacao}{validarResp.resumo.codificacao_corrigida ? " (corrigida)" : ""}</div>
            </div>
            {validarResp.resumo.nome_presente && (
              <label className="flex items-start gap-2 text-xs mt-2">
                <input type="checkbox" className="mt-1" checked={confirmNome} onChange={e => setConfirmNome(e.target.checked)} />
                <span>Confirmo que os nomes serão utilizados somente durante a validação do arquivo e serão <b>descartados antes da gravação</b> das respostas.</span>
              </label>
            )}
            {validarResp.resumo.funcao_presente && (
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-1" checked={confirmFuncao} onChange={e => setConfirmFuncao(e.target.checked)} />
                <span>Confirmo que a função será mantida <b>exclusivamente para análise coletiva</b>, respeitando o mínimo metodológico de 3 respondentes por grupo.</span>
              </label>
            )}
            {Array.isArray(validarResp.resumo.previa) && validarResp.resumo.previa.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">Prévia (nomes mascarados, primeiras 20 linhas)</summary>
                <div className="max-h-40 overflow-auto mt-2 text-xs font-mono">
                  {validarResp.resumo.previa.map((p: any, i: number) => (
                    <div key={i}>#{p.linha} · id {p.identificador_mascarado || "—"}{p.nome_mascarado ? ` · ${p.nome_mascarado}` : ""}{p.funcao ? ` · ${p.funcao}` : ""}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
