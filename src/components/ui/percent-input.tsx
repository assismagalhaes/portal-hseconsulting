import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  /** Valor armazenado. Quando decimal=true (padrão), 0..1 (ex.: 0.20 = 20%). Quando false, valor inteiro bruto (ex.: 20). */
  value: number | null | undefined;
  onChange: (v: number) => void;
  /** Se true, divide/multiplica por 100 ao ler/escrever (padrão true). */
  decimal?: boolean;
  /** Casas decimais exibidas (padrão 0 — formato inteiro: "20%"). */
  precision?: number;
};

/** Input percentual com sufixo "%". Internamente mantém decimal (0..1) por padrão, exibe inteiro (20). */
export const PercentInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, decimal = true, precision = 0, className, ...rest }, ref) => {
    const toDisplay = React.useCallback(
      (v: number | null | undefined) => {
        if (v == null || isNaN(Number(v))) return "";
        const n = decimal ? Number(v) * 100 : Number(v);
        return precision > 0 ? n.toFixed(precision) : String(Math.round(n * 1e6) / 1e6);
      },
      [decimal, precision],
    );
    const [focused, setFocused] = React.useState(false);
    const [draft, setDraft] = React.useState<string>(toDisplay(value));
    React.useEffect(() => { if (!focused) setDraft(toDisplay(value)); }, [value, focused, toDisplay]);

    const commit = (raw: string) => {
      const s = (raw || "").replace(/%/g, "").replace(",", ".").trim();
      if (!s) { onChange(0); return; }
      const n = Number(s);
      if (!isFinite(n)) { onChange(0); return; }
      onChange(decimal ? n / 100 : n);
    };

    return (
      <div className={cn("relative", className)}>
        <Input
          ref={ref}
          inputMode="decimal"
          className="text-right font-mono pr-8"
          value={focused ? draft : toDisplay(value)}
          onFocus={() => { setFocused(true); setDraft(toDisplay(value)); }}
          onBlur={() => { setFocused(false); commit(draft); }}
          onChange={(e) => setDraft(e.target.value)}
          {...rest}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    );
  },
);
PercentInput.displayName = "PercentInput";