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
      exec_status: "pendente" | "em_andamento" | "concluido" | "cancelado"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "negociacao"
        | "aprovada"
        | "recusada"
        | "expirada"
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
      exec_status: ["pendente", "em_andamento", "concluido", "cancelado"],
      proposal_status: [
        "rascunho",
        "enviada",
        "negociacao",
        "aprovada",
        "recusada",
        "expirada",
      ],
    },
  },
} as const
