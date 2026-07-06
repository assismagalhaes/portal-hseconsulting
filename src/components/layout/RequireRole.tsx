import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

/**
 * Bloqueia acesso a rotas restritas a Admin (ou Admin + Comercial).
 * Técnico é redirecionado para o Dashboard.
 */
export default function RequireRole({
  children,
  allow = "internal",
}: {
  children: ReactNode;
  allow?: "admin" | "internal";
}) {
  const { loading, isAdmin, isInternal } = useAuth();
  if (loading) return null;
  const ok = allow === "admin" ? isAdmin : isInternal;
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}