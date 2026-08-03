import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { consultarCep, formatCep, aplicarDadosCep, type CepLookupData } from "@/lib/cepLookup";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onAutofill: (patch: Record<string, any>, data: CepLookupData) => void;
  formSnapshot?: Record<string, any>;
  label?: string;
  compact?: boolean;
  className?: string;
};

export default function CepLookupField({
  value, onChange, onAutofill, formSnapshot = {}, label = "CEP", compact, className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const digits = (value || "").replace(/\D+/g, "");
  const possible = digits.length === 8;

  async function lookup() {
    if (!possible) {
      toast.error("Informe um CEP com 8 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const r = await consultarCep(digits);
      if (r.status !== "sucesso") {
        const map: Record<string, string> = {
          invalido: "CEP inválido.",
          nao_encontrado: "CEP não encontrado.",
          api_indisponivel: "API de CEP indisponível. Preencha manualmente.",
          erro: "Falha ao consultar CEP.",
        };
        toast.error(map[r.status] || r.message);
        return;
      }
      const patch = aplicarDadosCep(formSnapshot, r.data);
      onAutofill(patch, r.data);
      toast.success("Endereço preenchido pelo CEP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      {label && <Label className={compact ? "text-xs" : ""}>{label}</Label>}
      <div className="flex gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(formatCep(e.target.value))}
          onBlur={() => { if (possible && !formSnapshot?.endereco) lookup(); }}
          placeholder="00000-000"
          inputMode="numeric"
          maxLength={9}
        />
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={!possible || loading}
          onClick={lookup}
          className="shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}