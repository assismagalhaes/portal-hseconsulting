import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea que cresce automaticamente conforme o conteúdo. Usada em
 * campos de descrição em precificações para não esconder textos longos.
 */
export const AutoGrowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, value, onChange, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useEffect(() => { resize(); }, [value, resize]);
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    // resize inicial após mount / mudança de layout
    const raf = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(raf);
  }, [resize]);

  return (
    <textarea
      ref={innerRef}
      rows={1}
      value={value}
      onChange={(e) => { onChange?.(e); resize(); }}
      onInput={resize}
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden leading-snug",
        className
      )}
      {...props}
    />
  );
});
AutoGrowTextarea.displayName = "AutoGrowTextarea";