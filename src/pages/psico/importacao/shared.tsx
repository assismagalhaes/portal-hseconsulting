import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const BASE = "/operacoes/avaliacao-fatores-psicossociais";

export type Cliente = { id: string; razao_social: string; nome_fantasia: string | null };
export type Questionario = {
  id: string; codigo: string; nome: string; versao: string;
  vigente: boolean; metodologia_versao_id: string;
};
export type UploadResp = {
  importacao_id: string; formato: "csv" | "xlsx";
  hash_sha256: string; tamanho_bytes: number;
  cabecalhos: string[]; amostra: string[][];
};
export type ValidarResp = { ok: true; resumo: any; erros_registrados: number };

// Chamada às Edge Functions usando o cliente Supabase (sem URL hardcoded).
export async function callFn(
  name: string,
  init: { method?: string; body?: BodyInit; headers?: Record<string, string> },
) {
  const body = init.body as any;
  const { data, error } = await supabase.functions.invoke(name, {
    method: (init.method as any) || "POST",
    body,
    headers: init.headers,
  });
  if (error) {
    let parsed: any = null;
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") parsed = await ctx.json();
    } catch { /* ignore */ }
    return {
      ok: false,
      json: async () => parsed || { error: error.message, detalhe: error.message },
    };
  }
  return { ok: true, json: async () => data };
}

export function StepIndicator({ step }: { step: number }) {
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

export function MetricCard({ label, value, good, bad, warn }: { label: string; value: number | string; good?: boolean; bad?: boolean; warn?: boolean }) {
  const cls = good ? "text-green-700" : bad ? "text-destructive" : warn ? "text-amber-700" : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

export function PrivacyAlert() {
  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Privacidade e rigor metodológico</AlertTitle>
      <AlertDescription className="text-sm space-y-1">
        <div>• Nomes, e-mails e telefones do arquivo <b>nunca serão persistidos</b>. Só metadados anonimizados (função, setor, unidade) e as respostas.</div>
        <div>• Convites artificiais <b>não</b> serão criados. Respostas ficam marcadas com sua origem (<code>importacao_bruta</code>).</div>
        <div>• No modo agregado, <b>nenhuma resposta individual sintética</b> é criada — apenas contagens por pergunta.</div>
        <div>• O arquivo original permanece em bucket privado apenas até a conclusão desta importação — depois é removido.</div>
      </AlertDescription>
    </Alert>
  );
}