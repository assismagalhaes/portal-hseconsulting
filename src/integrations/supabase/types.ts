export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approved_services: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          prazo_previsto: string | null
          proposal_id: string
          proposal_item_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["exec_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          prazo_previsto?: string | null
          proposal_id: string
          proposal_item_id: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["exec_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          prazo_previsto?: string | null
          proposal_id?: string
          proposal_item_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["exec_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_services_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_services_proposal_item_id_fkey"
            columns: ["proposal_item_id"]
            isOneToOne: false
            referencedRelation: "proposal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cargo: string | null
          cidade: string | null
          cnpj_cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          qtd_funcionarios: number | null
          razao_social: string
          solicitante: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          qtd_funcionarios?: number | null
          razao_social: string
          solicitante?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          qtd_funcionarios?: number | null
          razao_social?: string
          solicitante?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      execucao_anexos: {
        Row: {
          bucket: string
          created_at: string
          descricao: string | null
          execucao_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          user_id: string | null
        }
        Insert: {
          bucket?: string
          created_at?: string
          descricao?: string | null
          execucao_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          user_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          descricao?: string | null
          execucao_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execucao_anexos_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      execucao_checklists: {
        Row: {
          created_at: string
          data_prevista: string | null
          data_realizada: string | null
          descricao: string
          execucao_id: string
          id: string
          observacao: string | null
          ordem: number
          responsavel_id: string | null
          situacao: Database["public"]["Enums"]["checklist_situacao"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          data_realizada?: string | null
          descricao: string
          execucao_id: string
          id?: string
          observacao?: string | null
          ordem?: number
          responsavel_id?: string | null
          situacao?: Database["public"]["Enums"]["checklist_situacao"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          data_realizada?: string | null
          descricao?: string
          execucao_id?: string
          id?: string
          observacao?: string | null
          ordem?: number
          responsavel_id?: string | null
          situacao?: Database["public"]["Enums"]["checklist_situacao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execucao_checklists_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucao_checklists_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      execucao_historico: {
        Row: {
          acao: string
          campo: string | null
          created_at: string
          execucao_id: string
          id: string
          user_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao: string
          campo?: string | null
          created_at?: string
          execucao_id: string
          id?: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          campo?: string | null
          created_at?: string
          execucao_id?: string
          id?: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execucao_historico_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      execucao_observacoes: {
        Row: {
          created_at: string
          execucao_id: string
          id: string
          texto: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          execucao_id: string
          id?: string
          texto: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          execucao_id?: string
          id?: string
          texto?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execucao_observacoes_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      execucao_profissionais: {
        Row: {
          area: string | null
          cargo: string | null
          created_at: string
          created_by: string | null
          email: string | null
          especialidade: string | null
          id: string
          nome: string
          observacoes: string | null
          registro_profissional: string | null
          situacao: Database["public"]["Enums"]["profissional_situacao"]
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          area?: string | null
          cargo?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          registro_profissional?: string | null
          situacao?: Database["public"]["Enums"]["profissional_situacao"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          area?: string | null
          cargo?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          registro_profissional?: string | null
          situacao?: Database["public"]["Enums"]["profissional_situacao"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      execucao_servico_equipe: {
        Row: {
          created_at: string
          execucao_id: string
          id: string
          papel: string | null
          profissional_id: string
        }
        Insert: {
          created_at?: string
          execucao_id: string
          id?: string
          papel?: string | null
          profissional_id: string
        }
        Update: {
          created_at?: string
          execucao_id?: string
          id?: string
          papel?: string | null
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execucao_servico_equipe_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucao_servico_equipe_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      execucao_servicos: {
        Row: {
          categoria: string | null
          cidade: string | null
          client_id: string
          created_at: string
          created_by: string | null
          data_aprovacao: string | null
          data_prevista_conclusao: string | null
          data_prevista_inicio: string | null
          data_real_conclusao: string | null
          data_real_inicio: string | null
          descricao: string | null
          escopo_tecnico: string | null
          id: string
          numero_interno: string
          observacoes_internas: string | null
          prioridade: Database["public"]["Enums"]["execucao_prioridade"]
          proposal_id: string
          proposal_item_id: string
          proposal_revision_id: string | null
          quantidade: number
          responsavel_comercial: string | null
          responsavel_tecnico_id: string | null
          resumo_cliente: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["execucao_status"]
          titulo: string
          unidade: string | null
          updated_at: string
          updated_by: string | null
          valor_contratado: number
          visivel_cliente: boolean
        }
        Insert: {
          categoria?: string | null
          cidade?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_prevista_conclusao?: string | null
          data_prevista_inicio?: string | null
          data_real_conclusao?: string | null
          data_real_inicio?: string | null
          descricao?: string | null
          escopo_tecnico?: string | null
          id?: string
          numero_interno?: string
          observacoes_internas?: string | null
          prioridade?: Database["public"]["Enums"]["execucao_prioridade"]
          proposal_id: string
          proposal_item_id: string
          proposal_revision_id?: string | null
          quantidade?: number
          responsavel_comercial?: string | null
          responsavel_tecnico_id?: string | null
          resumo_cliente?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["execucao_status"]
          titulo: string
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_contratado?: number
          visivel_cliente?: boolean
        }
        Update: {
          categoria?: string | null
          cidade?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_prevista_conclusao?: string | null
          data_prevista_inicio?: string | null
          data_real_conclusao?: string | null
          data_real_inicio?: string | null
          descricao?: string | null
          escopo_tecnico?: string | null
          id?: string
          numero_interno?: string
          observacoes_internas?: string | null
          prioridade?: Database["public"]["Enums"]["execucao_prioridade"]
          proposal_id?: string
          proposal_item_id?: string
          proposal_revision_id?: string | null
          quantidade?: number
          responsavel_comercial?: string | null
          responsavel_tecnico_id?: string | null
          resumo_cliente?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["execucao_status"]
          titulo?: string
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_contratado?: number
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "execucao_servicos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucao_servicos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucao_servicos_proposal_item_id_fkey"
            columns: ["proposal_item_id"]
            isOneToOne: true
            referencedRelation: "proposal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucao_servicos_proposal_revision_id_fkey"
            columns: ["proposal_revision_id"]
            isOneToOne: false
            referencedRelation: "proposal_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucao_servicos_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucao_servicos_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      execucao_timeline: {
        Row: {
          created_at: string
          detalhe: string | null
          evento: string
          execucao_id: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          evento: string
          execucao_id: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          evento?: string
          execucao_id?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execucao_timeline_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          cidade: string | null
          client_id: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_abertura: string
          data_prevista_conclusao: string | null
          data_prevista_inicio: string | null
          data_real_conclusao: string | null
          data_real_inicio: string | null
          descricao: string | null
          device_id: string | null
          endereco: string | null
          escopo_contratado: string | null
          execucao_id: string
          id: string
          numero: string
          objetivo: string | null
          observacoes_tecnicas: string | null
          percentual_executado: number
          prioridade: Database["public"]["Enums"]["os_prioridade"]
          proposal_id: string | null
          qr_token: string
          responsavel_comercial: string | null
          responsavel_tecnico_id: string | null
          service_id: string | null
          servico_nome: string | null
          status: Database["public"]["Enums"]["os_status"]
          synced_at: string | null
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cidade?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_abertura?: string
          data_prevista_conclusao?: string | null
          data_prevista_inicio?: string | null
          data_real_conclusao?: string | null
          data_real_inicio?: string | null
          descricao?: string | null
          device_id?: string | null
          endereco?: string | null
          escopo_contratado?: string | null
          execucao_id: string
          id?: string
          numero?: string
          objetivo?: string | null
          observacoes_tecnicas?: string | null
          percentual_executado?: number
          prioridade?: Database["public"]["Enums"]["os_prioridade"]
          proposal_id?: string | null
          qr_token?: string
          responsavel_comercial?: string | null
          responsavel_tecnico_id?: string | null
          service_id?: string | null
          servico_nome?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          synced_at?: string | null
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cidade?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_abertura?: string
          data_prevista_conclusao?: string | null
          data_prevista_inicio?: string | null
          data_real_conclusao?: string | null
          data_real_inicio?: string | null
          descricao?: string | null
          device_id?: string | null
          endereco?: string | null
          escopo_contratado?: string | null
          execucao_id?: string
          id?: string
          numero?: string
          objetivo?: string | null
          observacoes_tecnicas?: string | null
          percentual_executado?: number
          prioridade?: Database["public"]["Enums"]["os_prioridade"]
          proposal_id?: string | null
          qr_token?: string
          responsavel_comercial?: string | null
          responsavel_tecnico_id?: string | null
          service_id?: string | null
          servico_nome?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          synced_at?: string | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      os_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          descricao: string
          id: string
          obrigatorio: boolean
          observacao: string | null
          ordem: number
          os_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao: string
          id?: string
          obrigatorio?: boolean
          observacao?: string | null
          ordem?: number
          os_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string
          id?: string
          obrigatorio?: boolean
          observacao?: string | null
          ordem?: number
          os_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_checklist_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_documentos: {
        Row: {
          anexo_path: string | null
          categoria: Database["public"]["Enums"]["os_documento_categoria"]
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          os_id: string
          status: string | null
        }
        Insert: {
          anexo_path?: string | null
          categoria: Database["public"]["Enums"]["os_documento_categoria"]
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          os_id: string
          status?: string | null
        }
        Update: {
          anexo_path?: string | null
          categoria?: Database["public"]["Enums"]["os_documento_categoria"]
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          os_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_documentos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_equipe: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          os_id: string
          papel: string
          profissional_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          os_id: string
          papel?: string
          profissional_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          os_id?: string
          papel?: string
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_equipe_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_equipe_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      os_eventos_agenda: {
        Row: {
          cidade: string | null
          created_at: string
          end_at: string
          id: string
          observacoes: string | null
          os_id: string
          profissional_id: string | null
          start_at: string
          tipo: string
          titulo: string
          updated_at: string
          visita_id: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          end_at: string
          id?: string
          observacoes?: string | null
          os_id: string
          profissional_id?: string | null
          start_at: string
          tipo?: string
          titulo: string
          updated_at?: string
          visita_id?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          end_at?: string
          id?: string
          observacoes?: string | null
          os_id?: string
          profissional_id?: string | null
          start_at?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_eventos_agenda_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_eventos_agenda_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_eventos_agenda_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "os_visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      os_evidencias: {
        Row: {
          arquivo_path: string
          created_at: string
          created_by: string | null
          device_id: string | null
          id: string
          legenda: string | null
          os_id: string
          synced_at: string | null
          tamanho_bytes: number | null
          tipo: Database["public"]["Enums"]["os_evidencia_tipo"]
          visita_id: string | null
        }
        Insert: {
          arquivo_path: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          legenda?: string | null
          os_id: string
          synced_at?: string | null
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["os_evidencia_tipo"]
          visita_id?: string | null
        }
        Update: {
          arquivo_path?: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          legenda?: string | null
          os_id?: string
          synced_at?: string | null
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["os_evidencia_tipo"]
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_evidencias_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_evidencias_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "os_visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      os_logistica: {
        Row: {
          alimentacao: string | null
          cidade: string | null
          combustivel: number | null
          created_at: string
          distancia_km: number | null
          endereco: string | null
          hospedagem: string | null
          id: string
          motorista: string | null
          observacoes: string | null
          os_id: string
          pedagios: number | null
          tempo_estimado_min: number | null
          updated_at: string
          veiculo: string | null
        }
        Insert: {
          alimentacao?: string | null
          cidade?: string | null
          combustivel?: number | null
          created_at?: string
          distancia_km?: number | null
          endereco?: string | null
          hospedagem?: string | null
          id?: string
          motorista?: string | null
          observacoes?: string | null
          os_id: string
          pedagios?: number | null
          tempo_estimado_min?: number | null
          updated_at?: string
          veiculo?: string | null
        }
        Update: {
          alimentacao?: string | null
          cidade?: string | null
          combustivel?: number | null
          created_at?: string
          distancia_km?: number | null
          endereco?: string | null
          hospedagem?: string | null
          id?: string
          motorista?: string | null
          observacoes?: string | null
          os_id?: string
          pedagios?: number | null
          tempo_estimado_min?: number | null
          updated_at?: string
          veiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_logistica_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: true
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_recursos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          observacao: string | null
          os_id: string
          quantidade: number | null
          tipo: Database["public"]["Enums"]["os_recurso_tipo"]
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          observacao?: string | null
          os_id: string
          quantidade?: number | null
          tipo: Database["public"]["Enums"]["os_recurso_tipo"]
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          observacao?: string | null
          os_id?: string
          quantidade?: number | null
          tipo?: Database["public"]["Enums"]["os_recurso_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "os_recursos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_timeline: {
        Row: {
          created_at: string
          detalhe: string | null
          evento: string
          id: string
          os_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          evento: string
          id?: string
          os_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          evento?: string
          id?: string
          os_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_timeline_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_visita_checklist: {
        Row: {
          concluido: boolean
          created_at: string
          descricao: string
          id: string
          observacao: string | null
          ordem: number
          visita_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          descricao: string
          id?: string
          observacao?: string | null
          ordem?: number
          visita_id: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          descricao?: string
          id?: string
          observacao?: string | null
          ordem?: number
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_visita_checklist_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "os_visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      os_visitas: {
        Row: {
          cliente_acompanhou: boolean | null
          concluida_em: string | null
          concluida_por: string | null
          created_at: string
          data: string
          device_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          local: string | null
          objetivo: string | null
          observacoes: string | null
          os_id: string
          responsavel_id: string | null
          situacao: Database["public"]["Enums"]["os_visita_situacao"]
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          cliente_acompanhou?: boolean | null
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data: string
          device_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          objetivo?: string | null
          observacoes?: string | null
          os_id: string
          responsavel_id?: string | null
          situacao?: Database["public"]["Enums"]["os_visita_situacao"]
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          cliente_acompanhou?: boolean | null
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data?: string
          device_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          objetivo?: string | null
          observacoes?: string | null
          os_id?: string
          responsavel_id?: string | null
          situacao?: Database["public"]["Enums"]["os_visita_situacao"]
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_visitas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_visitas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_params: {
        Row: {
          aliquota_imposto: number
          arredondamento: number
          condicoes_pagamento_default: string
          custo_fixo_mensal: number
          custo_por_vida: number
          horas_produtivas_mes: number
          id: string
          margem_minima: number
          markup_minimo: number
          outras_condicoes_default: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aliquota_imposto?: number
          arredondamento?: number
          condicoes_pagamento_default?: string
          custo_fixo_mensal?: number
          custo_por_vida?: number
          horas_produtivas_mes?: number
          id?: string
          margem_minima?: number
          markup_minimo?: number
          outras_condicoes_default?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aliquota_imposto?: number
          arredondamento?: number
          condicoes_pagamento_default?: string
          custo_fixo_mensal?: number
          custo_por_vida?: number
          horas_produtivas_mes?: number
          id?: string
          margem_minima?: number
          markup_minimo?: number
          outras_condicoes_default?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_item_pricing: {
        Row: {
          aliquota_imposto: number
          created_at: string
          custos: Json
          desconto_comercial: number
          horas: Json
          id: string
          indicadores: Json
          lucro_desejado: number
          margem_desejada: number
          preco_aprovado: number
          preco_arredondado: number
          preco_sugerido: number
          proposal_item_id: string
          updated_at: string
        }
        Insert: {
          aliquota_imposto?: number
          created_at?: string
          custos?: Json
          desconto_comercial?: number
          horas?: Json
          id?: string
          indicadores?: Json
          lucro_desejado?: number
          margem_desejada?: number
          preco_aprovado?: number
          preco_arredondado?: number
          preco_sugerido?: number
          proposal_item_id: string
          updated_at?: string
        }
        Update: {
          aliquota_imposto?: number
          created_at?: string
          custos?: Json
          desconto_comercial?: number
          horas?: Json
          id?: string
          indicadores?: Json
          lucro_desejado?: number
          margem_desejada?: number
          preco_aprovado?: number
          preco_arredondado?: number
          preco_sugerido?: number
          proposal_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_item_pricing_proposal_item_id_fkey"
            columns: ["proposal_item_id"]
            isOneToOne: true
            referencedRelation: "proposal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          categoria: string | null
          created_at: string
          descricao_comercial: string
          escopo_tecnico: string | null
          id: string
          numero_item: number
          proposal_id: string
          quantidade: number
          service_id: string | null
          unidade: string
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao_comercial: string
          escopo_tecnico?: string | null
          id?: string
          numero_item?: number
          proposal_id: string
          quantidade?: number
          service_id?: string | null
          unidade?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao_comercial?: string
          escopo_tecnico?: string | null
          id?: string
          numero_item?: number
          proposal_id?: string
          quantidade?: number
          service_id?: string | null
          unidade?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_revisions: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          proposal_id: string
          revisao: number
          snapshot: Json | null
          titulo: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          proposal_id: string
          revisao?: number
          snapshot?: Json | null
          titulo?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          proposal_id?: string
          revisao?: number
          snapshot?: Json | null
          titulo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_revisions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_template: {
        Row: {
          capa_imagem_url: string | null
          contracapa_imagem_url: string | null
          cor_neutra: string
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          diferenciais: Json
          email: string
          endereco: string
          font_corpo: string
          font_titulo: string
          id: string
          logo_url: string | null
          mensagem_contracapa: string
          missao: string
          quem_somos: string
          rodape_versao: string
          site: string
          slogan: string
          telefone: string
          texto_aceite: string
          updated_at: string
          valores: string
          visao: string
          whatsapp: string
        }
        Insert: {
          capa_imagem_url?: string | null
          contracapa_imagem_url?: string | null
          cor_neutra?: string
          cor_primaria?: string
          cor_secundaria?: string
          created_at?: string
          diferenciais?: Json
          email?: string
          endereco?: string
          font_corpo?: string
          font_titulo?: string
          id?: string
          logo_url?: string | null
          mensagem_contracapa?: string
          missao?: string
          quem_somos?: string
          rodape_versao?: string
          site?: string
          slogan?: string
          telefone?: string
          texto_aceite?: string
          updated_at?: string
          valores?: string
          visao?: string
          whatsapp?: string
        }
        Update: {
          capa_imagem_url?: string | null
          contracapa_imagem_url?: string | null
          cor_neutra?: string
          cor_primaria?: string
          cor_secundaria?: string
          created_at?: string
          diferenciais?: Json
          email?: string
          endereco?: string
          font_corpo?: string
          font_titulo?: string
          id?: string
          logo_url?: string | null
          mensagem_contracapa?: string
          missao?: string
          quem_somos?: string
          rodape_versao?: string
          site?: string
          slogan?: string
          telefone?: string
          texto_aceite?: string
          updated_at?: string
          valores?: string
          visao?: string
          whatsapp?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          aceite_data: string | null
          assinatura_prestador: string | null
          assinatura_tomador: string | null
          client_id: string | null
          condicoes_pagamento: string | null
          created_at: string
          created_by: string | null
          data_envio: string | null
          escopo_geral: string | null
          id: string
          numero: string
          observacoes_comerciais: string | null
          observacoes_internas: string | null
          outras_condicoes: string | null
          proximo_followup: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
          validade: string | null
          valor_total: number
        }
        Insert: {
          aceite_data?: string | null
          assinatura_prestador?: string | null
          assinatura_tomador?: string | null
          client_id?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          escopo_geral?: string | null
          id?: string
          numero?: string
          observacoes_comerciais?: string | null
          observacoes_internas?: string | null
          outras_condicoes?: string | null
          proximo_followup?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Update: {
          aceite_data?: string | null
          assinatura_prestador?: string | null
          assinatura_tomador?: string | null
          client_id?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          escopo_geral?: string | null
          id?: string
          numero?: string
          observacoes_comerciais?: string | null
          observacoes_internas?: string | null
          outras_condicoes?: string | null
          proximo_followup?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          descricao_comercial: string | null
          escopo_tecnico: string | null
          id: string
          nome: string
          unidade_padrao: string | null
          updated_at: string
          valor_referencia: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao_comercial?: string | null
          escopo_tecnico?: string | null
          id?: string
          nome: string
          unidade_padrao?: string | null
          updated_at?: string
          valor_referencia?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao_comercial?: string | null
          escopo_tecnico?: string | null
          id?: string
          nome?: string
          unidade_padrao?: string | null
          updated_at?: string
          valor_referencia?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_proposal_revision: {
        Args: { _descricao: string; _proposal_id: string; _titulo: string }
        Returns: string
      }
      can_see_internal: { Args: { _user_id: string }; Returns: boolean }
      criar_execucoes_da_proposta: {
        Args: { _proposal_id: string }
        Returns: number
      }
      gerar_numero_os: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "comercial" | "tecnico"
      checklist_situacao: "pendente" | "em_andamento" | "concluido"
      exec_status: "pendente" | "em_andamento" | "concluido" | "cancelado"
      execucao_prioridade: "baixa" | "normal" | "alta" | "urgente"
      execucao_status:
        | "aguardando_inicio"
        | "planejamento"
        | "aguardando_documentacao"
        | "agendado"
        | "em_execucao"
        | "em_revisao_tecnica"
        | "aguardando_aprovacao_cliente"
        | "concluido"
        | "suspenso"
        | "cancelado"
      os_documento_categoria: "recebido" | "gerado" | "pendente"
      os_evidencia_tipo:
        | "foto"
        | "video"
        | "pdf"
        | "audio"
        | "documento"
        | "outro"
      os_prioridade: "baixa" | "media" | "alta" | "urgente"
      os_recurso_tipo: "equipamento" | "veiculo" | "documento" | "epi" | "outro"
      os_status:
        | "aberta"
        | "planejamento"
        | "agendada"
        | "em_campo"
        | "em_elaboracao"
        | "em_revisao"
        | "aguardando_cliente"
        | "finalizada"
        | "cancelada"
      os_visita_situacao:
        | "planejada"
        | "em_andamento"
        | "realizada"
        | "cancelada"
        | "remarcada"
      profissional_situacao: "ativo" | "inativo" | "ferias" | "afastado"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "negociacao"
        | "aprovada"
        | "recusada"
        | "expirada"
        | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "comercial", "tecnico"],
      checklist_situacao: ["pendente", "em_andamento", "concluido"],
      exec_status: ["pendente", "em_andamento", "concluido", "cancelado"],
      execucao_prioridade: ["baixa", "normal", "alta", "urgente"],
      execucao_status: [
        "aguardando_inicio",
        "planejamento",
        "aguardando_documentacao",
        "agendado",
        "em_execucao",
        "em_revisao_tecnica",
        "aguardando_aprovacao_cliente",
        "concluido",
        "suspenso",
        "cancelado",
      ],
      os_documento_categoria: ["recebido", "gerado", "pendente"],
      os_evidencia_tipo: [
        "foto",
        "video",
        "pdf",
        "audio",
        "documento",
        "outro",
      ],
      os_prioridade: ["baixa", "media", "alta", "urgente"],
      os_recurso_tipo: ["equipamento", "veiculo", "documento", "epi", "outro"],
      os_status: [
        "aberta",
        "planejamento",
        "agendada",
        "em_campo",
        "em_elaboracao",
        "em_revisao",
        "aguardando_cliente",
        "finalizada",
        "cancelada",
      ],
      os_visita_situacao: [
        "planejada",
        "em_andamento",
        "realizada",
        "cancelada",
        "remarcada",
      ],
      profissional_situacao: ["ativo", "inativo", "ferias", "afastado"],
      proposal_status: [
        "rascunho",
        "enviada",
        "negociacao",
        "aprovada",
        "recusada",
        "expirada",
        "cancelada",
      ],
    },
  },
} as const
