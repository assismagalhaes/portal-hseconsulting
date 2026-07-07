import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Cancelar inscrição | Portal HSE Consulting";
    if (!token) { setState("invalid"); return; }
    fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: SUPABASE_KEY },
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.valid) setState("valid");
        else if (j?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) setState("success");
      else if (j?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">Cancelar inscrição</h1>
        {state === "loading" && (
          <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}
        {state === "valid" && (
          <>
            <p className="text-muted-foreground text-sm">
              Confirme abaixo para não receber mais e-mails do Portal HSE Consulting neste endereço.
            </p>
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar cancelamento
            </Button>
          </>
        )}
        {state === "success" && (
          <p className="text-success text-sm">Inscrição cancelada com sucesso. Você não receberá mais e-mails deste endereço.</p>
        )}
        {state === "already" && (
          <p className="text-muted-foreground text-sm">Este endereço já havia sido descadastrado anteriormente.</p>
        )}
        {state === "invalid" && (
          <p className="text-danger text-sm">Link inválido ou expirado.</p>
        )}
        {state === "error" && (
          <p className="text-danger text-sm">Não foi possível processar sua solicitação. Tente novamente mais tarde.</p>
        )}
      </div>
    </div>
  );
}