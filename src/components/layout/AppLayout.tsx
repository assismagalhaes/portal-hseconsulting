import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Briefcase, FileText, Settings as Cog, LogOut, HardHat, ClipboardList, CalendarDays, Activity, ListTodo, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/hse-logo-green.png";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/propostas", label: "Propostas", icon: FileText },
  { to: "/execucao", label: "Execução", icon: ClipboardList },
  { to: "/ordens-servico", label: "Ordens de Serviço", icon: ListTodo },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/planejamento", label: "Planejamento", icon: Activity },
  { to: "/meu-painel", label: "Meu Painel", icon: UserCircle },
  { to: "/profissionais", label: "Profissionais", icon: HardHat },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/servicos", label: "Serviços", icon: Briefcase },
  { to: "/configuracoes", label: "Configurações", icon: Cog },
];

export default function AppLayout() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <Link to="/" className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <img src={logo} alt="HSE Consulting" className="h-9 w-auto object-contain" />
          <div className="leading-tight">
            <div className="font-display font-bold">HSE Consulting</div>
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Portal Interno</div>
          </div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`
              }>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 pb-2 text-xs">
            <div className="truncate text-sidebar-foreground">{user?.email}</div>
            <div className="text-sidebar-foreground/60 capitalize">{roles.join(", ") || "sem perfil"}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}