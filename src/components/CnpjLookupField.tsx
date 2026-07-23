import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  consultarCnpj, formatCnpj, onlyDigits, aplicarDadosCnpj,
  buscarClienteExistentePorCnpj, hasConflict, isSituacaoAtiva, isCaepf, type CnpjLookupData,
} from "@/lib/cnpjLookup";

type Props = {
  /** Valor atual do CNPJ (formatado ou não). */
  value: string;
  /** Notifica mudança do campo CNPJ (sempre devolve formatado). */
  onChange: (v: string) => void;
  /** Recebe um patch a aplicar no formulário do cliente após consulta bem-sucedida. */
  onAutofill: (patch: Record<string, any>, data: CnpjLookupData) => void;
  /** Snapshot atual do form para detectar conflito de campos preenchidos. */
  formSnapshot?: Record<string, any>;
  /** Quando true, ao encontrar cliente existente, avisa e permite usar o cadastro. */
  onExistingClient?: (existing: any) => void;
  /** Texto auxiliar de "última consulta", se houver. */
  ultimaConsulta?: string | null;
  /** Marca se o campo é obrigatório. */
  required?: boolean;
  /** ID do cliente atual — ignorado na checagem de duplicidade (permite re-consultar o próprio cadastro). */
  ignoreClientId?: string | null;
  /** Label customizada. */
  label?: string;
  /** Classe adicional. */
  className?: string;
  /** Tamanho compacto (usado dentro de cards). */
  compact?: boolean;
};

export default function CnpjLookupField({
  value, onChange, onAutofill, formSnapshot = {}, onExistingClient,
  ultimaConsulta, required, label = "CNPJ", className, compact, ignoreClientId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<CnpjLookupData | null>(null);
  const [existing, setExisting] = useState<any | null>(null);

  const digits = onlyDigits(value);
  const isPossible = digits.length === 14;
  const caepf = isPossible && isCaepf(digits);

  async function handleLookup() {
    if (!isPossible) {
      toast.error("Informe um CNPJ com 14 dígitos para buscar.");
      return;
    }
    if (caepf) {
      toast.info(
        "CAEPF detectado (Pessoa Física). Não existe base pública gratuita para consulta automática — preencha os dados manualmente.",
        { duration: 7000 }
      );
      return;
    }
    setLoading(true);
    try {
      // 1) Verifica duplicidade
      const existente = await buscarClienteExistentePorCnpj(digits);
      if (existente && onExistingClient && existente.id !== ignoreClientId) {
        setExisting(existente);
        setLoading(false);
        return;
      }

      // 2) Consulta API
      const r = await consultarCnpj(digits);
      if (r.status !== "sucesso") {
        const map: Record<string, string> = {
          invalido: "CNPJ inválido. Confira os dígitos.",
          nao_encontrado: "Empresa não encontrada na base pública.",
          api_indisponivel: "API pública indisponível no momento. Você pode continuar manualmente.",
          erro: "Falha ao consultar CNPJ.",
        };
        toast.error(map[r.status] || r.message);
        return;
      }

      // 3) Verifica conflito de campos preenchidos
      if (hasConflict(formSnapshot, r.data)) {
        setPending(r.data);
        if (!isSituacaoAtiva(r.data.situacao_cadastral)) {
          toast.warning(
            `Atenção: CNPJ consta como "${r.data.situacao_cadastral}" na base pública. Verifique antes de emitir a proposta.`,
            { duration: 8000 }
          );
        }
        return;
      }

      // 4) Aplica
      const patch = aplicarDadosCnpj(formSnapshot, r.data);
      onAutofill(patch, r.data);
      toast.success("Dados encontrados e preenchidos.");
      if (!isSituacaoAtiva(r.data.situacao_cadastral)) {
        toast.warning(
          `Atenção: CNPJ consta como "${r.data.situacao_cadastral}" na base pública. Verifique antes de emitir a proposta.`,
          { duration: 8000 }
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function applyPending(overwrite: boolean) {
    if (!pending) return;
    const patch = aplicarDadosCnpj(formSnapshot, pending, { overwriteFilled: overwrite });
    onAutofill(patch, pending);
    setPending(null);
    toast.success(overwrite ? "Dados substituídos pelos da Receita." : "Apenas campos vazios foram preenchidos.");
  }

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      {label && (
        <Label className={compact ? "text-xs" : ""}>
          {label}{required && <span className="text-danger"> *</span>}
        </Label>
      )}
      <div className="flex gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(formatCnpj(e.target.value))}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          maxLength={18}
          required={required}
        />
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={!isPossible || loading || caepf}
          onClick={handleLookup}
          className="shrink-0"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Buscando…</>
            : <><Search className="h-4 w-4 mr-1" /> Buscar dados</>}
        </Button>
      </div>
      {caepf && (
        <p className="text-[11px] text-warning flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            <strong>CAEPF (Pessoa Física)</strong> — cadastro de atividade econômica vinculado ao CPF do titular.
            Sem base pública gratuita para consulta; preencha razão social (nome do titular), endereço e demais dados manualmente.
          </span>
        </p>
      )}
      {ultimaConsulta && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Dados consultados via API pública de CNPJ em {new Date(ultimaConsulta).toLocaleString("pt-BR")}.
        </p>
      )}

      {/* Conflito: dialog de sobrescrever */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Alguns campos já estão preenchidos
            </AlertDialogTitle>
            <AlertDialogDescription>
              A consulta encontrou dados diferentes do que está hoje no cadastro.
              Deseja substituir os valores atuais pelos retornados pela base pública,
              ou preencher somente os campos ainda vazios?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => applyPending(false)}>Só preencher vazios</Button>
            <AlertDialogAction onClick={() => applyPending(true)}>Substituir tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicidade: cliente já existe */}
      <AlertDialog open={!!existing} onOpenChange={(o) => !o && setExisting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Cliente já cadastrado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um cliente com este CNPJ:{" "}
              <strong>{existing?.razao_social || existing?.nome_fantasia}</strong>.
              Deseja utilizar o cadastro existente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onExistingClient?.(existing);
              setExisting(null);
            }}>Utilizar este cliente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}