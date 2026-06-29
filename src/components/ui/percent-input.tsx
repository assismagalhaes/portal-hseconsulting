import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  /** Valor armazenado. Quando decimal=true (padrão), 0..1 (ex.: 0.20 = 20%). Quando false, valor inteiro bruto (ex.: 20). */
  value: number | null | undefined;
  onChange: (v: number) => void;
  /** Se true, divide/multiplica por 100 ao ler/escrever (padrão true). */
  decimal?: boolean;
  /** Casas decimais exibidas (padrão 1 — ex.: "20,0%" / "60,1%"). */
  precision?: number;
  /** Incremento das setinhas (padrão 0.1 na escala exibida — ex.: 0,1%). */
  step?: number;
};

/** Input percentual com sufixo "%". Internamente mantém decimal (0..1) por padrão, exibe inteiro (20). */
export const PercentInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, decimal = true, precision = 1, step = 0.1, className, ...rest }, ref) => {
    const toDisplay = React.useCallback(
      (v: number | null | undefined) => {
        if (v == null || isNaN(Number(v))) return "";
        const n = decimal ? Number(v) * 100 : Number(v);
        return precision > 0
          ? n.toFixed(precision).replace(".", ",")
          : String(Math.round(n * 1e6) / 1e6);
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

    const bump = (dir: 1 | -1) => {
      const current = Number(value ?? 0);
      const displayed = decimal ? current * 100 : current;
      const next = Math.max(0, +(displayed + dir * step).toFixed(6));
      const rounded = precision > 0 ? +next.toFixed(precision) : next;
      onChange(decimal ? rounded / 100 : rounded);
    };

    return (
      <div className={cn("relative", className)}>
        <Input
          ref={ref}
          inputMode="decimal"
          className="text-right font-mono pr-12"
          value={focused ? draft : toDisplay(value)}
          onFocus={() => { setFocused(true); setDraft(toDisplay(value)); }}
          onBlur={() => { setFocused(false); commit(draft); }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); bump(1); }
            else if (e.key === "ArrowDown") { e.preventDefault(); bump(-1); }
          }}
          {...rest}
        />
        <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Aumentar"
            onClick={() => bump(1)}
            className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground leading-none"
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M4 0L8 6H0L4 0Z" fill="currentColor"/></svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Diminuir"
            onClick={() => bump(-1)}
            className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground leading-none"
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M4 6L0 0H8L4 6Z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    );
  },
);
PercentInput.displayName = "PercentInput";