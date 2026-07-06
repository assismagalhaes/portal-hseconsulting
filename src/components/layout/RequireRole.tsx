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
  allow?: "admin" | "internal" | "comercial" | "financeiro" | "operacional";
}) {
  const { loading, isAdmin, isInternal, canSeeComercial, canSeeFinanceiro } = useAuth();
  if (loading) return null;
  let ok = false;
  switch (allow) {
    case "admin":       ok = isAdmin; break;
    case "internal":    ok = isInternal; break;   // admin || comercial
    case "comercial":   ok = canSeeComercial; break;
    case "financeiro":  ok = canSeeFinanceiro; break;
    case "operacional": ok = isInternal || canSeeFinanceiro; break; // qualquer perfil interno
  }
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}