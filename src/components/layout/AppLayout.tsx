import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Briefcase, FileText, Settings as Cog, LogOut, HardHat,
  ClipboardList, CalendarDays, Activity, ListTodo, UserCircle, FileSignature, Target,
  KanbanSquare, PhoneCall, Bell, UserPlus, DollarSign, Receipt, Wallet, Building2,
  Globe, Sparkles, Zap, Briefcase as BriefcaseIcon, Search, Plus, ChevronDown,
  ChevronsLeft, ChevronsRight, Menu, ShieldCheck, BookOpen, FolderOpen, Cpu,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/hse-logo-green.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import GlobalAssistenteIa from "@/components/ia/GlobalAssistenteIa";
import NotificacoesBell from "@/components/NotificacoesBell";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: ComponentType<any>; end?: boolean };
type NavGroup = { id: string; label: string; icon: ComponentType<any>; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    id: "dashboard", label: "Dashboard", icon: LayoutDashboard,
    items: [{ to: "/", label: "Visão Executiva", icon: LayoutDashboard, end: true }],
  },
  {
    id: "comercial", label: "Comercial", icon: Target,
    items: [
      { to: "/crm", label: "CRM", icon: Target, end: true },
      { to: "/propostas", label: "Propostas", icon: FileText },
      { to: "/crm/pipeline", label: "Pipeline", icon: KanbanSquare },
      { to: "/crm/leads", label: "Leads", icon: UserPlus },
      { to: "/crm/oportunidades", label: "Oportunidades", icon: Target },
      { to: "/crm/followups", label: "Follow-ups", icon: PhoneCall },
      { to: "/crm/agenda", label: "Agenda Comercial", icon: CalendarDays },
    ],
  },
  {
    id: "operacoes", label: "Operações", icon: ClipboardList,
    items: [
      { to: "/execucao", label: "Serviços em Execução", icon: ClipboardList },
      { to: "/ordens-servico", label: "Ordens de Serviço", icon: ListTodo },
      { to: "/agenda", label: "Agenda Técnica", icon: CalendarDays },
      { to: "/planejamento", label: "Planejamento", icon: Activity },
    ],
  },
  {
    id: "cadastros", label: "Cadastros", icon: FolderOpen,
    items: [
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/servicos", label: "Serviços", icon: Briefcase },
      { to: "/profissionais", label: "Profissionais", icon: HardHat },
    ],
  },
  {
    id: "documentacao", label: "Documentação", icon: BookOpen,
    items: [
      { to: "/documentos", label: "Documentos Técnicos", icon: FileSignature },
      { to: "/financeiro/contratos", label: "Contratos", icon: FileText },
    ],
  },
  {
    id: "financeiro", label: "Financeiro", icon: DollarSign,
    items: [
      { to: "/financeiro", label: "Financeiro", icon: DollarSign, end: true },
      { to: "/financeiro/contas-receber", label: "Recebimentos", icon: Receipt },
      { to: "/financeiro/custos", label: "Custos", icon: Wallet },
      { to: "/financeiro/centros-custo", label: "Centros de Custo", icon: Building2 },
      { to: "/financeiro/alertas", label: "Alertas Financeiros", icon: Bell },
    ],
  },
  {
    id: "inteligencia", label: "Inteligência", icon: Sparkles,
    items: [
      { to: "/ia", label: "IA HSE", icon: Sparkles, end: true },
      { to: "/ia/chat", label: "Assistente", icon: Sparkles },
      { to: "/ia/alertas", label: "Alertas Inteligentes", icon: Bell },
      { to: "/ia/resumo-dia", label: "Resumo do Dia", icon: Sparkles },
      { to: "/ia/resumo-semanal", label: "Resumo Semanal", icon: Sparkles },
      { to: "/ia/prompts", label: "Prompts", icon: FileText },
      { to: "/automacoes", label: "Automações", icon: Zap },
    ],
  },
  {
    id: "portal", label: "Portal do Cliente", icon: Globe,
    items: [{ to: "/portal-cliente", label: "Portal do Cliente", icon: Globe }],
  },
  {
    id: "sistema", label: "Administração", icon: Cpu,
    items: [
      { to: "/notificacoes", label: "Alertas", icon: Bell },
      { to: "/tarefas", label: "Tarefas", icon: ListTodo },
      { to: "/configuracoes", label: "Configurações", icon: Cog },
      { to: "/meu-painel", label: "Meu Painel", icon: UserCircle },
    ],
  },
];

const COLLAPSED_KEY = "hse.sidebar.collapsed";
const OPEN_GROUP_KEY = "hse.sidebar.openGroup";

function activeGroupForPath(pathname: string): string {
  // pick the group whose item best matches the current pathname
  let best = { id: GROUPS[0].id, score: 0 };
  for (const g of GROUPS) {
    for (const it of g.items) {
      if (it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/")) {
        const score = it.to.length;
        if (score > best.score) best = { id: g.id, score };
      }
    }
  }
  return best.id;
}

function SidebarBody({
  collapsed, openGroup, setOpenGroup, onNavigate,
}: {
  collapsed: boolean;
  openGroup: string;
  setOpenGroup: (id: string) => void;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const isItemActive = (it: NavItem) =>
    it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/");
  const isGroupActive = (g: NavGroup) => g.items.some(isItemActive);

  if (collapsed) {
    return (
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        <TooltipProvider delayDuration={150}>
          {GROUPS.map((g) => {
            const Icon = g.icon;
            const active = isGroupActive(g);
            return (
              <Popover key={g.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "w-full grid place-items-center h-10 rounded-md transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                        aria-label={g.label}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">{g.label}</TooltipContent>
                </Tooltip>
                <PopoverContent side="right" align="start" className="w-60 p-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pb-1">
                    {g.label}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((it) => {
                      const ItIcon = it.icon;
                      return (
                        <NavLink
                          key={it.to}
                          to={it.to}
                          end={it.end}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground font-medium"
                                : "hover:bg-muted",
                            )
                          }
                        >
                          <ItIcon className="h-4 w-4" />
                          {it.label}
                        </NavLink>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </TooltipProvider>
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {GROUPS.map((g) => {
        const Icon = g.icon;
        const active = isGroupActive(g);
        const open = openGroup === g.id;
        // Single direct-link groups (Dashboard / Portal) render flat
        if (g.items.length === 1) {
          const it = g.items[0];
          const ItIcon = it.icon;
          return (
            <NavLink
              key={g.id}
              to={it.to}
              end={it.end}
              onClick={() => { setOpenGroup(g.id); onNavigate?.(); }}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )
              }
            >
              <ItIcon className="h-[18px] w-[18px]" />
              <span className="truncate">{g.label}</span>
            </NavLink>
          );
        }
        return (
          <div key={g.id}>
            <button
              onClick={() => setOpenGroup(open ? "" : g.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
              aria-expanded={open}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate flex-1 text-left font-medium">{g.label}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform text-sidebar-foreground/50",
                  open && "rotate-180",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="ml-3 mt-0.5 mb-1 pl-3 border-l border-sidebar-border/60 space-y-0.5">
                  {g.items.map((it) => {
                    const ItIcon = it.icon;
                    return (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        end={it.end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                          )
                        }
                      >
                        <ItIcon className="h-3.5 w-3.5" />
                        <span className="truncate">{it.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarShell({
  collapsed, openGroup, setOpenGroup, user, roles, onSignOut,
}: any) {
  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out border-r border-sidebar-border",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <Link
        to="/"
        className={cn(
          "flex items-center gap-3 border-b border-sidebar-border",
          collapsed ? "px-3 py-4 justify-center" : "px-5 py-4",
        )}
      >
        <img src={logo} alt="HSE Consulting" className="h-8 w-auto object-contain" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display font-bold text-[15px]">HSE Consulting</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              Portal Interno
            </div>
          </div>
        )}
      </Link>

      <SidebarBody collapsed={collapsed} openGroup={openGroup} setOpenGroup={setOpenGroup} />

      <div className="border-t border-sidebar-border p-2">
        {collapsed ? (
          <Button
            variant="ghost" size="icon"
            className="w-full text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={onSignOut} aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <div className="px-2 pb-2 text-xs">
              <div className="truncate text-sidebar-foreground">{user?.email}</div>
              <div className="text-sidebar-foreground/60 capitalize">
                {roles?.join(", ") || "sem perfil"}
              </div>
            </div>
            <Button
              variant="ghost" size="sm"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}

export default function AppLayout() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const [openGroup, setOpenGroup] = useState<string>(() => {
    if (typeof window === "undefined") return activeGroupForPath("/");
    return localStorage.getItem(OPEN_GROUP_KEY) || activeGroupForPath(window.location.pathname);
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    localStorage.setItem(OPEN_GROUP_KEY, openGroup);
  }, [openGroup]);

  // When route changes, ensure its group is open (without closing manual choices on same group)
  useEffect(() => {
    const grp = activeGroupForPath(pathname);
    setOpenGroup((prev) => (prev === grp ? prev : grp));
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const userInitial = useMemo(
    () => (user?.email?.[0] || "U").toUpperCase(),
    [user?.email],
  );

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarShell
        collapsed={collapsed}
        openGroup={openGroup}
        setOpenGroup={setOpenGroup}
        user={user}
        roles={roles}
        onSignOut={handleSignOut}
      />

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <Link to="/" className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border" onClick={() => setMobileOpen(false)}>
            <img src={logo} alt="HSE Consulting" className="h-8 w-auto object-contain" />
            <div className="leading-tight">
              <div className="font-display font-bold text-[15px]">HSE Consulting</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Portal Interno</div>
            </div>
          </Link>
          <SidebarBody
            collapsed={false}
            openGroup={openGroup}
            setOpenGroup={setOpenGroup}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className="border-t border-sidebar-border p-2">
            <Button variant="ghost" size="sm"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
              onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-3 md:px-4 border-b border-border bg-card/85 backdrop-blur">
          <Button
            variant="ghost" size="icon" className="md:hidden"
            onClick={() => setMobileOpen(true)} aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost" size="icon" className="hidden md:inline-flex"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>

          <div className="relative hidden sm:block w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar propostas, clientes, OS…"
              className="pl-9 h-9 bg-muted/40 border-border/60 focus-visible:ring-1"
            />
          </div>

          <div className="flex-1" />

          <Button
            size="sm"
            className="hidden sm:inline-flex gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            onClick={() => navigate("/propostas")}
          >
            <Plus className="h-4 w-4" /> Nova Proposta
          </Button>

          <NotificacoesBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-9 w-9 rounded-full bg-gradient-accent text-primary-foreground grid place-items-center font-semibold text-sm shadow-sm hover:opacity-90 transition"
                aria-label="Menu do usuário"
              >
                {userInitial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium truncate">{user?.email}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {roles?.join(", ") || "sem perfil"}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/meu-painel")}>
                <UserCircle className="h-4 w-4 mr-2" /> Meu Painel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/notificacoes")}>
                <Bell className="h-4 w-4 mr-2" /> Notificações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
                <Cog className="h-4 w-4 mr-2" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
        <GlobalAssistenteIa />
      </main>
    </div>
  );
}