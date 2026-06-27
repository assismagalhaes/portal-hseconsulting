import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useClienteAuth } from "@/lib/clienteAuth";

export default function RequireCliente({ children }: { children: ReactNode }) {
  const { user, clienteUser, loading } = useClienteAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!user || !clienteUser) return <Navigate to="/cliente/login" replace />;
  return <>{children}</>;
}