import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import AppLayout from "./components/layout/AppLayout";
import RequireAuth from "./components/layout/RequireAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Services from "./pages/Services";
import Proposals from "./pages/Proposals";
import ProposalEditor from "./pages/ProposalEditor";
import Execucao from "./pages/Execucao";
import ExecucaoEditor from "./pages/ExecucaoEditor";
import Profissionais from "./pages/Profissionais";
import Settings from "./pages/Settings";
import ProposalExample from "./pages/ProposalExample";
import OrdensServico from "./pages/OrdensServico";
import OrdemServicoEditor from "./pages/OrdemServicoEditor";
import OrdemServicoPrint from "./pages/OrdemServicoPrint";
import Agenda from "./pages/Agenda";
import Planejamento from "./pages/Planejamento";
import MeuPainel from "./pages/MeuPainel";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/proposta-exemplo" element={<ProposalExample />} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/servicos" element={<Services />} />
              <Route path="/propostas" element={<Proposals />} />
              <Route path="/propostas/:id" element={<ProposalEditor />} />
              <Route path="/execucao" element={<Execucao />} />
              <Route path="/execucao/:id" element={<ExecucaoEditor />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/ordens-servico/:id" element={<OrdemServicoEditor />} />
              <Route path="/ordens-servico/:id/imprimir" element={<OrdemServicoPrint />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/planejamento" element={<Planejamento />} />
              <Route path="/meu-painel" element={<MeuPainel />} />
              <Route path="/profissionais" element={<Profissionais />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
