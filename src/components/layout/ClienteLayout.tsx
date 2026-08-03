import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Briefcase, ClipboardList, FileSignature, MessageSquare, UserCircle, LogOut, AlertCircle } from "lucide-react";
import { useClienteAuth } from "@/lib/clienteAuth";
import logo from "@/assets/hse-logo-green.png";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { registrarLogCliente } from "@/lib/cliente";

const nav = [
  { to: "/cliente/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cliente/propostas", label: "Propostas", icon: FileText },
  { to: "/cliente/servicos", label: "Serviços", icon: Briefcase },
  { to: "/cliente/documentos", label: "Documentos", icon: FileSignature },
  { to: "/cliente/pendencias", label: "Pendências", icon: AlertCircle },
  { to: "/cliente/comunicacoes", label: "Comunicações", icon: MessageSquare },
  { to: "/cliente/perfil", label: "Perfil", icon: UserCircle },
];

export default function ClienteLayout() {
  const { clienteUser, signOut } = useClienteAuth();
  const navigate = useNavigate();
  useEffect(() => { registrarLogCliente("portal_aberto"); }, []);
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <Link to="/cliente/dashboard" className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <img src={logo} alt="HSE" className="h-9 w-auto object-contain" />
          <div className="leading-tight">
            <div className="font-display font-bold">HSE Consulting</div>
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Portal do Cliente</div>
          </div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/cliente/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 pb-2 text-xs">
            <div className="truncate text-sidebar-foreground">{clienteUser?.nome}</div>
            <div className="text-sidebar-foreground/60 truncate">{clienteUser?.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={async () => { await registrarLogCliente("logout"); await signOut(); navigate("/cliente/login"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0"><Outlet /></main>
    </div>
  );
}