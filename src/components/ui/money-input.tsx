import * as React from "react";
import { Input } from "@/components/ui/input";
import { brl, parseBrl } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: number | null | undefined;
  onChange: (v: number) => void;
  showCurrency?: boolean;
};

/** Input monetário PT-BR: aceita "110", "110,00", "R$ 110,00". */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, showCurrency = true, className, ...rest }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const [draft, setDraft] = React.useState<string>(
      value == null ? "" : value.toString().replace(".", ","),
    );
    React.useEffect(() => {
      if (!focused) {
        setDraft(value == null ? "" : Number(value).toFixed(2).replace(".", ","));
      }
    }, [value, focused]);
    return (
      <Input
        ref={ref}
        inputMode="decimal"
        className={cn("text-right font-mono", className)}
        value={focused ? draft : (value == null ? "" : showCurrency ? brl(value) : Number(value).toFixed(2).replace(".", ","))}
        onFocus={() => { setFocused(true); setDraft(value == null ? "" : Number(value).toFixed(2).replace(".", ",")); }}
        onBlur={() => { setFocused(false); onChange(parseBrl(draft)); }}
        onChange={(e) => setDraft(e.target.value)}
        {...rest}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";