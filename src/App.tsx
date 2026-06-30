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
import Dashboard from "./pages/Dashboard";
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
import OrdensServico from "./pages/OrdensServico";
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
import ClienteOS from "./pages/cliente/ClienteOS";
import ClienteDocumentos from "./pages/cliente/ClienteDocumentos";
import ClientePendencias from "./pages/cliente/ClientePendencias";
import ClienteComunicacoes from "./pages/cliente/ClienteComunicacoes";
import ClientePerfil from "./pages/cliente/ClientePerfil";
import NotFound from "./pages/NotFound.tsx";

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
            <Route path="/proposta-exemplo" element={<ProposalExample />} />
            <Route path="/cliente/login" element={<ClienteLogin />} />
            <Route element={<RequireCliente><ClienteLayout /></RequireCliente>}>
              <Route path="/cliente" element={<ClienteDashboard />} />
              <Route path="/cliente/dashboard" element={<ClienteDashboard />} />
              <Route path="/cliente/propostas" element={<ClientePropostas />} />
              <Route path="/cliente/servicos" element={<ClienteServicos />} />
              <Route path="/cliente/ordens-servico" element={<ClienteOS />} />
              <Route path="/cliente/documentos" element={<ClienteDocumentos />} />
              <Route path="/cliente/pendencias" element={<ClientePendencias />} />
              <Route path="/cliente/comunicacoes" element={<ClienteComunicacoes />} />
              <Route path="/cliente/perfil" element={<ClientePerfil />} />
            </Route>
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/servicos" element={<Services />} />
              <Route path="/propostas" element={<Proposals />} />
              <Route path="/propostas/:id" element={<ProposalEditor />} />
              <Route path="/execucao" element={<Execucao />} />
              <Route path="/execucao/:id" element={<ExecucaoEditor />} />
              <Route path="/projetos" element={<Projetos />} />
              <Route path="/projetos/:id" element={<ProjetoEditor />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/ordens-servico/:id" element={<OrdemServicoEditor />} />
              <Route path="/ordens-servico/:id/imprimir" element={<OrdemServicoPrint />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/planejamento" element={<Planejamento />} />
              <Route path="/meu-painel" element={<MeuPainel />} />
              <Route path="/profissionais" element={<Profissionais />} />
              <Route path="/documentos" element={<Documentos />} />
              <Route path="/documentos/modelos" element={<DocumentosModelos />} />
              <Route path="/documentos/recebidos" element={<DocumentosRecebidos />} />
              <Route path="/documentos/pendentes" element={<DocumentosPendentes />} />
              <Route path="/documentos/:id" element={<DocumentoEditor />} />
              <Route path="/documentos/:id/pdf" element={<DocumentoPDF />} />
              <Route path="/crm" element={<CrmDashboard />} />
              <Route path="/crm/leads" element={<CrmLeads />} />
              <Route path="/crm/oportunidades" element={<CrmOportunidades />} />
              <Route path="/crm/pipeline" element={<CrmPipeline />} />
              <Route path="/crm/followups" element={<CrmFollowups />} />
              <Route path="/crm/agenda" element={<CrmAgenda />} />
              <Route path="/crm/alertas" element={<CrmAlertas />} />
              <Route path="/financeiro" element={<FinanceiroDashboard />} />
              <Route path="/financeiro/contratos" element={<FinContratos />} />
              <Route path="/financeiro/contratos/:id" element={<FinContratoEditor />} />
              <Route path="/financeiro/contas-receber" element={<FinContasReceber />} />
              <Route path="/financeiro/custos" element={<FinCustos />} />
              <Route path="/financeiro/alertas" element={<FinAlertas />} />
              <Route path="/financeiro/centros-custo" element={<FinCentrosCusto />} />
              <Route path="/portal-cliente" element={<PortalClienteConfig />} />
              <Route path="/ia" element={<IaHub />} />
              <Route path="/ia/chat" element={<IaChatPage />} />
              <Route path="/ia/alertas" element={<IaAlertas />} />
              <Route path="/ia/prompts" element={<IaPrompts />} />
              <Route path="/ia/interacoes" element={<IaInteracoes />} />
              <Route path="/ia/resumo-dia" element={<IaResumoDia />} />
              <Route path="/ia/resumo-semanal" element={<IaResumoSemanal />} />
              <Route path="/automacoes" element={<Automacoes />} />
              <Route path="/automacoes/dashboard" element={<AutomacoesDashboard />} />
              <Route path="/automacoes/execucoes" element={<AutomacoesExecucoes />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/tarefas" element={<Tarefas />} />
              <Route path="/configuracoes" element={<Settings />} />
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
