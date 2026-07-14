import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ClienteAuthProvider } from "@/lib/clienteAuth";
import AppLayout from "./components/layout/AppLayout";
import RequireAuth from "./components/layout/RequireAuth";
import ClienteLayout from "./components/layout/ClienteLayout";
import RequireCliente from "./components/layout/RequireCliente";
import Auth from "./pages/Auth";
import TrocarSenha from "./pages/TrocarSenha";
import Unsubscribe from "./pages/Unsubscribe";
import Dashboard from "./pages/Dashboard";
import DashboardTecnico from "./pages/DashboardTecnico";
import Usuarios from "./pages/Usuarios";
import UsuariosLogs from "./pages/UsuariosLogs";
import MeuPerfil from "./pages/MeuPerfil";
import Clients from "./pages/Clients";
import Services from "./pages/Services";
import Proposals from "./pages/Proposals";
import ProposalEditor from "./pages/ProposalEditor";
import Execucao from "./pages/Execucao";
import ExecucaoEditor from "./pages/ExecucaoEditor";
import Projetos from "./pages/Projetos";
import ProjetoEditor from "./pages/ProjetoEditor";
import Profissionais from "./pages/Profissionais";
import Settings from "./pages/Settings";
import ProposalExample from "./pages/ProposalExample";
import PropostaAceitePublica from "./pages/PropostaAceitePublica";
import OrdemServicoEditor from "./pages/OrdemServicoEditor";
import OrdemServicoPrint from "./pages/OrdemServicoPrint";
import Agenda from "./pages/Agenda";
import Planejamento from "./pages/Planejamento";
import MeuPainel from "./pages/MeuPainel";
import Documentos from "./pages/Documentos";
import DocumentoEditor from "./pages/DocumentoEditor";
import DocumentoPDF from "./pages/DocumentoPDF";
import DocumentosModelos from "./pages/DocumentosModelos";
import DocumentosRecebidos from "./pages/DocumentosRecebidos";
import DocumentosPendentes from "./pages/DocumentosPendentes";
import CrmDashboard from "./pages/crm/CrmDashboard";
import CrmLeads from "./pages/crm/CrmLeads";
import CrmOportunidades from "./pages/crm/CrmOportunidades";
import CrmPipeline from "./pages/crm/CrmPipeline";
import CrmFollowups from "./pages/crm/CrmFollowups";
import CrmAgenda from "./pages/crm/CrmAgenda";
import CrmAlertas from "./pages/crm/CrmAlertas";
import FinanceiroDashboard from "./pages/financeiro/FinanceiroDashboard";
import FinContratos from "./pages/financeiro/Contratos";
import FinContratoEditor from "./pages/financeiro/ContratoEditor";
import FinContasReceber from "./pages/financeiro/ContasReceber";
import FinCustos from "./pages/financeiro/Custos";
import FinAlertas from "./pages/financeiro/Alertas";
import FinCentrosCusto from "./pages/financeiro/CentrosCusto";
import PortalClienteConfig from "./pages/PortalClienteConfig";
import IaHub from "./pages/ia/IaHub";
import IaChatPage from "./pages/ia/IaChatPage";
import IaAlertas from "./pages/ia/IaAlertas";
import IaPrompts from "./pages/ia/IaPrompts";
import IaInteracoes from "./pages/ia/IaInteracoes";
import IaResumoDia from "./pages/ia/IaResumoDia";
import IaResumoSemanal from "./pages/ia/IaResumoSemanal";
import Automacoes from "./pages/automacoes/Automacoes";
import AutomacoesDashboard from "./pages/automacoes/AutomacoesDashboard";
import AutomacoesExecucoes from "./pages/automacoes/AutomacoesExecucoes";
import Notificacoes from "./pages/Notificacoes";
import Tarefas from "./pages/Tarefas";
import ClienteLogin from "./pages/cliente/ClienteLogin";
import ClienteDashboard from "./pages/cliente/ClienteDashboard";
import ClientePropostas from "./pages/cliente/ClientePropostas";
import ClienteServicos from "./pages/cliente/ClienteServicos";
import ClienteDocumentos from "./pages/cliente/ClienteDocumentos";
import ClientePendencias from "./pages/cliente/ClientePendencias";
import ClienteComunicacoes from "./pages/cliente/ClienteComunicacoes";
import ClientePerfil from "./pages/cliente/ClientePerfil";
import NotFound from "./pages/NotFound.tsx";
import RequireRole from "./components/layout/RequireRole";
import { useAuth } from "@/lib/auth";

function DashboardSwitch() {
  const { isTecnico } = useAuth();
  return isTecnico ? <DashboardTecnico /> : <Dashboard />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClienteAuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/trocar-senha" element={<TrocarSenha />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/proposta-exemplo" element={<ProposalExample />} />
            <Route path="/aceite/:token" element={<PropostaAceitePublica />} />
            <Route path="/cliente/login" element={<ClienteLogin />} />
            <Route element={<RequireCliente><ClienteLayout /></RequireCliente>}>
              <Route path="/cliente" element={<ClienteDashboard />} />
              <Route path="/cliente/dashboard" element={<ClienteDashboard />} />
              <Route path="/cliente/propostas" element={<ClientePropostas />} />
              <Route path="/cliente/servicos" element={<ClienteServicos />} />
              <Route path="/cliente/documentos" element={<ClienteDocumentos />} />
              <Route path="/cliente/pendencias" element={<ClientePendencias />} />
              <Route path="/cliente/comunicacoes" element={<ClienteComunicacoes />} />
              <Route path="/cliente/perfil" element={<ClientePerfil />} />
            </Route>
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/" element={<DashboardSwitch />} />
              <Route path="/meu-perfil" element={<MeuPerfil />} />
              <Route path="/usuarios" element={<RequireRole allow="admin"><Usuarios /></RequireRole>} />
              <Route path="/usuarios/logs" element={<RequireRole allow="admin"><UsuariosLogs /></RequireRole>} />
              <Route path="/clientes" element={<RequireRole><Clients /></RequireRole>} />
              <Route path="/servicos" element={<RequireRole><Services /></RequireRole>} />
              <Route path="/propostas" element={<RequireRole><Proposals /></RequireRole>} />
              <Route path="/propostas/:id" element={<RequireRole><ProposalEditor /></RequireRole>} />
              <Route path="/execucao" element={<RequireRole><Execucao /></RequireRole>} />
              <Route path="/execucao/:id" element={<RequireRole><ExecucaoEditor /></RequireRole>} />
              <Route path="/projetos" element={<Projetos />} />
              <Route path="/projetos/:id" element={<ProjetoEditor />} />
              <Route path="/ordens-servico/:id" element={<RequireRole allow="operacional_tecnico"><OrdemServicoEditor /></RequireRole>} />
              <Route path="/ordens-servico/:id/imprimir" element={<RequireRole allow="operacional_tecnico"><OrdemServicoPrint /></RequireRole>} />
              <Route path="/agenda" element={<RequireRole allow="operacional_tecnico"><Agenda /></RequireRole>} />
              <Route path="/planejamento" element={<RequireRole><Planejamento /></RequireRole>} />
              <Route path="/meu-painel" element={<RequireRole allow="operacional_tecnico"><MeuPainel /></RequireRole>} />
              <Route path="/profissionais" element={<RequireRole allow="admin"><Profissionais /></RequireRole>} />
              <Route path="/documentos" element={<RequireRole><Documentos /></RequireRole>} />
              <Route path="/documentos/modelos" element={<RequireRole><DocumentosModelos /></RequireRole>} />
              <Route path="/documentos/recebidos" element={<RequireRole><DocumentosRecebidos /></RequireRole>} />
              <Route path="/documentos/pendentes" element={<RequireRole><DocumentosPendentes /></RequireRole>} />
              <Route path="/documentos/:id" element={<RequireRole><DocumentoEditor /></RequireRole>} />
              <Route path="/documentos/:id/pdf" element={<RequireRole><DocumentoPDF /></RequireRole>} />
              <Route path="/crm" element={<RequireRole><CrmDashboard /></RequireRole>} />
              <Route path="/crm/leads" element={<RequireRole><CrmLeads /></RequireRole>} />
              <Route path="/crm/oportunidades" element={<RequireRole><CrmOportunidades /></RequireRole>} />
              <Route path="/crm/pipeline" element={<RequireRole><CrmPipeline /></RequireRole>} />
              <Route path="/crm/followups" element={<RequireRole><CrmFollowups /></RequireRole>} />
              <Route path="/crm/agenda" element={<RequireRole><CrmAgenda /></RequireRole>} />
              <Route path="/crm/alertas" element={<RequireRole><CrmAlertas /></RequireRole>} />
              <Route path="/financeiro" element={<RequireRole allow="financeiro"><FinanceiroDashboard /></RequireRole>} />
              <Route path="/financeiro/contratos" element={<RequireRole allow="financeiro"><FinContratos /></RequireRole>} />
              <Route path="/financeiro/contratos/:id" element={<RequireRole allow="financeiro"><FinContratoEditor /></RequireRole>} />
              <Route path="/financeiro/contas-receber" element={<RequireRole allow="financeiro"><FinContasReceber /></RequireRole>} />
              <Route path="/financeiro/custos" element={<RequireRole allow="financeiro"><FinCustos /></RequireRole>} />
              <Route path="/financeiro/alertas" element={<RequireRole allow="financeiro"><FinAlertas /></RequireRole>} />
              <Route path="/financeiro/centros-custo" element={<RequireRole allow="financeiro"><FinCentrosCusto /></RequireRole>} />
              <Route path="/portal-cliente" element={<RequireRole><PortalClienteConfig /></RequireRole>} />
              <Route path="/ia" element={<RequireRole><IaHub /></RequireRole>} />
              <Route path="/ia/chat" element={<RequireRole><IaChatPage /></RequireRole>} />
              <Route path="/ia/alertas" element={<RequireRole><IaAlertas /></RequireRole>} />
              <Route path="/ia/prompts" element={<RequireRole><IaPrompts /></RequireRole>} />
              <Route path="/ia/interacoes" element={<RequireRole><IaInteracoes /></RequireRole>} />
              <Route path="/ia/resumo-dia" element={<RequireRole><IaResumoDia /></RequireRole>} />
              <Route path="/ia/resumo-semanal" element={<RequireRole><IaResumoSemanal /></RequireRole>} />
              <Route path="/automacoes" element={<RequireRole><Automacoes /></RequireRole>} />
              <Route path="/automacoes/dashboard" element={<RequireRole><AutomacoesDashboard /></RequireRole>} />
              <Route path="/automacoes/execucoes" element={<RequireRole><AutomacoesExecucoes /></RequireRole>} />
              <Route path="/notificacoes" element={<RequireRole><Notificacoes /></RequireRole>} />
              <Route path="/tarefas" element={<RequireRole><Tarefas /></RequireRole>} />
              <Route path="/configuracoes" element={<RequireRole allow="admin"><Settings /></RequireRole>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ClienteAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
