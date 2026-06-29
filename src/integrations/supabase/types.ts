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
      automacoes: {
        Row: {
          agendamento_cron: string | null
          ativa: boolean
          config: Json
          created_at: string
          created_by: string | null
          descricao: string | null
          dias_antes: number | null
          dias_inatividade: number | null
          id: string
          mensagem_padrao: string | null
          modulos_afetados: string[]
          nome: string
          prioridade_padrao: Database["public"]["Enums"]["notif_prioridade"]
          proxima_execucao: string | null
          responsavel_padrao: string | null
          tipo: Database["public"]["Enums"]["automacao_tipo"]
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          agendamento_cron?: string | null
          ativa?: boolean
          config?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          dias_antes?: number | null
          dias_inatividade?: number | null
          id?: string
          mensagem_padrao?: string | null
          modulos_afetados?: string[]
          nome: string
          prioridade_padrao?: Database["public"]["Enums"]["notif_prioridade"]
          proxima_execucao?: string | null
          responsavel_padrao?: string | null
          tipo?: Database["public"]["Enums"]["automacao_tipo"]
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_cron?: string | null
          ativa?: boolean
          config?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          dias_antes?: number | null
          dias_inatividade?: number | null
          id?: string
          mensagem_padrao?: string | null
          modulos_afetados?: string[]
          nome?: string
          prioridade_padrao?: Database["public"]["Enums"]["notif_prioridade"]
          proxima_execucao?: string | null
          responsavel_padrao?: string | null
          tipo?: Database["public"]["Enums"]["automacao_tipo"]
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      automacoes_acoes: {
        Row: {
          automacao_id: string
          created_at: string
          id: string
          ordem: number
          parametros: Json
          template: string | null
          tipo: Database["public"]["Enums"]["automacao_acao_tipo"]
          titulo: string | null
        }
        Insert: {
          automacao_id: string
          created_at?: string
          id?: string
          ordem?: number
          parametros?: Json
          template?: string | null
          tipo: Database["public"]["Enums"]["automacao_acao_tipo"]
          titulo?: string | null
        }
        Update: {
          automacao_id?: string
          created_at?: string
          id?: string
          ordem?: number
          parametros?: Json
          template?: string | null
          tipo?: Database["public"]["Enums"]["automacao_acao_tipo"]
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_acoes_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      automacoes_configuracoes: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      automacoes_execucoes: {
        Row: {
          alertas_criados: number
          automacao_id: string
          detalhe: string | null
          duracao_ms: number | null
          erros: Json | null
          executado_por: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          notificacoes_criadas: number
          origem: string
          registros_afetados: number
          status: Database["public"]["Enums"]["automacao_status_execucao"]
          tarefas_criadas: number
        }
        Insert: {
          alertas_criados?: number
          automacao_id: string
          detalhe?: string | null
          duracao_ms?: number | null
          erros?: Json | null
          executado_por?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          notificacoes_criadas?: number
          origem?: string
          registros_afetados?: number
          status?: Database["public"]["Enums"]["automacao_status_execucao"]
          tarefas_criadas?: number
        }
        Update: {
          alertas_criados?: number
          automacao_id?: string
          detalhe?: string | null
          duracao_ms?: number | null
          erros?: Json | null
          executado_por?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          notificacoes_criadas?: number
          origem?: string
          registros_afetados?: number
          status?: Database["public"]["Enums"]["automacao_status_execucao"]
          tarefas_criadas?: number
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_execucoes_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      automacoes_gatilhos: {
        Row: {
          automacao_id: string
          condicao: Json
          created_at: string
          evento: string | null
          id: string
          ordem: number
          tipo: Database["public"]["Enums"]["automacao_gatilho_tipo"]
        }
        Insert: {
          automacao_id: string
          condicao?: Json
          created_at?: string
          evento?: string | null
          id?: string
          ordem?: number
          tipo: Database["public"]["Enums"]["automacao_gatilho_tipo"]
        }
        Update: {
          automacao_id?: string
          condicao?: Json
          created_at?: string
          evento?: string | null
          id?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["automacao_gatilho_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_gatilhos_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_comunicacoes: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          assunto: string | null
          autor_nome: string | null
          autor_tipo: string
          client_id: string
          cliente_usuario_id: string | null
          created_at: string
          created_by: string | null
          id: string
          mensagem: string
          parent_id: string | null
          status: Database["public"]["Enums"]["cliente_com_status"]
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          assunto?: string | null
          autor_nome?: string | null
          autor_tipo: string
          client_id: string
          cliente_usuario_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mensagem: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["cliente_com_status"]
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          assunto?: string | null
          autor_nome?: string | null
          autor_tipo?: string
          client_id?: string
          cliente_usuario_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mensagem?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["cliente_com_status"]
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_comunicacoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_comunicacoes_cliente_usuario_id_fkey"
            columns: ["cliente_usuario_id"]
            isOneToOne: false
            referencedRelation: "cliente_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_comunicacoes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cliente_comunicacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_configuracoes: {
        Row: {
          client_id: string
          created_at: string
          id: string
          mensagem_boas_vindas: string | null
          mostrar_comunicacoes: boolean
          mostrar_documentos: boolean
          mostrar_financeiro: boolean
          mostrar_os: boolean
          mostrar_pendencias: boolean
          mostrar_propostas: boolean
          mostrar_servicos: boolean
          portal_ativo: boolean
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          mensagem_boas_vindas?: string | null
          mostrar_comunicacoes?: boolean
          mostrar_documentos?: boolean
          mostrar_financeiro?: boolean
          mostrar_os?: boolean
          mostrar_pendencias?: boolean
          mostrar_propostas?: boolean
          mostrar_servicos?: boolean
          portal_ativo?: boolean
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          mensagem_boas_vindas?: string | null
          mostrar_comunicacoes?: boolean
          mostrar_documentos?: boolean
          mostrar_financeiro?: boolean
          mostrar_os?: boolean
          mostrar_pendencias?: boolean
          mostrar_propostas?: boolean
          mostrar_servicos?: boolean
          portal_ativo?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_configuracoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_logs_acesso: {
        Row: {
          acao: string
          client_id: string
          cliente_usuario_id: string | null
          created_at: string
          detalhe: string | null
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          acao: string
          client_id: string
          cliente_usuario_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: string
          client_id?: string
          cliente_usuario_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_logs_acesso_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_logs_acesso_cliente_usuario_id_fkey"
            columns: ["cliente_usuario_id"]
            isOneToOne: false
            referencedRelation: "cliente_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_notificacoes: {
        Row: {
          client_id: string
          cliente_usuario_id: string | null
          created_at: string
          id: string
          lida: boolean
          lida_em: string | null
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          client_id: string
          cliente_usuario_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          client_id?: string
          cliente_usuario_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_notificacoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_notificacoes_cliente_usuario_id_fkey"
            columns: ["cliente_usuario_id"]
            isOneToOne: false
            referencedRelation: "cliente_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_permissoes: {
        Row: {
          abrir_comunicacao: boolean
          baixar_documentos: boolean
          baixar_propostas: boolean
          cliente_usuario_id: string
          created_at: string
          enviar_documentos: boolean
          id: string
          responder_pendencias: boolean
          updated_at: string
          ver_documentos: boolean
          ver_financeiro: boolean
          ver_os: boolean
          ver_propostas: boolean
          ver_servicos: boolean
        }
        Insert: {
          abrir_comunicacao?: boolean
          baixar_documentos?: boolean
          baixar_propostas?: boolean
          cliente_usuario_id: string
          created_at?: string
          enviar_documentos?: boolean
          id?: string
          responder_pendencias?: boolean
          updated_at?: string
          ver_documentos?: boolean
          ver_financeiro?: boolean
          ver_os?: boolean
          ver_propostas?: boolean
          ver_servicos?: boolean
        }
        Update: {
          abrir_comunicacao?: boolean
          baixar_documentos?: boolean
          baixar_propostas?: boolean
          cliente_usuario_id?: string
          created_at?: string
          enviar_documentos?: boolean
          id?: string
          responder_pendencias?: boolean
          updated_at?: string
          ver_documentos?: boolean
          ver_financeiro?: boolean
          ver_os?: boolean
          ver_propostas?: boolean
          ver_servicos?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cliente_permissoes_cliente_usuario_id_fkey"
            columns: ["cliente_usuario_id"]
            isOneToOne: true
            referencedRelation: "cliente_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_uploads: {
        Row: {
          arquivo_nome: string
          arquivo_url: string
          client_id: string
          cliente_usuario_id: string | null
          created_at: string
          execucao_id: string | null
          id: string
          mime_type: string | null
          observacao: string | null
          pendencia_id: string | null
          tamanho_bytes: number | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_url: string
          client_id: string
          cliente_usuario_id?: string | null
          created_at?: string
          execucao_id?: string | null
          id?: string
          mime_type?: string | null
          observacao?: string | null
          pendencia_id?: string | null
          tamanho_bytes?: number | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_url?: string
          client_id?: string
          cliente_usuario_id?: string | null
          created_at?: string
          execucao_id?: string | null
          id?: string
          mime_type?: string | null
          observacao?: string | null
          pendencia_id?: string | null
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_uploads_cliente_usuario_id_fkey"
            columns: ["cliente_usuario_id"]
            isOneToOne: false
            referencedRelation: "cliente_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_uploads_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_uploads_pendencia_id_fkey"
            columns: ["pendencia_id"]
            isOneToOne: false
            referencedRelation: "documentos_pendentes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_usuarios: {
        Row: {
          auth_user_id: string | null
          cargo: string | null
          client_id: string
          convite_enviado_em: string | null
          convite_token: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["cliente_perfil"]
          status: Database["public"]["Enums"]["cliente_user_status"]
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          auth_user_id?: string | null
          cargo?: string | null
          client_id: string
          convite_enviado_em?: string | null
          convite_token?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          nome: string
          perfil?: Database["public"]["Enums"]["cliente_perfil"]
          status?: Database["public"]["Enums"]["cliente_user_status"]
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          auth_user_id?: string | null
          cargo?: string | null
          client_id?: string
          convite_enviado_em?: string | null
          convite_token?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["cliente_perfil"]
          status?: Database["public"]["Enums"]["cliente_user_status"]
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_usuarios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      crm_agenda: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          end_at: string | null
          followup_id: string | null
          id: string
          lead_id: string | null
          link: string | null
          local: string | null
          observacoes: string | null
          oportunidade_id: string | null
          proposal_id: string | null
          responsavel_id: string | null
          start_at: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          followup_id?: string | null
          id?: string
          lead_id?: string | null
          link?: string | null
          local?: string | null
          observacoes?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          responsavel_id?: string | null
          start_at: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          followup_id?: string | null
          id?: string
          lead_id?: string | null
          link?: string | null
          local?: string | null
          observacoes?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          responsavel_id?: string | null
          start_at?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_agenda_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agenda_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "crm_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agenda_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agenda_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agenda_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_alertas: {
        Row: {
          created_at: string
          followup_id: string | null
          id: string
          lead_id: string | null
          lido: boolean
          mensagem: string | null
          oportunidade_id: string | null
          proposal_id: string | null
          resolvido: boolean
          responsavel_id: string | null
          tipo: Database["public"]["Enums"]["crm_alerta_tipo"]
          titulo: string
        }
        Insert: {
          created_at?: string
          followup_id?: string | null
          id?: string
          lead_id?: string | null
          lido?: boolean
          mensagem?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          resolvido?: boolean
          responsavel_id?: string | null
          tipo: Database["public"]["Enums"]["crm_alerta_tipo"]
          titulo: string
        }
        Update: {
          created_at?: string
          followup_id?: string | null
          id?: string
          lead_id?: string | null
          lido?: boolean
          mensagem?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          resolvido?: boolean
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["crm_alerta_tipo"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_alertas_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "crm_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_alertas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_alertas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_alertas_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_followups: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          data: string
          hora: string | null
          id: string
          lead_id: string | null
          oportunidade_id: string | null
          proposal_id: string | null
          proxima_acao: string | null
          proximo_followup_data: string | null
          proximo_followup_hora: string | null
          responsavel_id: string | null
          resumo: string | null
          status: Database["public"]["Enums"]["crm_followup_status"]
          tipo: Database["public"]["Enums"]["crm_followup_tipo"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          hora?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          proxima_acao?: string | null
          proximo_followup_data?: string | null
          proximo_followup_hora?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["crm_followup_status"]
          tipo: Database["public"]["Enums"]["crm_followup_tipo"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          hora?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          proxima_acao?: string | null
          proximo_followup_data?: string | null
          proximo_followup_hora?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["crm_followup_status"]
          tipo?: Database["public"]["Enums"]["crm_followup_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_historico: {
        Row: {
          client_id: string | null
          created_at: string
          detalhe: string | null
          id: string
          lead_id: string | null
          oportunidade_id: string | null
          proposal_id: string | null
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          tipo: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          proposal_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_historico_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historico_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historico_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          autoridade_decisao: string | null
          cidade: string | null
          cliente_id: string | null
          cnpj_cpf: string | null
          concorrentes: string | null
          contato_cargo: string | null
          contato_nome: string | null
          convertido_em: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa: string
          estado: string | null
          id: string
          necessidade: string | null
          observacoes: string | null
          orcamento_disponivel: string | null
          origem: Database["public"]["Enums"]["crm_lead_origem"] | null
          prazo_contratacao: string | null
          qtd_funcionarios: number | null
          responsavel_id: string | null
          score: Database["public"]["Enums"]["crm_score"] | null
          segmento: string | null
          servicos_interesse: string[] | null
          status: Database["public"]["Enums"]["crm_lead_status"]
          telefone: string | null
          updated_at: string
          updated_by: string | null
          urgencia: string | null
          whatsapp: string | null
        }
        Insert: {
          autoridade_decisao?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cnpj_cpf?: string | null
          concorrentes?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          convertido_em?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa: string
          estado?: string | null
          id?: string
          necessidade?: string | null
          observacoes?: string | null
          orcamento_disponivel?: string | null
          origem?: Database["public"]["Enums"]["crm_lead_origem"] | null
          prazo_contratacao?: string | null
          qtd_funcionarios?: number | null
          responsavel_id?: string | null
          score?: Database["public"]["Enums"]["crm_score"] | null
          segmento?: string | null
          servicos_interesse?: string[] | null
          status?: Database["public"]["Enums"]["crm_lead_status"]
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
          urgencia?: string | null
          whatsapp?: string | null
        }
        Update: {
          autoridade_decisao?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cnpj_cpf?: string | null
          concorrentes?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          convertido_em?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa?: string
          estado?: string | null
          id?: string
          necessidade?: string | null
          observacoes?: string | null
          orcamento_disponivel?: string | null
          origem?: Database["public"]["Enums"]["crm_lead_origem"] | null
          prazo_contratacao?: string | null
          qtd_funcionarios?: number | null
          responsavel_id?: string | null
          score?: Database["public"]["Enums"]["crm_score"] | null
          segmento?: string | null
          servicos_interesse?: string[] | null
          status?: Database["public"]["Enums"]["crm_lead_status"]
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
          urgencia?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_motivos_perda: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      crm_oportunidades: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          data_ganho: string | null
          data_perda: string | null
          data_prevista_fechamento: string | null
          etapa: Database["public"]["Enums"]["crm_etapa"]
          id: string
          lead_id: string | null
          motivo_perda: string | null
          motivo_perda_obs: string | null
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["crm_prioridade"]
          probabilidade: number
          proposal_id: string | null
          responsavel_id: string | null
          service_id: string | null
          servico_interesse: string | null
          temperatura: Database["public"]["Enums"]["crm_temperatura"]
          titulo: string
          updated_at: string
          updated_by: string | null
          valor_estimado: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data_ganho?: string | null
          data_perda?: string | null
          data_prevista_fechamento?: string | null
          etapa?: Database["public"]["Enums"]["crm_etapa"]
          id?: string
          lead_id?: string | null
          motivo_perda?: string | null
          motivo_perda_obs?: string | null
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["crm_prioridade"]
          probabilidade?: number
          proposal_id?: string | null
          responsavel_id?: string | null
          service_id?: string | null
          servico_interesse?: string | null
          temperatura?: Database["public"]["Enums"]["crm_temperatura"]
          titulo: string
          updated_at?: string
          updated_by?: string | null
          valor_estimado?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data_ganho?: string | null
          data_perda?: string | null
          data_prevista_fechamento?: string | null
          etapa?: Database["public"]["Enums"]["crm_etapa"]
          id?: string
          lead_id?: string | null
          motivo_perda?: string | null
          motivo_perda_obs?: string | null
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["crm_prioridade"]
          probabilidade?: number
          proposal_id?: string | null
          responsavel_id?: string | null
          service_id?: string | null
          servico_interesse?: string | null
          temperatura?: Database["public"]["Enums"]["crm_temperatura"]
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          valor_estimado?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_oportunidades_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_anexos: {
        Row: {
          arquivo_path: string
          created_at: string
          descricao: string | null
          documento_id: string
          id: string
          nome: string
          origem: Database["public"]["Enums"]["documento_origem_anexo"]
          origem_id: string | null
          tipo: string | null
          uploaded_by: string | null
        }
        Insert: {
          arquivo_path: string
          created_at?: string
          descricao?: string | null
          documento_id: string
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["documento_origem_anexo"]
          origem_id?: string | null
          tipo?: string | null
          uploaded_by?: string | null
        }
        Update: {
          arquivo_path?: string
          created_at?: string
          descricao?: string | null
          documento_id?: string
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["documento_origem_anexo"]
          origem_id?: string | null
          tipo?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_anexos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_aprovacoes: {
        Row: {
          aprovado_em: string
          aprovado_por: string | null
          documento_id: string
          id: string
          observacoes: string | null
          revisao_id: string | null
        }
        Insert: {
          aprovado_em?: string
          aprovado_por?: string | null
          documento_id: string
          id?: string
          observacoes?: string | null
          revisao_id?: string | null
        }
        Update: {
          aprovado_em?: string
          aprovado_por?: string | null
          documento_id?: string
          id?: string
          observacoes?: string | null
          revisao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_aprovacoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_aprovacoes_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "documentos_revisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_campos_variaveis: {
        Row: {
          ativo: boolean
          campo_origem: string
          chave: string
          created_at: string
          descricao: string | null
          id: string
          label: string
          origem: string
        }
        Insert: {
          ativo?: boolean
          campo_origem: string
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          label: string
          origem: string
        }
        Update: {
          ativo?: boolean
          campo_origem?: string
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          label?: string
          origem?: string
        }
        Relationships: []
      }
      documentos_modelos: {
        Row: {
          ativo: boolean
          campos_variaveis_json: Json | null
          categoria: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          responsavel_padrao_id: string | null
          secoes_json: Json | null
          texto_padrao: string | null
          tipo: Database["public"]["Enums"]["documento_tipo"]
          updated_at: string
          validade_padrao_dias: number | null
        }
        Insert: {
          ativo?: boolean
          campos_variaveis_json?: Json | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          responsavel_padrao_id?: string | null
          secoes_json?: Json | null
          texto_padrao?: string | null
          tipo: Database["public"]["Enums"]["documento_tipo"]
          updated_at?: string
          validade_padrao_dias?: number | null
        }
        Update: {
          ativo?: boolean
          campos_variaveis_json?: Json | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_padrao_id?: string | null
          secoes_json?: Json | null
          texto_padrao?: string | null
          tipo?: Database["public"]["Enums"]["documento_tipo"]
          updated_at?: string
          validade_padrao_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_modelos_responsavel_padrao_id_fkey"
            columns: ["responsavel_padrao_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_notificacoes: {
        Row: {
          created_at: string
          documento_id: string | null
          id: string
          lida: boolean
          mensagem: string
          tipo: Database["public"]["Enums"]["documento_notificacao_tipo"]
          user_id_destino: string | null
        }
        Insert: {
          created_at?: string
          documento_id?: string | null
          id?: string
          lida?: boolean
          mensagem: string
          tipo: Database["public"]["Enums"]["documento_notificacao_tipo"]
          user_id_destino?: string | null
        }
        Update: {
          created_at?: string
          documento_id?: string | null
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: Database["public"]["Enums"]["documento_notificacao_tipo"]
          user_id_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_notificacoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_pendentes: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          data_solicitacao: string
          documento_solicitado: string
          execucao_id: string | null
          id: string
          observacao: string | null
          prazo: string | null
          responsavel_envio: string | null
          status: Database["public"]["Enums"]["documento_pendente_status"]
          updated_at: string
          visivel_para_cliente: boolean
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          documento_solicitado: string
          execucao_id?: string | null
          id?: string
          observacao?: string | null
          prazo?: string | null
          responsavel_envio?: string | null
          status?: Database["public"]["Enums"]["documento_pendente_status"]
          updated_at?: string
          visivel_para_cliente?: boolean
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          documento_solicitado?: string
          execucao_id?: string | null
          id?: string
          observacao?: string | null
          prazo?: string | null
          responsavel_envio?: string | null
          status?: Database["public"]["Enums"]["documento_pendente_status"]
          updated_at?: string
          visivel_para_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documentos_pendentes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pendentes_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_permissoes: {
        Row: {
          id: string
          pode_aprovar: boolean
          pode_cancelar: boolean
          pode_criar: boolean
          pode_editar: boolean
          pode_emitir: boolean
          pode_revisar: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          id?: string
          pode_aprovar?: boolean
          pode_cancelar?: boolean
          pode_criar?: boolean
          pode_editar?: boolean
          pode_emitir?: boolean
          pode_revisar?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          id?: string
          pode_aprovar?: boolean
          pode_cancelar?: boolean
          pode_criar?: boolean
          pode_editar?: boolean
          pode_emitir?: boolean
          pode_revisar?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      documentos_recebidos: {
        Row: {
          arquivo_path: string | null
          client_id: string | null
          created_at: string
          data_recebimento: string
          execucao_id: string | null
          id: string
          nome: string
          observacoes: string | null
          recebido_por: string | null
          status: Database["public"]["Enums"]["documento_recebido_status"]
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          client_id?: string | null
          created_at?: string
          data_recebimento?: string
          execucao_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          recebido_por?: string | null
          status?: Database["public"]["Enums"]["documento_recebido_status"]
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          client_id?: string | null
          created_at?: string
          data_recebimento?: string
          execucao_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          recebido_por?: string | null
          status?: Database["public"]["Enums"]["documento_recebido_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_recebidos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_recebidos_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_revisoes: {
        Row: {
          arquivo_path: string | null
          conteudo_snapshot: Json | null
          created_at: string
          descricao: string | null
          documento_id: string
          id: string
          numero_revisao: number
          status: Database["public"]["Enums"]["documento_status"] | null
          user_id: string | null
        }
        Insert: {
          arquivo_path?: string | null
          conteudo_snapshot?: Json | null
          created_at?: string
          descricao?: string | null
          documento_id: string
          id?: string
          numero_revisao: number
          status?: Database["public"]["Enums"]["documento_status"] | null
          user_id?: string | null
        }
        Update: {
          arquivo_path?: string | null
          conteudo_snapshot?: Json | null
          created_at?: string
          descricao?: string | null
          documento_id?: string
          id?: string
          numero_revisao?: number
          status?: Database["public"]["Enums"]["documento_status"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_revisoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_secoes: {
        Row: {
          conteudo_padrao: string | null
          created_at: string
          id: string
          modelo_id: string
          obrigatoria: boolean
          ordem: number
          titulo: string
        }
        Insert: {
          conteudo_padrao?: string | null
          created_at?: string
          id?: string
          modelo_id: string
          obrigatoria?: boolean
          ordem?: number
          titulo: string
        }
        Update: {
          conteudo_padrao?: string | null
          created_at?: string
          id?: string
          modelo_id?: string
          obrigatoria?: boolean
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_secoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "documentos_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_tecnicos: {
        Row: {
          aprovacao_obs: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          arquivo_final_path: string | null
          assinatura_art: string | null
          assinatura_cargo: string | null
          assinatura_path: string | null
          assinatura_registro: string | null
          client_id: string | null
          cliente_nome: string | null
          conteudo_json: Json
          created_at: string
          created_by: string | null
          data_aprovacao: string | null
          data_emissao: string | null
          data_vencimento: string | null
          execucao_id: string | null
          id: string
          modelo_id: string | null
          numero: string
          observacoes_internas: string | null
          os_id: string | null
          proposal_id: string | null
          responsavel_revisao_id: string | null
          responsavel_tecnico_id: string | null
          revisao: number
          status: Database["public"]["Enums"]["documento_status"]
          tipo: Database["public"]["Enums"]["documento_tipo"]
          tipo_label: string | null
          titulo: string
          updated_at: string
          updated_by: string | null
          versao: number
          visivel_para_cliente: boolean
        }
        Insert: {
          aprovacao_obs?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_final_path?: string | null
          assinatura_art?: string | null
          assinatura_cargo?: string | null
          assinatura_path?: string | null
          assinatura_registro?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          conteudo_json?: Json
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          execucao_id?: string | null
          id?: string
          modelo_id?: string | null
          numero?: string
          observacoes_internas?: string | null
          os_id?: string | null
          proposal_id?: string | null
          responsavel_revisao_id?: string | null
          responsavel_tecnico_id?: string | null
          revisao?: number
          status?: Database["public"]["Enums"]["documento_status"]
          tipo: Database["public"]["Enums"]["documento_tipo"]
          tipo_label?: string | null
          titulo: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
          visivel_para_cliente?: boolean
        }
        Update: {
          aprovacao_obs?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_final_path?: string | null
          assinatura_art?: string | null
          assinatura_cargo?: string | null
          assinatura_path?: string | null
          assinatura_registro?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          conteudo_json?: Json
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          execucao_id?: string | null
          id?: string
          modelo_id?: string | null
          numero?: string
          observacoes_internas?: string | null
          os_id?: string | null
          proposal_id?: string | null
          responsavel_revisao_id?: string | null
          responsavel_tecnico_id?: string | null
          revisao?: number
          status?: Database["public"]["Enums"]["documento_status"]
          tipo?: Database["public"]["Enums"]["documento_tipo"]
          tipo_label?: string | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
          visivel_para_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documentos_tecnicos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tecnicos_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tecnicos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "documentos_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tecnicos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tecnicos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tecnicos_responsavel_revisao_id_fkey"
            columns: ["responsavel_revisao_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tecnicos_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "execucao_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_timeline: {
        Row: {
          created_at: string
          detalhe: string | null
          documento_id: string
          evento: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          documento_id: string
          evento: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          documento_id?: string
          evento?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_timeline_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_tecnicos"
            referencedColumns: ["id"]
          },
        ]
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
          visivel_para_cliente: boolean
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
          visivel_para_cliente?: boolean
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
          visivel_para_cliente?: boolean
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
      financeiro_alertas: {
        Row: {
          client_id: string | null
          contrato_id: string | null
          created_at: string
          custo_id: string | null
          id: string
          lido: boolean
          mensagem: string | null
          parcela_id: string | null
          proposal_id: string | null
          resolvido: boolean
          tipo: Database["public"]["Enums"]["fin_alerta_tipo"]
          titulo: string
        }
        Insert: {
          client_id?: string | null
          contrato_id?: string | null
          created_at?: string
          custo_id?: string | null
          id?: string
          lido?: boolean
          mensagem?: string | null
          parcela_id?: string | null
          proposal_id?: string | null
          resolvido?: boolean
          tipo: Database["public"]["Enums"]["fin_alerta_tipo"]
          titulo: string
        }
        Update: {
          client_id?: string | null
          contrato_id?: string | null
          created_at?: string
          custo_id?: string | null
          id?: string
          lido?: boolean
          mensagem?: string | null
          parcela_id?: string | null
          proposal_id?: string | null
          resolvido?: boolean
          tipo?: Database["public"]["Enums"]["fin_alerta_tipo"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_alertas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_alertas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_alertas_custo_id_fkey"
            columns: ["custo_id"]
            isOneToOne: false
            referencedRelation: "financeiro_custos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_alertas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "financeiro_parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_alertas_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_centros_custo: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_comprovantes: {
        Row: {
          contrato_id: string | null
          created_at: string
          custo_id: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          parcela_id: string | null
          recebimento_id: string | null
          storage_path: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          custo_id?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          parcela_id?: string | null
          recebimento_id?: string | null
          storage_path: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          custo_id?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          parcela_id?: string | null
          recebimento_id?: string | null
          storage_path?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_comprovantes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comprovantes_custo_id_fkey"
            columns: ["custo_id"]
            isOneToOne: false
            referencedRelation: "financeiro_custos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comprovantes_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "financeiro_parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comprovantes_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_configuracoes: {
        Row: {
          conta_padrao: string | null
          created_at: string
          dias_alerta_vencimento: number
          id: string
          margem_minima_alerta: number
          observacoes: string | null
          parcelas_padrao: Json
          updated_at: string
        }
        Insert: {
          conta_padrao?: string | null
          created_at?: string
          dias_alerta_vencimento?: number
          id?: string
          margem_minima_alerta?: number
          observacoes?: string | null
          parcelas_padrao?: Json
          updated_at?: string
        }
        Update: {
          conta_padrao?: string | null
          created_at?: string
          dias_alerta_vencimento?: number
          id?: string
          margem_minima_alerta?: number
          observacoes?: string | null
          parcelas_padrao?: Json
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_contratos: {
        Row: {
          client_id: string | null
          condicao_pagamento: string | null
          created_at: string
          created_by: string | null
          data_aprovacao: string
          id: string
          numero: string | null
          observacoes: string | null
          proposal_id: string
          responsavel_comercial: string | null
          status: Database["public"]["Enums"]["fin_status_contrato"]
          titulo: string | null
          updated_at: string
          updated_by: string | null
          valor_aprovado: number
          valor_faturado: number
          valor_recebido: number
        }
        Insert: {
          client_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          proposal_id: string
          responsavel_comercial?: string | null
          status?: Database["public"]["Enums"]["fin_status_contrato"]
          titulo?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_aprovado?: number
          valor_faturado?: number
          valor_recebido?: number
        }
        Update: {
          client_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          proposal_id?: string
          responsavel_comercial?: string | null
          status?: Database["public"]["Enums"]["fin_status_contrato"]
          titulo?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_aprovado?: number
          valor_faturado?: number
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_contratos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_custos: {
        Row: {
          centro_custo_id: string | null
          client_id: string | null
          comprovante_url: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          documento_id: string | null
          execucao_id: string | null
          id: string
          observacoes: string | null
          os_id: string | null
          proposal_id: string | null
          responsavel_id: string | null
          tipo: Database["public"]["Enums"]["fin_tipo_custo"]
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          centro_custo_id?: string | null
          client_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao: string
          documento_id?: string | null
          execucao_id?: string | null
          id?: string
          observacoes?: string | null
          os_id?: string | null
          proposal_id?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["fin_tipo_custo"]
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Update: {
          centro_custo_id?: string | null
          client_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          documento_id?: string | null
          execucao_id?: string | null
          id?: string
          observacoes?: string | null
          os_id?: string | null
          proposal_id?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["fin_tipo_custo"]
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_custos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "financeiro_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_custos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_custos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_custos_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_custos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_custos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_parcelas: {
        Row: {
          client_id: string | null
          contrato_id: string
          created_at: string
          created_by: string | null
          data_recebimento: string | null
          data_vencimento: string
          descricao: string | null
          forma_pagamento:
            | Database["public"]["Enums"]["fin_forma_pagamento"]
            | null
          id: string
          numero: number
          observacoes: string | null
          proposal_id: string | null
          status: Database["public"]["Enums"]["fin_status_parcela"]
          updated_at: string
          updated_by: string | null
          valor: number
          valor_recebido: number
        }
        Insert: {
          client_id?: string | null
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_vencimento: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["fin_forma_pagamento"]
            | null
          id?: string
          numero: number
          observacoes?: string | null
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["fin_status_parcela"]
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_recebido?: number
        }
        Update: {
          client_id?: string | null
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["fin_forma_pagamento"]
            | null
          id?: string
          numero?: number
          observacoes?: string | null
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["fin_status_parcela"]
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_parcelas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_parcelas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_parcelas_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_rateios: {
        Row: {
          contrato_id: string
          created_at: string
          execucao_id: string | null
          id: string
          observacoes: string | null
          percentual: number
          proposal_item_id: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          execucao_id?: string | null
          id?: string
          observacoes?: string | null
          percentual?: number
          proposal_item_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          execucao_id?: string | null
          id?: string
          observacoes?: string | null
          percentual?: number
          proposal_item_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_rateios_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_rateios_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucao_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_rateios_proposal_item_id_fkey"
            columns: ["proposal_item_id"]
            isOneToOne: false
            referencedRelation: "proposal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_recebimentos: {
        Row: {
          comprovante_url: string | null
          conta_recebimento: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_recebimento: string
          forma_pagamento:
            | Database["public"]["Enums"]["fin_forma_pagamento"]
            | null
          id: string
          observacoes: string | null
          parcela_id: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          conta_recebimento?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["fin_forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          parcela_id: string
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          conta_recebimento?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["fin_forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          parcela_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_recebimentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_recebimentos_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "financeiro_parcelas"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_precificacao: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          id: string
          proposal_id: string
          proposal_item_id: string | null
          simulacao_id: string | null
          user_id: string | null
          valor_anterior: number | null
          valor_novo: number | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          id?: string
          proposal_id: string
          proposal_item_id?: string | null
          simulacao_id?: string | null
          user_id?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          id?: string
          proposal_id?: string
          proposal_item_id?: string | null
          simulacao_id?: string | null
          user_id?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_precificacao_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_precificacao_proposal_item_id_fkey"
            columns: ["proposal_item_id"]
            isOneToOne: false
            referencedRelation: "proposal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_precificacao_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes_precificacao"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_acoes_sugeridas: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          interacao_id: string | null
          modulo: Database["public"]["Enums"]["ia_modulo"]
          payload: Json | null
          status: Database["public"]["Enums"]["ia_acao_status"]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          interacao_id?: string | null
          modulo: Database["public"]["Enums"]["ia_modulo"]
          payload?: Json | null
          status?: Database["public"]["Enums"]["ia_acao_status"]
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          interacao_id?: string | null
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          payload?: Json | null
          status?: Database["public"]["Enums"]["ia_acao_status"]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_acoes_sugeridas_interacao_id_fkey"
            columns: ["interacao_id"]
            isOneToOne: false
            referencedRelation: "ia_interacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_alertas: {
        Row: {
          acao_sugerida: string | null
          client_id: string | null
          created_at: string
          descricao: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          gravidade: Database["public"]["Enums"]["ia_alerta_gravidade"]
          id: string
          meta: Json | null
          modulo: Database["public"]["Enums"]["ia_modulo"]
          resolved_at: string | null
          resolved_by: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["ia_alerta_status"]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_sugerida?: string | null
          client_id?: string | null
          created_at?: string
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          gravidade?: Database["public"]["Enums"]["ia_alerta_gravidade"]
          id?: string
          meta?: Json | null
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          resolved_at?: string | null
          resolved_by?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["ia_alerta_status"]
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_sugerida?: string | null
          client_id?: string | null
          created_at?: string
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          gravidade?: Database["public"]["Enums"]["ia_alerta_gravidade"]
          id?: string
          meta?: Json | null
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          resolved_at?: string | null
          resolved_by?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["ia_alerta_status"]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_alertas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_contextos: {
        Row: {
          conteudo: Json
          created_at: string
          fonte: string
          id: string
          interacao_id: string | null
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          fonte: string
          id?: string
          interacao_id?: string | null
        }
        Update: {
          conteudo?: Json
          created_at?: string
          fonte?: string
          id?: string
          interacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_contextos_interacao_id_fkey"
            columns: ["interacao_id"]
            isOneToOne: false
            referencedRelation: "ia_interacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_feedbacks: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          interacao_id: string | null
          nota: number | null
          user_id: string | null
          util: boolean | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          interacao_id?: string | null
          nota?: number | null
          user_id?: string | null
          util?: boolean | null
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          interacao_id?: string | null
          nota?: number | null
          user_id?: string | null
          util?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_feedbacks_interacao_id_fkey"
            columns: ["interacao_id"]
            isOneToOne: false
            referencedRelation: "ia_interacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_interacoes: {
        Row: {
          acao_aceita: boolean | null
          acao_sugerida: string | null
          avaliacao: number | null
          contexto: Json | null
          created_at: string
          entidade_id: string | null
          entidade_tipo: string | null
          erro: string | null
          id: string
          model: string | null
          modulo: Database["public"]["Enums"]["ia_modulo"]
          pergunta: string
          resposta: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          acao_aceita?: boolean | null
          acao_sugerida?: string | null
          avaliacao?: number | null
          contexto?: Json | null
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          erro?: string | null
          id?: string
          model?: string | null
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          pergunta: string
          resposta?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          acao_aceita?: boolean | null
          acao_sugerida?: string | null
          avaliacao?: number | null
          contexto?: Json | null
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          erro?: string | null
          id?: string
          model?: string | null
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          pergunta?: string
          resposta?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ia_prompts: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          modulo: Database["public"]["Enums"]["ia_modulo"]
          nome: string
          objetivo: string | null
          prompt_base: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          modulo: Database["public"]["Enums"]["ia_modulo"]
          nome: string
          objetivo?: string | null
          prompt_base: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          nome?: string
          objetivo?: string | null
          prompt_base?: string
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      ia_resumos: {
        Row: {
          created_at: string
          created_by: string | null
          entidade_id: string | null
          entidade_tipo: string
          id: string
          meta: Json | null
          modulo: Database["public"]["Enums"]["ia_modulo"]
          resumo: string
          titulo: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entidade_id?: string | null
          entidade_tipo: string
          id?: string
          meta?: Json | null
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          resumo: string
          titulo?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entidade_id?: string | null
          entidade_tipo?: string
          id?: string
          meta?: Json | null
          modulo?: Database["public"]["Enums"]["ia_modulo"]
          resumo?: string
          titulo?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          automacao_id: string | null
          client_id: string | null
          created_at: string
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          lida_em: string | null
          link: string | null
          mensagem: string | null
          metadata: Json
          modulo: string
          origem: string
          prioridade: Database["public"]["Enums"]["notif_prioridade"]
          resolvida_em: string | null
          status: Database["public"]["Enums"]["notif_status"]
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          automacao_id?: string | null
          client_id?: string | null
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          metadata?: Json
          modulo?: string
          origem?: string
          prioridade?: Database["public"]["Enums"]["notif_prioridade"]
          resolvida_em?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          automacao_id?: string | null
          client_id?: string | null
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          metadata?: Json
          modulo?: string
          origem?: string
          prioridade?: Database["public"]["Enums"]["notif_prioridade"]
          resolvida_em?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          visivel_para_cliente: boolean
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
          visivel_para_cliente?: boolean
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
          visivel_para_cliente?: boolean
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
          data_aprovacao: string | null
          data_emissao: string
          data_envio: string | null
          data_recusa: string | null
          escopo_geral: string | null
          id: string
          numero: string
          observacao_retroativa: string | null
          observacoes_comerciais: string | null
          observacoes_internas: string | null
          origem_cadastro: Database["public"]["Enums"]["proposal_origem"]
          outras_condicoes: string | null
          proximo_followup: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
          validade: string | null
          valor_total: number
          visivel_para_cliente: boolean
        }
        Insert: {
          aceite_data?: string | null
          assinatura_prestador?: string | null
          assinatura_tomador?: string | null
          client_id?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_emissao?: string
          data_envio?: string | null
          data_recusa?: string | null
          escopo_geral?: string | null
          id?: string
          numero?: string
          observacao_retroativa?: string | null
          observacoes_comerciais?: string | null
          observacoes_internas?: string | null
          origem_cadastro?: Database["public"]["Enums"]["proposal_origem"]
          outras_condicoes?: string | null
          proximo_followup?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          validade?: string | null
          valor_total?: number
          visivel_para_cliente?: boolean
        }
        Update: {
          aceite_data?: string | null
          assinatura_prestador?: string | null
          assinatura_tomador?: string | null
          client_id?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_emissao?: string
          data_envio?: string | null
          data_recusa?: string | null
          escopo_geral?: string | null
          id?: string
          numero?: string
          observacao_retroativa?: string | null
          observacoes_comerciais?: string | null
          observacoes_internas?: string | null
          origem_cadastro?: Database["public"]["Enums"]["proposal_origem"]
          outras_condicoes?: string | null
          proximo_followup?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          validade?: string | null
          valor_total?: number
          visivel_para_cliente?: boolean
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
      simulacao_custos_compartilhados: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          simulacao_id: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          descricao?: string | null
          id?: string
          simulacao_id: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          simulacao_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_custos_compartilhados_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes_precificacao"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacao_itens: {
        Row: {
          aliquota_imposto: number
          created_at: string
          custo_compartilhado_rateado: number
          custo_individual: number
          custo_total: number
          custos_individuais: Json
          desconto_comercial: number
          horas: Json
          id: string
          indicadores: Json
          lucro_desejado: number
          lucro_estimado: number
          margem_desejada: number
          margem_liquida: number
          markup: number
          peso_manual: number
          preco_final: number
          preco_sugerido: number
          proposal_item_id: string
          qtd_funcionarios: number
          simulacao_id: string
          status_margem: string | null
        }
        Insert: {
          aliquota_imposto?: number
          created_at?: string
          custo_compartilhado_rateado?: number
          custo_individual?: number
          custo_total?: number
          custos_individuais?: Json
          desconto_comercial?: number
          horas?: Json
          id?: string
          indicadores?: Json
          lucro_desejado?: number
          lucro_estimado?: number
          margem_desejada?: number
          margem_liquida?: number
          markup?: number
          peso_manual?: number
          preco_final?: number
          preco_sugerido?: number
          proposal_item_id: string
          qtd_funcionarios?: number
          simulacao_id: string
          status_margem?: string | null
        }
        Update: {
          aliquota_imposto?: number
          created_at?: string
          custo_compartilhado_rateado?: number
          custo_individual?: number
          custo_total?: number
          custos_individuais?: Json
          desconto_comercial?: number
          horas?: Json
          id?: string
          indicadores?: Json
          lucro_desejado?: number
          lucro_estimado?: number
          margem_desejada?: number
          margem_liquida?: number
          markup?: number
          peso_manual?: number
          preco_final?: number
          preco_sugerido?: number
          proposal_item_id?: string
          qtd_funcionarios?: number
          simulacao_id?: string
          status_margem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_itens_proposal_item_id_fkey"
            columns: ["proposal_item_id"]
            isOneToOne: false
            referencedRelation: "proposal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacao_itens_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes_precificacao"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacoes_precificacao: {
        Row: {
          aplicada: boolean
          aplicada_em: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string | null
          observacoes: string | null
          parametros: Json
          proposal_id: string
          regra_rateio: Database["public"]["Enums"]["rateio_regra"]
          tipo: Database["public"]["Enums"]["simulacao_tipo"]
          totais: Json
          updated_at: string
        }
        Insert: {
          aplicada?: boolean
          aplicada_em?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string | null
          observacoes?: string | null
          parametros?: Json
          proposal_id: string
          regra_rateio?: Database["public"]["Enums"]["rateio_regra"]
          tipo?: Database["public"]["Enums"]["simulacao_tipo"]
          totais?: Json
          updated_at?: string
        }
        Update: {
          aplicada?: boolean
          aplicada_em?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string | null
          observacoes?: string | null
          parametros?: Json
          proposal_id?: string
          regra_rateio?: Database["public"]["Enums"]["rateio_regra"]
          tipo?: Database["public"]["Enums"]["simulacao_tipo"]
          totais?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_precificacao_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          automacao_id: string | null
          client_id: string | null
          concluida_em: string | null
          created_at: string
          created_by: string | null
          data_prevista: string | null
          descricao: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          modulo_origem: string
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["tarefa_prioridade"]
          responsavel_id: string | null
          status: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          automacao_id?: string | null
          client_id?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          modulo_origem?: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          automacao_id?: string | null
          client_id?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          modulo_origem?: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_checklist: {
        Row: {
          concluido: boolean
          created_at: string
          descricao: string
          id: string
          ordem: number
          tarefa_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          tarefa_id: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_historico: {
        Row: {
          created_at: string
          detalhe: string | null
          evento: string
          id: string
          tarefa_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          evento: string
          id?: string
          tarefa_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          evento?: string
          id?: string
          tarefa_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_historico_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
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
      cliente_log: {
        Args: { _acao: string; _detalhe: string }
        Returns: undefined
      }
      criar_execucoes_da_proposta: {
        Args: { _proposal_id: string }
        Returns: number
      }
      criar_revisao_documento: {
        Args: { _descricao: string; _doc_id: string }
        Returns: string
      }
      crm_converter_lead: { Args: { _lead_id: string }; Returns: string }
      current_client_id: { Args: never; Returns: string }
      financeiro_atualizar_vencidas: { Args: never; Returns: number }
      financeiro_gerar_contrato: {
        Args: { _proposal_id: string }
        Returns: string
      }
      financeiro_registrar_recebimento: {
        Args: {
          _comprovante: string
          _conta: string
          _data: string
          _forma: Database["public"]["Enums"]["fin_forma_pagamento"]
          _obs: string
          _parcela_id: string
          _valor: number
        }
        Returns: string
      }
      gerar_numero_documento: { Args: never; Returns: string }
      gerar_numero_os: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_user: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "comercial" | "tecnico"
      automacao_acao_tipo:
        | "criar_notificacao"
        | "criar_alerta"
        | "criar_tarefa"
        | "criar_followup"
        | "criar_pendencia_documental"
        | "gerar_resumo_ia"
        | "atualizar_status_alerta"
        | "registrar_timeline"
        | "registrar_log"
        | "sugerir_mensagem"
        | "sugerir_email"
        | "sugerir_cobranca"
      automacao_gatilho_tipo:
        | "por_data"
        | "por_vencimento"
        | "mudanca_status"
        | "criacao_registro"
        | "inatividade"
        | "atraso"
        | "evento_sistema"
        | "manual"
      automacao_status_execucao: "sucesso" | "parcial" | "erro" | "ignorada"
      automacao_tipo:
        | "comercial"
        | "operacional"
        | "documental"
        | "financeira"
        | "portal_cliente"
        | "ia_gestao"
        | "sistema"
      checklist_situacao: "pendente" | "em_andamento" | "concluido"
      cliente_com_status: "aberta" | "respondida" | "encerrada"
      cliente_perfil:
        | "admin_cliente"
        | "gestor_sst"
        | "rh"
        | "financeiro"
        | "visualizador"
        | "responsavel_pendencias"
      cliente_user_status:
        | "ativo"
        | "inativo"
        | "convite_pendente"
        | "bloqueado"
      crm_alerta_tipo:
        | "followup_vencido"
        | "proposta_sem_retorno"
        | "oportunidade_parada"
        | "proposta_vencendo"
        | "lead_sem_responsavel"
        | "quente_sem_acao"
      crm_etapa:
        | "novo_lead"
        | "qualificacao"
        | "diagnostico"
        | "proposta_elaborar"
        | "proposta_enviada"
        | "followup"
        | "negociacao"
        | "fechamento_provavel"
        | "ganho"
        | "perdido"
      crm_followup_status:
        | "pendente"
        | "realizado"
        | "reagendado"
        | "cancelado"
        | "sem_resposta"
      crm_followup_tipo:
        | "whatsapp"
        | "ligacao"
        | "email"
        | "reuniao_presencial"
        | "reuniao_online"
        | "visita_comercial"
        | "outro"
      crm_lead_origem:
        | "indicacao"
        | "cliente_antigo"
        | "google"
        | "instagram"
        | "linkedin"
        | "whatsapp"
        | "ligacao_ativa"
        | "email"
        | "evento"
        | "parceiro"
        | "site"
        | "outro"
      crm_lead_status:
        | "novo"
        | "em_qualificacao"
        | "qualificado"
        | "nao_qualificado"
        | "convertido"
        | "perdido"
      crm_prioridade: "baixa" | "normal" | "alta" | "urgente"
      crm_score: "baixo" | "medio" | "alto"
      crm_temperatura: "frio" | "morno" | "quente"
      documento_notificacao_tipo:
        | "revisao_atrasada"
        | "proximo_vencimento"
        | "vencido"
        | "aguardando_cliente"
        | "pendencia"
      documento_origem_anexo:
        | "os"
        | "visita"
        | "cliente"
        | "upload"
        | "evidencia"
      documento_pendente_status:
        | "solicitado"
        | "recebido"
        | "parcial"
        | "pendente"
        | "dispensado"
      documento_recebido_status:
        | "recebido"
        | "parcial"
        | "pendente"
        | "dispensado"
      documento_status:
        | "rascunho"
        | "em_elaboracao"
        | "em_revisao"
        | "aguardando_cliente"
        | "aguardando_assinatura"
        | "aprovado"
        | "emitido"
        | "entregue"
        | "revisado"
        | "cancelado"
        | "vencido"
      documento_tipo:
        | "PGR"
        | "PCMSO"
        | "LTCAT"
        | "Laudo_Insalubridade"
        | "Laudo_Periculosidade"
        | "Avaliacao_Ergonomica"
        | "Avaliacao_Psicossocial"
        | "Parecer_Tecnico"
        | "Relatorio_Tecnico"
        | "Relatorio_Visita"
        | "Relatorio_Medicao"
        | "Certificado_Treinamento"
        | "Lista_Presenca"
        | "OS_SST"
        | "PPP"
        | "Outros"
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
      fin_alerta_tipo:
        | "parcela_vencendo"
        | "parcela_vencida"
        | "pagamento_parcial"
        | "sem_parcelas"
        | "custo_acima_previsto"
        | "margem_baixa"
        | "servico_sem_recebimento"
      fin_forma_pagamento:
        | "pix"
        | "boleto"
        | "transferencia"
        | "cartao"
        | "dinheiro"
        | "outro"
      fin_status_contrato:
        | "aguardando_faturamento"
        | "parcialmente_faturado"
        | "faturado"
        | "parcialmente_recebido"
        | "recebido"
        | "em_atraso"
        | "cancelado"
      fin_status_parcela:
        | "a_vencer"
        | "vencida"
        | "recebida"
        | "recebida_parcial"
        | "cancelada"
      fin_tipo_custo:
        | "deslocamento"
        | "combustivel"
        | "pedagio"
        | "alimentacao"
        | "hospedagem"
        | "terceiros"
        | "laboratorio"
        | "equipamentos"
        | "materiais"
        | "impressoes"
        | "art"
        | "taxas"
        | "mao_de_obra"
        | "outros"
      ia_acao_status:
        | "sugerida"
        | "aplicada"
        | "recusada"
        | "expirada"
        | "ignorada"
        | "editada_aplicada"
        | "erro"
      ia_alerta_gravidade: "baixa" | "media" | "alta" | "critica"
      ia_alerta_status: "novo" | "em_analise" | "resolvido" | "ignorado"
      ia_modulo:
        | "geral"
        | "proposta"
        | "precificacao"
        | "documento"
        | "os"
        | "execucao"
        | "crm"
        | "financeiro"
        | "alertas"
      notif_prioridade: "baixa" | "normal" | "alta" | "critica"
      notif_status: "nao_lida" | "lida" | "resolvida" | "ignorada"
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
      proposal_origem:
        | "nova_proposta"
        | "retroativa"
        | "importacao_manual"
        | "importacao_planilha"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "negociacao"
        | "aprovada"
        | "recusada"
        | "expirada"
        | "cancelada"
      rateio_regra:
        | "igual"
        | "proporcional_venda"
        | "proporcional_custo"
        | "proporcional_horas"
        | "proporcional_quantidade"
        | "manual"
      simulacao_tipo: "individual" | "agrupada"
      tarefa_prioridade: "baixa" | "normal" | "alta" | "critica"
      tarefa_status:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "atrasada"
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
      automacao_acao_tipo: [
        "criar_notificacao",
        "criar_alerta",
        "criar_tarefa",
        "criar_followup",
        "criar_pendencia_documental",
        "gerar_resumo_ia",
        "atualizar_status_alerta",
        "registrar_timeline",
        "registrar_log",
        "sugerir_mensagem",
        "sugerir_email",
        "sugerir_cobranca",
      ],
      automacao_gatilho_tipo: [
        "por_data",
        "por_vencimento",
        "mudanca_status",
        "criacao_registro",
        "inatividade",
        "atraso",
        "evento_sistema",
        "manual",
      ],
      automacao_status_execucao: ["sucesso", "parcial", "erro", "ignorada"],
      automacao_tipo: [
        "comercial",
        "operacional",
        "documental",
        "financeira",
        "portal_cliente",
        "ia_gestao",
        "sistema",
      ],
      checklist_situacao: ["pendente", "em_andamento", "concluido"],
      cliente_com_status: ["aberta", "respondida", "encerrada"],
      cliente_perfil: [
        "admin_cliente",
        "gestor_sst",
        "rh",
        "financeiro",
        "visualizador",
        "responsavel_pendencias",
      ],
      cliente_user_status: [
        "ativo",
        "inativo",
        "convite_pendente",
        "bloqueado",
      ],
      crm_alerta_tipo: [
        "followup_vencido",
        "proposta_sem_retorno",
        "oportunidade_parada",
        "proposta_vencendo",
        "lead_sem_responsavel",
        "quente_sem_acao",
      ],
      crm_etapa: [
        "novo_lead",
        "qualificacao",
        "diagnostico",
        "proposta_elaborar",
        "proposta_enviada",
        "followup",
        "negociacao",
        "fechamento_provavel",
        "ganho",
        "perdido",
      ],
      crm_followup_status: [
        "pendente",
        "realizado",
        "reagendado",
        "cancelado",
        "sem_resposta",
      ],
      crm_followup_tipo: [
        "whatsapp",
        "ligacao",
        "email",
        "reuniao_presencial",
        "reuniao_online",
        "visita_comercial",
        "outro",
      ],
      crm_lead_origem: [
        "indicacao",
        "cliente_antigo",
        "google",
        "instagram",
        "linkedin",
        "whatsapp",
        "ligacao_ativa",
        "email",
        "evento",
        "parceiro",
        "site",
        "outro",
      ],
      crm_lead_status: [
        "novo",
        "em_qualificacao",
        "qualificado",
        "nao_qualificado",
        "convertido",
        "perdido",
      ],
      crm_prioridade: ["baixa", "normal", "alta", "urgente"],
      crm_score: ["baixo", "medio", "alto"],
      crm_temperatura: ["frio", "morno", "quente"],
      documento_notificacao_tipo: [
        "revisao_atrasada",
        "proximo_vencimento",
        "vencido",
        "aguardando_cliente",
        "pendencia",
      ],
      documento_origem_anexo: [
        "os",
        "visita",
        "cliente",
        "upload",
        "evidencia",
      ],
      documento_pendente_status: [
        "solicitado",
        "recebido",
        "parcial",
        "pendente",
        "dispensado",
      ],
      documento_recebido_status: [
        "recebido",
        "parcial",
        "pendente",
        "dispensado",
      ],
      documento_status: [
        "rascunho",
        "em_elaboracao",
        "em_revisao",
        "aguardando_cliente",
        "aguardando_assinatura",
        "aprovado",
        "emitido",
        "entregue",
        "revisado",
        "cancelado",
        "vencido",
      ],
      documento_tipo: [
        "PGR",
        "PCMSO",
        "LTCAT",
        "Laudo_Insalubridade",
        "Laudo_Periculosidade",
        "Avaliacao_Ergonomica",
        "Avaliacao_Psicossocial",
        "Parecer_Tecnico",
        "Relatorio_Tecnico",
        "Relatorio_Visita",
        "Relatorio_Medicao",
        "Certificado_Treinamento",
        "Lista_Presenca",
        "OS_SST",
        "PPP",
        "Outros",
      ],
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
      fin_alerta_tipo: [
        "parcela_vencendo",
        "parcela_vencida",
        "pagamento_parcial",
        "sem_parcelas",
        "custo_acima_previsto",
        "margem_baixa",
        "servico_sem_recebimento",
      ],
      fin_forma_pagamento: [
        "pix",
        "boleto",
        "transferencia",
        "cartao",
        "dinheiro",
        "outro",
      ],
      fin_status_contrato: [
        "aguardando_faturamento",
        "parcialmente_faturado",
        "faturado",
        "parcialmente_recebido",
        "recebido",
        "em_atraso",
        "cancelado",
      ],
      fin_status_parcela: [
        "a_vencer",
        "vencida",
        "recebida",
        "recebida_parcial",
        "cancelada",
      ],
      fin_tipo_custo: [
        "deslocamento",
        "combustivel",
        "pedagio",
        "alimentacao",
        "hospedagem",
        "terceiros",
        "laboratorio",
        "equipamentos",
        "materiais",
        "impressoes",
        "art",
        "taxas",
        "mao_de_obra",
        "outros",
      ],
      ia_acao_status: [
        "sugerida",
        "aplicada",
        "recusada",
        "expirada",
        "ignorada",
        "editada_aplicada",
        "erro",
      ],
      ia_alerta_gravidade: ["baixa", "media", "alta", "critica"],
      ia_alerta_status: ["novo", "em_analise", "resolvido", "ignorado"],
      ia_modulo: [
        "geral",
        "proposta",
        "precificacao",
        "documento",
        "os",
        "execucao",
        "crm",
        "financeiro",
        "alertas",
      ],
      notif_prioridade: ["baixa", "normal", "alta", "critica"],
      notif_status: ["nao_lida", "lida", "resolvida", "ignorada"],
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
      proposal_origem: [
        "nova_proposta",
        "retroativa",
        "importacao_manual",
        "importacao_planilha",
      ],
      proposal_status: [
        "rascunho",
        "enviada",
        "negociacao",
        "aprovada",
        "recusada",
        "expirada",
        "cancelada",
      ],
      rateio_regra: [
        "igual",
        "proporcional_venda",
        "proporcional_custo",
        "proporcional_horas",
        "proporcional_quantidade",
        "manual",
      ],
      simulacao_tipo: ["individual", "agrupada"],
      tarefa_prioridade: ["baixa", "normal", "alta", "critica"],
      tarefa_status: [
        "pendente",
        "em_andamento",
        "concluida",
        "cancelada",
        "atrasada",
      ],
    },
  },
} as const
