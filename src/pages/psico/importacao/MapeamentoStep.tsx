import { useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export function MapeamentoStep(props: {
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