import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const [precisaTrocar, setPrecisaTrocar] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setPrecisaTrocar(null); return; }
    supabase.from("profiles").select("senha_provisoria").eq("id", user.id).maybeSingle()
      .then(({ data }) => setPrecisaTrocar(!!(data as any)?.senha_provisoria));
  }, [user?.id]);

  if (loading || (user && precisaTrocar === null)) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  if (precisaTrocar && loc.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }
  return <>{children}</>;
}