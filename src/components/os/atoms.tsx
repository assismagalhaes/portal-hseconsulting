import { Label } from "@/components/ui/label";

export function KV({ k, v }: { k: string; v: any }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground mb-0.5">{k}</div>
      <div className="text-sm">{v}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <Label className="text-xs uppercase">{label}</Label>
      {children}
    </div>
  );
}