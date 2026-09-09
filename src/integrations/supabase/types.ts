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
      auditoria: {
        Row: {
          acao: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade_descricao: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          modulo: string
          user_agent: string | null
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade_descricao?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          modulo: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade_descricao?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          modulo?: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      auditoria_historico: {
        Row: {
          acao: string
          arquivado_em: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade_descricao: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          modulo: string
          user_agent: string | null
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          arquivado_em?: string
          created_at: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade_descricao?: string | null
          entidade_id?: string | null
          id: string
          ip?: string | null
          modulo: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          arquivado_em?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade_descricao?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          modulo?: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      avaliacoes_desempenho: {
        Row: {
          avaliador_id: string | null
          avaliador_nome: string | null
          created_at: string
          data_avaliacao: string
          funcionario_id: string
          id: string
          media_ponderada: number
          notas: Json
          observacoes: string | null
          periodo_referencia: string | null
          pontuacao_total: number
          updated_at: string
        }
        Insert: {
          avaliador_id?: string | null
          avaliador_nome?: string | null
          created_at?: string
          data_avaliacao?: string
          funcionario_id: string
          id?: string
          media_ponderada?: number
          notas?: Json
          observacoes?: string | null
          periodo_referencia?: string | null
          pontuacao_total?: number
          updated_at?: string
        }
        Update: {
          avaliador_id?: string | null
          avaliador_nome?: string | null
          created_at?: string
          data_avaliacao?: string
          funcionario_id?: string
          id?: string
          media_ponderada?: number
          notas?: Json
          observacoes?: string | null
          periodo_referencia?: string | null
          pontuacao_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_desempenho_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_modelos: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          cliente_id: string
          cliente_nome: string
          created_at: string
          data_upload: string | null
          descricao: string | null
          disciplina: string
          formato: string
          id: string
          nome: string
          numero: number
          obra: string
          observacoes: string | null
          responsavel_tecnico: string | null
          status: string | null
          tags: Json | null
          thumbnail_url: string | null
          updated_at: string
          versao: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          cliente_id?: string
          cliente_nome?: string
          created_at?: string
          data_upload?: string | null
          descricao?: string | null
          disciplina?: string
          formato?: string
          id?: string
          nome?: string
          numero?: number
          obra?: string
          observacoes?: string | null
          responsavel_tecnico?: string | null
          status?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          updated_at?: string
          versao?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          cliente_id?: string
          cliente_nome?: string
          created_at?: string
          data_upload?: string | null
          descricao?: string | null
          disciplina?: string
          formato?: string
          id?: string
          nome?: string
          numero?: number
          obra?: string
          observacoes?: string | null
          responsavel_tecnico?: string | null
          status?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      bim_pranchas: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          codigo: string
          created_at: string
          data_revisao: string | null
          escala: string | null
          id: string
          modelo_id: string
          observacao: string | null
          revisao: string | null
          titulo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          codigo?: string
          created_at?: string
          data_revisao?: string | null
          escala?: string | null
          id?: string
          modelo_id: string
          observacao?: string | null
          revisao?: string | null
          titulo?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          codigo?: string
          created_at?: string
          data_revisao?: string | null
          escala?: string | null
          id?: string
          modelo_id?: string
          observacao?: string | null
          revisao?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bim_pranchas_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "bim_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_quantitativos: {
        Row: {
          categoria: string
          created_at: string
          cronograma_atividade_id: string | null
          cronograma_id: string | null
          elemento: string
          id: string
          modelo_id: string
          observacao: string | null
          quantidade: number
          unidade: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          cronograma_atividade_id?: string | null
          cronograma_id?: string | null
          elemento?: string
          id?: string
          modelo_id: string
          observacao?: string | null
          quantidade?: number
          unidade?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          cronograma_atividade_id?: string | null
          cronograma_id?: string | null
          elemento?: string
          id?: string
          modelo_id?: string
          observacao?: string | null
          quantidade?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "bim_quantitativos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "bim_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      boletim_assinaturas: {
        Row: {
          base_legal: string
          boletim_id: string
          boletim_numero: number
          codigo_verificador: string
          created_at: string
          hash_documento: string
          id: string
          ip_origem: string | null
          metodo_autenticacao: string
          nivel_assinatura: string
          papel: string
          signatario_cargo: string | null
          signatario_email: string | null
          signatario_matricula: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          base_legal?: string
          boletim_id: string
          boletim_numero: number
          codigo_verificador?: string
          created_at?: string
          hash_documento: string
          id?: string
          ip_origem?: string | null
          metodo_autenticacao?: string
          nivel_assinatura?: string
          papel: string
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          base_legal?: string
          boletim_id?: string
          boletim_numero?: number
          codigo_verificador?: string
          created_at?: string
          hash_documento?: string
          id?: string
          ip_origem?: string | null
          metodo_autenticacao?: string
          nivel_assinatura?: string
          papel?: string
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome?: string
          signatario_user_id?: string
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      boletins_medicao: {
        Row: {
          ano: number
          cliente_id: string | null
          cliente_nome: string | null
          contrato_numero: string | null
          created_at: string
          data_emissao: string | null
          data_envio: string | null
          enviado_cliente: boolean
          frentes: Json
          id: string
          numero: number | null
          objeto: string | null
          obra: string | null
          observacoes: string | null
          processo_numero: string | null
          responsavel_tecnico: string | null
          status: string
          updated_at: string
          valor_total_contrato: number
        }
        Insert: {
          ano?: number
          cliente_id?: string | null
          cliente_nome?: string | null
          contrato_numero?: string | null
          created_at?: string
          data_emissao?: string | null
          data_envio?: string | null
          enviado_cliente?: boolean
          frentes?: Json
          id?: string
          numero?: number | null
          objeto?: string | null
          obra?: string | null
          observacoes?: string | null
          processo_numero?: string | null
          responsavel_tecnico?: string | null
          status?: string
          updated_at?: string
          valor_total_contrato?: number
        }
        Update: {
          ano?: number
          cliente_id?: string | null
          cliente_nome?: string | null
          contrato_numero?: string | null
          created_at?: string
          data_emissao?: string | null
          data_envio?: string | null
          enviado_cliente?: boolean
          frentes?: Json
          id?: string
          numero?: number | null
          objeto?: string | null
          obra?: string | null
          observacoes?: string | null
          processo_numero?: string | null
          responsavel_tecnico?: string | null
          status?: string
          updated_at?: string
          valor_total_contrato?: number
        }
        Relationships: []
      }
      cargos: {
        Row: {
          anexos: Json | null
          cbo: string | null
          created_at: string | null
          data_base_salario: string | null
          descricao: string | null
          epis_padrao: Json
          id: string
          missao: string | null
          nivel: string | null
          nome: string
          nrs: Json | null
          perfil_competencias: string | null
          responsabilidades: string | null
          salario: string | null
          salarios: Json | null
        }
        Insert: {
          anexos?: Json | null
          cbo?: string | null
          created_at?: string | null
          data_base_salario?: string | null
          descricao?: string | null
          epis_padrao?: Json
          id?: string
          missao?: string | null
          nivel?: string | null
          nome?: string
          nrs?: Json | null
          perfil_competencias?: string | null
          responsabilidades?: string | null
          salario?: string | null
          salarios?: Json | null
        }
        Update: {
          anexos?: Json | null
          cbo?: string | null
          created_at?: string | null
          data_base_salario?: string | null
          descricao?: string | null
          epis_padrao?: Json
          id?: string
          missao?: string | null
          nivel?: string | null
          nome?: string
          nrs?: Json | null
          perfil_competencias?: string | null
          responsabilidades?: string | null
          salario?: string | null
          salarios?: Json | null
        }
        Relationships: []
      }
      categorias_compras_classes: {
        Row: {
          codigo: string | null
          created_at: string | null
          id: string
          nome: string
          sub_grupo_id: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          sub_grupo_id?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          sub_grupo_id?: string
        }
        Relationships: []
      }
      categorias_compras_grupos: {
        Row: {
          codigo: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      categorias_compras_subgrupos: {
        Row: {
          codigo: string | null
          created_at: string | null
          grupo_id: string
          id: string
          nome: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          grupo_id?: string
          id?: string
          nome?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          grupo_id?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      categorias_servicos: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      checklist_preenchimentos: {
        Row: {
          checklist_id: string
          checklist_titulo: string | null
          created_at: string | null
          data_preenchimento: string | null
          evidencia_id: string | null
          evidencia_titulo: string | null
          id: string
          itens: Json | null
          observacoes: string | null
          percentual_conformidade: number | null
          responsavel: string | null
          status: string | null
        }
        Insert: {
          checklist_id: string
          checklist_titulo?: string | null
          created_at?: string | null
          data_preenchimento?: string | null
          evidencia_id?: string | null
          evidencia_titulo?: string | null
          id?: string
          itens?: Json | null
          observacoes?: string | null
          percentual_conformidade?: number | null
          responsavel?: string | null
          status?: string | null
        }
        Update: {
          checklist_id?: string
          checklist_titulo?: string | null
          created_at?: string | null
          data_preenchimento?: string | null
          evidencia_id?: string | null
          evidencia_titulo?: string | null
          id?: string
          itens?: Json | null
          observacoes?: string | null
          percentual_conformidade?: number | null
          responsavel?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_preenchimentos_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_preenchimentos_evidencia_id_fkey"
            columns: ["evidencia_id"]
            isOneToOne: false
            referencedRelation: "evidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          categoria: string | null
          created_at: string | null
          descricao: string | null
          id: string
          itens: Json | null
          titulo: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          itens?: Json | null
          titulo?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          itens?: Json | null
          titulo?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          bairro: string | null
          cap: string | null
          celulares: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo: number | null
          complemento: string | null
          contato: string | null
          contratos: Json | null
          created_at: string | null
          data_inicio_contrato: string | null
          descricao: string | null
          email: string | null
          email_compras: string | null
          email_engenharia: string | null
          email_os_bcc: string | null
          email_os_cc: string | null
          email_ss_bcc: string | null
          email_ss_cc: string | null
          endereco: string | null
          esfera: string | null
          grupo_whatsapp: string | null
          id: string
          informacoes_financeiras: Json | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          linhas_fornecimento: Json
          locais: Json | null
          locais_entrega: Json | null
          logo_url: string | null
          logradouro: string | null
          modelo_os_id: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          rel_linha1: string | null
          rel_linha2: string | null
          rel_linha3: string | null
          rel_linha4: string | null
          telefone_celular: string | null
          telefones: Json | null
          telefones_whatsapp: string | null
          tipo: string | null
          uf: string | null
        }
        Insert: {
          bairro?: string | null
          cap?: string | null
          celulares?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo?: number | null
          complemento?: string | null
          contato?: string | null
          contratos?: Json | null
          created_at?: string | null
          data_inicio_contrato?: string | null
          descricao?: string | null
          email?: string | null
          email_compras?: string | null
          email_engenharia?: string | null
          email_os_bcc?: string | null
          email_os_cc?: string | null
          email_ss_bcc?: string | null
          email_ss_cc?: string | null
          endereco?: string | null
          esfera?: string | null
          grupo_whatsapp?: string | null
          id?: string
          informacoes_financeiras?: Json | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          linhas_fornecimento?: Json
          locais?: Json | null
          locais_entrega?: Json | null
          logo_url?: string | null
          logradouro?: string | null
          modelo_os_id?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          rel_linha1?: string | null
          rel_linha2?: string | null
          rel_linha3?: string | null
          rel_linha4?: string | null
          telefone_celular?: string | null
          telefones?: Json | null
          telefones_whatsapp?: string | null
          tipo?: string | null
          uf?: string | null
        }
        Update: {
          bairro?: string | null
          cap?: string | null
          celulares?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo?: number | null
          complemento?: string | null
          contato?: string | null
          contratos?: Json | null
          created_at?: string | null
          data_inicio_contrato?: string | null
          descricao?: string | null
          email?: string | null
          email_compras?: string | null
          email_engenharia?: string | null
          email_os_bcc?: string | null
          email_os_cc?: string | null
          email_ss_bcc?: string | null
          email_ss_cc?: string | null
          endereco?: string | null
          esfera?: string | null
          grupo_whatsapp?: string | null
          id?: string
          informacoes_financeiras?: Json | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          linhas_fornecimento?: Json
          locais?: Json | null
          locais_entrega?: Json | null
          logo_url?: string | null
          logradouro?: string | null
          modelo_os_id?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          rel_linha1?: string | null
          rel_linha2?: string | null
          rel_linha3?: string | null
          rel_linha4?: string | null
          telefone_celular?: string | null
          telefones?: Json | null
          telefones_whatsapp?: string | null
          tipo?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_modelo_os_id_fkey"
            columns: ["modelo_os_id"]
            isOneToOne: false
            referencedRelation: "os_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_credenciais: {
        Row: {
          cliente_id: string
          created_at: string
          senha_portal: string | null
          senha_portal_trocada: boolean
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          senha_portal?: string | null
          senha_portal_trocada?: boolean
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          senha_portal?: string | null
          senha_portal_trocada?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_credenciais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_confirmacoes_valores: {
        Row: {
          alcada: string
          aprovado_por_alcada: string | null
          categoria: string
          confirmado_em: string
          confirmado_por: string | null
          cotacao_id: string | null
          created_at: string
          descricao: string | null
          dias_atraso_aprovacao: number
          diretoria_aceite: boolean
          diretoria_notificada_em: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          impacto_atraso: number
          item_id: string | null
          justificativa: string | null
          limite_alcada_percentual: number
          pedido_id: string | null
          preco_aprovado: number
          preco_confirmado: number
          quantidade: number
          requer_diretoria: boolean
          requisicao_id: string | null
          requisicao_numero: number | null
          unidade_medida: string | null
          updated_at: string
          valor_aprovado: number
          valor_confirmado: number
          variacao_percentual: number
          variacao_valor: number
        }
        Insert: {
          alcada?: string
          aprovado_por_alcada?: string | null
          categoria?: string
          confirmado_em?: string
          confirmado_por?: string | null
          cotacao_id?: string | null
          created_at?: string
          descricao?: string | null
          dias_atraso_aprovacao?: number
          diretoria_aceite?: boolean
          diretoria_notificada_em?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          impacto_atraso?: number
          item_id?: string | null
          justificativa?: string | null
          limite_alcada_percentual?: number
          pedido_id?: string | null
          preco_aprovado?: number
          preco_confirmado?: number
          quantidade?: number
          requer_diretoria?: boolean
          requisicao_id?: string | null
          requisicao_numero?: number | null
          unidade_medida?: string | null
          updated_at?: string
          valor_aprovado?: number
          valor_confirmado?: number
          variacao_percentual?: number
          variacao_valor?: number
        }
        Update: {
          alcada?: string
          aprovado_por_alcada?: string | null
          categoria?: string
          confirmado_em?: string
          confirmado_por?: string | null
          cotacao_id?: string | null
          created_at?: string
          descricao?: string | null
          dias_atraso_aprovacao?: number
          diretoria_aceite?: boolean
          diretoria_notificada_em?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          impacto_atraso?: number
          item_id?: string | null
          justificativa?: string | null
          limite_alcada_percentual?: number
          pedido_id?: string | null
          preco_aprovado?: number
          preco_confirmado?: number
          quantidade?: number
          requer_diretoria?: boolean
          requisicao_id?: string | null
          requisicao_numero?: number | null
          unidade_medida?: string | null
          updated_at?: string
          valor_aprovado?: number
          valor_confirmado?: number
          variacao_percentual?: number
          variacao_valor?: number
        }
        Relationships: []
      }
      comunicacao_avisos: {
        Row: {
          ativo: boolean | null
          conteudo: string
          created_at: string | null
          criado_por: string | null
          destinatarios_emails: Json
          grupos_ids: Json
          id: string
          prioridade: string | null
          titulo: string
        }
        Insert: {
          ativo?: boolean | null
          conteudo?: string
          created_at?: string | null
          criado_por?: string | null
          destinatarios_emails?: Json
          grupos_ids?: Json
          id?: string
          prioridade?: string | null
          titulo?: string
        }
        Update: {
          ativo?: boolean | null
          conteudo?: string
          created_at?: string | null
          criado_por?: string | null
          destinatarios_emails?: Json
          grupos_ids?: Json
          id?: string
          prioridade?: string | null
          titulo?: string
        }
        Relationships: []
      }
      comunicacao_avisos_leitura: {
        Row: {
          aviso_id: string
          id: string
          lido_em: string | null
          usuario_email: string | null
          usuario_nome: string
        }
        Insert: {
          aviso_id: string
          id?: string
          lido_em?: string | null
          usuario_email?: string | null
          usuario_nome?: string
        }
        Update: {
          aviso_id?: string
          id?: string
          lido_em?: string | null
          usuario_email?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicacao_avisos_leitura_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "comunicacao_avisos"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicacao_conversas: {
        Row: {
          created_at: string | null
          criado_por: string | null
          id: string
          tipo: string
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          id?: string
          tipo?: string
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          id?: string
          tipo?: string
          titulo?: string | null
        }
        Relationships: []
      }
      comunicacao_grupos: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string
          id: string
          membros_emails: Json
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          membros_emails?: Json
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          membros_emails?: Json
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      comunicacao_mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string | null
          id: string
          remetente_email: string | null
          remetente_nome: string
        }
        Insert: {
          conteudo?: string
          conversa_id: string
          created_at?: string | null
          id?: string
          remetente_email?: string | null
          remetente_nome?: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string | null
          id?: string
          remetente_email?: string | null
          remetente_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicacao_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "comunicacao_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicacao_notificacoes: {
        Row: {
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          destinatario_email: string | null
          destinatario_nome: string
          id: string
          lida: boolean | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          destinatario_email?: string | null
          destinatario_nome?: string
          id?: string
          lida?: boolean | null
          tipo?: string | null
          titulo?: string
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          destinatario_email?: string | null
          destinatario_nome?: string
          id?: string
          lida?: boolean | null
          tipo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      comunicacao_participantes: {
        Row: {
          conversa_id: string
          created_at: string | null
          id: string
          usuario_email: string | null
          usuario_nome: string
        }
        Insert: {
          conversa_id: string
          created_at?: string | null
          id?: string
          usuario_email?: string | null
          usuario_nome?: string
        }
        Update: {
          conversa_id?: string
          created_at?: string | null
          id?: string
          usuario_email?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicacao_participantes_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "comunicacao_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_transferencias_saldo: {
        Row: {
          cliente_destino_id: string
          cliente_destino_nome: string | null
          cliente_origem_id: string
          cliente_origem_nome: string | null
          contrato_destino_id: string
          contrato_destino_numero: string | null
          contrato_origem_id: string
          contrato_origem_numero: string | null
          created_at: string
          data: string
          id: string
          motivo: string | null
          saldo_destino_antes: number | null
          saldo_destino_depois: number | null
          saldo_origem_antes: number | null
          saldo_origem_depois: number | null
          tipo_saldo: string
          usuario_id: string | null
          usuario_nome: string | null
          valor: number
        }
        Insert: {
          cliente_destino_id: string
          cliente_destino_nome?: string | null
          cliente_origem_id: string
          cliente_origem_nome?: string | null
          contrato_destino_id: string
          contrato_destino_numero?: string | null
          contrato_origem_id: string
          contrato_origem_numero?: string | null
          created_at?: string
          data?: string
          id?: string
          motivo?: string | null
          saldo_destino_antes?: number | null
          saldo_destino_depois?: number | null
          saldo_origem_antes?: number | null
          saldo_origem_depois?: number | null
          tipo_saldo: string
          usuario_id?: string | null
          usuario_nome?: string | null
          valor: number
        }
        Update: {
          cliente_destino_id?: string
          cliente_destino_nome?: string | null
          cliente_origem_id?: string
          cliente_origem_nome?: string | null
          contrato_destino_id?: string
          contrato_destino_numero?: string | null
          contrato_origem_id?: string
          contrato_origem_numero?: string | null
          created_at?: string
          data?: string
          id?: string
          motivo?: string | null
          saldo_destino_antes?: number | null
          saldo_destino_depois?: number | null
          saldo_origem_antes?: number | null
          saldo_origem_depois?: number | null
          tipo_saldo?: string
          usuario_id?: string | null
          usuario_nome?: string | null
          valor?: number
        }
        Relationships: []
      }
      contratos_terceiros: {
        Row: {
          aditivos: Json
          anexos: Json
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          fornecedor_cnpj: string | null
          fornecedor_endereco: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          medicoes_vinculadas: Json
          numero: number | null
          objeto: string
          obra_id: string | null
          obra_nome: string | null
          observacoes: string | null
          status: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          aditivos?: Json
          anexos?: Json
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_endereco?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          medicoes_vinculadas?: Json
          numero?: number | null
          objeto: string
          obra_id?: string | null
          obra_nome?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          aditivos?: Json
          anexos?: Json
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_endereco?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          medicoes_vinculadas?: Json
          numero?: number | null
          objeto?: string
          obra_id?: string | null
          obra_nome?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      cotacao_convites: {
        Row: {
          comprador: string
          cotacao_id: string
          cotacao_numero: number
          created_at: string | null
          expires_at: string | null
          fornecedor_email: string
          fornecedor_id: string
          fornecedor_nome: string
          id: string
          itens: Json
          status: string
          token: string
        }
        Insert: {
          comprador: string
          cotacao_id: string
          cotacao_numero: number
          created_at?: string | null
          expires_at?: string | null
          fornecedor_email?: string
          fornecedor_id: string
          fornecedor_nome: string
          id?: string
          itens?: Json
          status?: string
          token?: string
        }
        Update: {
          comprador?: string
          cotacao_id?: string
          cotacao_numero?: number
          created_at?: string | null
          expires_at?: string | null
          fornecedor_email?: string
          fornecedor_id?: string
          fornecedor_nome?: string
          id?: string
          itens?: Json
          status?: string
          token?: string
        }
        Relationships: []
      }
      cotacao_propostas_externas: {
        Row: {
          condicao_pagamento: string | null
          convite_id: string
          created_at: string | null
          id: string
          itens: Json
          observacao: string | null
          prazo_entrega: string | null
          validade_proposta: string | null
          valor_frete: number
          valor_operacao: number
          valor_seguro: number
          valor_total: number
        }
        Insert: {
          condicao_pagamento?: string | null
          convite_id: string
          created_at?: string | null
          id?: string
          itens?: Json
          observacao?: string | null
          prazo_entrega?: string | null
          validade_proposta?: string | null
          valor_frete?: number
          valor_operacao?: number
          valor_seguro?: number
          valor_total?: number
        }
        Update: {
          condicao_pagamento?: string | null
          convite_id?: string
          created_at?: string | null
          id?: string
          itens?: Json
          observacao?: string | null
          prazo_entrega?: string | null
          validade_proposta?: string | null
          valor_frete?: number
          valor_operacao?: number
          valor_seguro?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_propostas_externas_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: false
            referencedRelation: "cotacao_convites"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes_compras: {
        Row: {
          comprador: string | null
          created_at: string | null
          data_criacao: string | null
          fornecedor_vencedor_id: string | null
          id: string
          itens_vencedores: Json | null
          justificativa_escolha: string | null
          numero: number
          propostas: Json | null
          requisicao_id: string | null
          requisicao_numero: number | null
          status: string | null
        }
        Insert: {
          comprador?: string | null
          created_at?: string | null
          data_criacao?: string | null
          fornecedor_vencedor_id?: string | null
          id?: string
          itens_vencedores?: Json | null
          justificativa_escolha?: string | null
          numero?: number
          propostas?: Json | null
          requisicao_id?: string | null
          requisicao_numero?: number | null
          status?: string | null
        }
        Update: {
          comprador?: string | null
          created_at?: string | null
          data_criacao?: string | null
          fornecedor_vencedor_id?: string | null
          id?: string
          itens_vencedores?: Json | null
          justificativa_escolha?: string | null
          numero?: number
          propostas?: Json | null
          requisicao_id?: string | null
          requisicao_numero?: number | null
          status?: string | null
        }
        Relationships: []
      }
      cronogramas: {
        Row: {
          atividades: Json
          cliente_id: string
          cliente_nome: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          granularidade: string
          id: string
          numero: number
          obra: string
          observacoes: string | null
          periodos: Json
          responsavel: string | null
          status: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          atividades?: Json
          cliente_id?: string
          cliente_nome?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          granularidade?: string
          id?: string
          numero?: number
          obra?: string
          observacoes?: string | null
          periodos?: Json
          responsavel?: string | null
          status?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          atividades?: Json
          cliente_id?: string
          cliente_nome?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          granularidade?: string
          id?: string
          numero?: number
          obra?: string
          observacoes?: string | null
          periodos?: Json
          responsavel?: string | null
          status?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresa: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          certificado_a1_cnpj: string | null
          certificado_a1_emissor: string | null
          certificado_a1_nome: string | null
          certificado_a1_status: string | null
          certificado_a1_titular: string | null
          certificado_a1_url: string | null
          certificado_a1_validade: string | null
          certificado_a1_validado_em: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          contato: string | null
          created_at: string | null
          email: string | null
          email_compras: string | null
          email_engenharia: string | null
          email_estoque: string | null
          email_relatorios: string | null
          email_rh: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          logradouro: string | null
          nfe_ambiente: string | null
          nfe_uf_autor: string | null
          nome_fantasia: string | null
          numero: string | null
          razao_social: string
          site: string | null
          telefone: string | null
          uf: string | null
          whatsapp_comercial: string | null
          whatsapp_compras: string | null
          whatsapp_coordenacao: string | null
          whatsapp_diretoria: string | null
          whatsapp_engenharia: string | null
          whatsapp_faturamento: string | null
          whatsapp_rh: string | null
          whatsapp_segtrab: string | null
          whatsapp_selecao: string | null
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          certificado_a1_cnpj?: string | null
          certificado_a1_emissor?: string | null
          certificado_a1_nome?: string | null
          certificado_a1_status?: string | null
          certificado_a1_titular?: string | null
          certificado_a1_url?: string | null
          certificado_a1_validade?: string | null
          certificado_a1_validado_em?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string | null
          email?: string | null
          email_compras?: string | null
          email_engenharia?: string | null
          email_estoque?: string | null
          email_relatorios?: string | null
          email_rh?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nfe_ambiente?: string | null
          nfe_uf_autor?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string
          site?: string | null
          telefone?: string | null
          uf?: string | null
          whatsapp_comercial?: string | null
          whatsapp_compras?: string | null
          whatsapp_coordenacao?: string | null
          whatsapp_diretoria?: string | null
          whatsapp_engenharia?: string | null
          whatsapp_faturamento?: string | null
          whatsapp_rh?: string | null
          whatsapp_segtrab?: string | null
          whatsapp_selecao?: string | null
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          certificado_a1_cnpj?: string | null
          certificado_a1_emissor?: string | null
          certificado_a1_nome?: string | null
          certificado_a1_status?: string | null
          certificado_a1_titular?: string | null
          certificado_a1_url?: string | null
          certificado_a1_validade?: string | null
          certificado_a1_validado_em?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string | null
          email?: string | null
          email_compras?: string | null
          email_engenharia?: string | null
          email_estoque?: string | null
          email_relatorios?: string | null
          email_rh?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nfe_ambiente?: string | null
          nfe_uf_autor?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string
          site?: string | null
          telefone?: string | null
          uf?: string | null
          whatsapp_comercial?: string | null
          whatsapp_compras?: string | null
          whatsapp_coordenacao?: string | null
          whatsapp_diretoria?: string | null
          whatsapp_engenharia?: string | null
          whatsapp_faturamento?: string | null
          whatsapp_rh?: string | null
          whatsapp_segtrab?: string | null
          whatsapp_selecao?: string | null
        }
        Relationships: []
      }
      empresa_credenciais: {
        Row: {
          certificado_a1_senha: string | null
          created_at: string
          empresa_id: string
          updated_at: string
        }
        Insert: {
          certificado_a1_senha?: string | null
          created_at?: string
          empresa_id: string
          updated_at?: string
        }
        Update: {
          certificado_a1_senha?: string | null
          created_at?: string
          empresa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_credenciais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_dados_bancarios: {
        Row: {
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          conta: string | null
          empresa_id: string
          tipo_conta: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          empresa_id: string
          tipo_conta?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          empresa_id?: string
          tipo_conta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_dados_bancarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      epis_catalogo: {
        Row: {
          ca: string | null
          codigo: string | null
          created_at: string
          descricao: string
          id: string
          observacao: string | null
          updated_at: string
          validade_meses: number | null
        }
        Insert: {
          ca?: string | null
          codigo?: string | null
          created_at?: string
          descricao: string
          id?: string
          observacao?: string | null
          updated_at?: string
          validade_meses?: number | null
        }
        Update: {
          ca?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string
          id?: string
          observacao?: string | null
          updated_at?: string
          validade_meses?: number | null
        }
        Relationships: []
      }
      epis_devolucoes: {
        Row: {
          anexo_path: string | null
          ca: string | null
          codigo: string | null
          condicao: string | null
          confirmado_em: string | null
          cpf_verificado: boolean
          created_at: string
          data_devolucao: string
          data_entrega: string | null
          descricao: string
          destino: string | null
          epi_item_id: string | null
          expires_at: string
          funcionario_id: string
          id: string
          ip: string | null
          motivo: string
          observacao: string | null
          quantidade: number
          registrado_por: string | null
          selfie_hash: string | null
          selfie_hash_2: string | null
          selfie_path: string | null
          selfie_path_2: string | null
          status: string
          telefone_envio: string | null
          token: string | null
          updated_at: string
          user_agent: string | null
          verificado_em: string | null
        }
        Insert: {
          anexo_path?: string | null
          ca?: string | null
          codigo?: string | null
          condicao?: string | null
          confirmado_em?: string | null
          cpf_verificado?: boolean
          created_at?: string
          data_devolucao?: string
          data_entrega?: string | null
          descricao: string
          destino?: string | null
          epi_item_id?: string | null
          expires_at?: string
          funcionario_id: string
          id?: string
          ip?: string | null
          motivo?: string
          observacao?: string | null
          quantidade?: number
          registrado_por?: string | null
          selfie_hash?: string | null
          selfie_hash_2?: string | null
          selfie_path?: string | null
          selfie_path_2?: string | null
          status?: string
          telefone_envio?: string | null
          token?: string | null
          updated_at?: string
          user_agent?: string | null
          verificado_em?: string | null
        }
        Update: {
          anexo_path?: string | null
          ca?: string | null
          codigo?: string | null
          condicao?: string | null
          confirmado_em?: string | null
          cpf_verificado?: boolean
          created_at?: string
          data_devolucao?: string
          data_entrega?: string | null
          descricao?: string
          destino?: string | null
          epi_item_id?: string | null
          expires_at?: string
          funcionario_id?: string
          id?: string
          ip?: string | null
          motivo?: string
          observacao?: string | null
          quantidade?: number
          registrado_por?: string | null
          selfie_hash?: string | null
          selfie_hash_2?: string | null
          selfie_path?: string | null
          selfie_path_2?: string | null
          status?: string
          telefone_envio?: string | null
          token?: string | null
          updated_at?: string
          user_agent?: string | null
          verificado_em?: string | null
        }
        Relationships: []
      }
      epis_recebimentos: {
        Row: {
          confirmado_em: string | null
          cpf_verificado: boolean
          created_at: string
          enviado_por: string | null
          epis_ids: string[]
          epis_snapshot: Json
          expires_at: string
          funcionario_id: string
          id: string
          ip: string | null
          selfie_hash: string | null
          selfie_hash_2: string | null
          selfie_path: string | null
          selfie_path_2: string | null
          status: string
          telefone_envio: string | null
          token: string
          updated_at: string
          user_agent: string | null
          verificado_em: string | null
        }
        Insert: {
          confirmado_em?: string | null
          cpf_verificado?: boolean
          created_at?: string
          enviado_por?: string | null
          epis_ids?: string[]
          epis_snapshot?: Json
          expires_at?: string
          funcionario_id: string
          id?: string
          ip?: string | null
          selfie_hash?: string | null
          selfie_hash_2?: string | null
          selfie_path?: string | null
          selfie_path_2?: string | null
          status?: string
          telefone_envio?: string | null
          token: string
          updated_at?: string
          user_agent?: string | null
          verificado_em?: string | null
        }
        Update: {
          confirmado_em?: string | null
          cpf_verificado?: boolean
          created_at?: string
          enviado_por?: string | null
          epis_ids?: string[]
          epis_snapshot?: Json
          expires_at?: string
          funcionario_id?: string
          id?: string
          ip?: string | null
          selfie_hash?: string | null
          selfie_hash_2?: string | null
          selfie_path?: string | null
          selfie_path_2?: string | null
          status?: string
          telefone_envio?: string | null
          token?: string
          updated_at?: string
          user_agent?: string | null
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epis_recebimentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos: {
        Row: {
          calibracao_notificado_15d: boolean | null
          calibracao_notificado_30d: boolean | null
          calibracao_notificado_7d: boolean | null
          capacidade_btu: string | null
          certificado_calibracao_url: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cod_lasant: string | null
          contrato: string | null
          corrente: string | null
          created_at: string | null
          data_aquisicao: string | null
          data_calibracao: string | null
          data_garantia: string | null
          email_responsavel_calibracao: string | null
          equipamento: string | null
          expectativa_vida: string | null
          fabricante: string | null
          foto_url: string | null
          fotos: Json
          frequencia_calibracao_meses: number | null
          grupo: string | null
          id: string
          laboratorio_calibracao: string | null
          local_descricao: string | null
          local_id: string | null
          manual_url: string | null
          modelo: string | null
          nivel_manutencao: string | null
          nivel_risco: string | null
          notificado_15d: boolean
          notificado_30d: boolean
          notificado_7d: boolean
          numero_anvisa: string | null
          numero_certificado_calibracao: string | null
          observacoes_calibracao: string | null
          pavimento_descricao: string | null
          pavimento_id: string | null
          plano_manutencao: string | null
          potencia: string | null
          requer_calibracao: boolean | null
          responsavel_calibracao: string | null
          responsavel_email: string | null
          responsavel_telefone: string | null
          serie: string | null
          setor_descricao: string | null
          setor_id: string | null
          situacao: string | null
          subgrupo: string | null
          tag: string | null
          telefone_responsavel_calibracao: string | null
          tensao: string | null
          validade_calibracao: string | null
          valor: number | null
        }
        Insert: {
          calibracao_notificado_15d?: boolean | null
          calibracao_notificado_30d?: boolean | null
          calibracao_notificado_7d?: boolean | null
          capacidade_btu?: string | null
          certificado_calibracao_url?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cod_lasant?: string | null
          contrato?: string | null
          corrente?: string | null
          created_at?: string | null
          data_aquisicao?: string | null
          data_calibracao?: string | null
          data_garantia?: string | null
          email_responsavel_calibracao?: string | null
          equipamento?: string | null
          expectativa_vida?: string | null
          fabricante?: string | null
          foto_url?: string | null
          fotos?: Json
          frequencia_calibracao_meses?: number | null
          grupo?: string | null
          id?: string
          laboratorio_calibracao?: string | null
          local_descricao?: string | null
          local_id?: string | null
          manual_url?: string | null
          modelo?: string | null
          nivel_manutencao?: string | null
          nivel_risco?: string | null
          notificado_15d?: boolean
          notificado_30d?: boolean
          notificado_7d?: boolean
          numero_anvisa?: string | null
          numero_certificado_calibracao?: string | null
          observacoes_calibracao?: string | null
          pavimento_descricao?: string | null
          pavimento_id?: string | null
          plano_manutencao?: string | null
          potencia?: string | null
          requer_calibracao?: boolean | null
          responsavel_calibracao?: string | null
          responsavel_email?: string | null
          responsavel_telefone?: string | null
          serie?: string | null
          setor_descricao?: string | null
          setor_id?: string | null
          situacao?: string | null
          subgrupo?: string | null
          tag?: string | null
          telefone_responsavel_calibracao?: string | null
          tensao?: string | null
          validade_calibracao?: string | null
          valor?: number | null
        }
        Update: {
          calibracao_notificado_15d?: boolean | null
          calibracao_notificado_30d?: boolean | null
          calibracao_notificado_7d?: boolean | null
          capacidade_btu?: string | null
          certificado_calibracao_url?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cod_lasant?: string | null
          contrato?: string | null
          corrente?: string | null
          created_at?: string | null
          data_aquisicao?: string | null
          data_calibracao?: string | null
          data_garantia?: string | null
          email_responsavel_calibracao?: string | null
          equipamento?: string | null
          expectativa_vida?: string | null
          fabricante?: string | null
          foto_url?: string | null
          fotos?: Json
          frequencia_calibracao_meses?: number | null
          grupo?: string | null
          id?: string
          laboratorio_calibracao?: string | null
          local_descricao?: string | null
          local_id?: string | null
          manual_url?: string | null
          modelo?: string | null
          nivel_manutencao?: string | null
          nivel_risco?: string | null
          notificado_15d?: boolean
          notificado_30d?: boolean
          notificado_7d?: boolean
          numero_anvisa?: string | null
          numero_certificado_calibracao?: string | null
          observacoes_calibracao?: string | null
          pavimento_descricao?: string | null
          pavimento_id?: string | null
          plano_manutencao?: string | null
          potencia?: string | null
          requer_calibracao?: boolean | null
          responsavel_calibracao?: string | null
          responsavel_email?: string | null
          responsavel_telefone?: string | null
          serie?: string | null
          setor_descricao?: string | null
          setor_id?: string | null
          situacao?: string | null
          subgrupo?: string | null
          tag?: string | null
          telefone_responsavel_calibracao?: string | null
          tensao?: string | null
          validade_calibracao?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      equipamentos_calibracoes_historico: {
        Row: {
          certificado_url: string | null
          created_at: string
          custo: number | null
          data_calibracao: string
          equipamento_id: string
          equipamento_nome: string
          equipamento_tag: string | null
          id: string
          laboratorio: string | null
          numero_certificado: string | null
          observacoes: string | null
          responsavel: string | null
          resultado: string | null
          validade_calibracao: string | null
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string
          custo?: number | null
          data_calibracao: string
          equipamento_id: string
          equipamento_nome?: string
          equipamento_tag?: string | null
          id?: string
          laboratorio?: string | null
          numero_certificado?: string | null
          observacoes?: string | null
          responsavel?: string | null
          resultado?: string | null
          validade_calibracao?: string | null
        }
        Update: {
          certificado_url?: string | null
          created_at?: string
          custo?: number | null
          data_calibracao?: string
          equipamento_id?: string
          equipamento_nome?: string
          equipamento_tag?: string | null
          id?: string
          laboratorio?: string | null
          numero_certificado?: string | null
          observacoes?: string | null
          responsavel?: string | null
          resultado?: string | null
          validade_calibracao?: string | null
        }
        Relationships: []
      }
      equipamentos_laudos_assinaturas: {
        Row: {
          base_legal: string
          codigo_verificador: string
          created_at: string
          hash_documento: string
          id: string
          ip_origem: string | null
          laudo_id: string
          laudo_numero: number
          papel: string
          responsavel_tecnico_nome: string | null
          responsavel_tecnico_registro: string | null
          signatario_cargo: string | null
          signatario_email: string | null
          signatario_matricula: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento: string
          id?: string
          ip_origem?: string | null
          laudo_id: string
          laudo_numero: number
          papel?: string
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento?: string
          id?: string
          ip_origem?: string | null
          laudo_id?: string
          laudo_numero?: number
          papel?: string
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome?: string
          signatario_user_id?: string
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_laudos_assinaturas_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_laudos_condenacao"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos_laudos_condenacao: {
        Row: {
          anexos_orcamentos: Json
          ano_fabricacao: string | null
          conclusao_condicoes: string | null
          created_at: string
          created_by: string | null
          custo_reparo: number | null
          data_aquisicao: string | null
          data_emissao: string
          data_inspecao: string | null
          equipamento_id: string | null
          equipamento_nome: string | null
          equipamento_tag: string | null
          estado_conservacao: string | null
          fotos: Json
          historico: string | null
          id: string
          insp_condicoes_eletricas: string | null
          insp_condicoes_fisicas: string | null
          insp_condicoes_mecanicas: string | null
          insp_funcionalidade: string | null
          local_inspecao: string | null
          localizacao: string | null
          marca: string | null
          modelo: string | null
          motivos_condenacao: Json
          numero: number
          observacoes_outros: string | null
          outros_anexos: Json
          parecer: string | null
          patrimonio: string | null
          registro_profissional: string | null
          responsavel_tecnico: string | null
          serie: string | null
          tipo: string | null
          updated_at: string
          valor_novo_equivalente: number | null
          valor_residual: number | null
        }
        Insert: {
          anexos_orcamentos?: Json
          ano_fabricacao?: string | null
          conclusao_condicoes?: string | null
          created_at?: string
          created_by?: string | null
          custo_reparo?: number | null
          data_aquisicao?: string | null
          data_emissao?: string
          data_inspecao?: string | null
          equipamento_id?: string | null
          equipamento_nome?: string | null
          equipamento_tag?: string | null
          estado_conservacao?: string | null
          fotos?: Json
          historico?: string | null
          id?: string
          insp_condicoes_eletricas?: string | null
          insp_condicoes_fisicas?: string | null
          insp_condicoes_mecanicas?: string | null
          insp_funcionalidade?: string | null
          local_inspecao?: string | null
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          motivos_condenacao?: Json
          numero?: number
          observacoes_outros?: string | null
          outros_anexos?: Json
          parecer?: string | null
          patrimonio?: string | null
          registro_profissional?: string | null
          responsavel_tecnico?: string | null
          serie?: string | null
          tipo?: string | null
          updated_at?: string
          valor_novo_equivalente?: number | null
          valor_residual?: number | null
        }
        Update: {
          anexos_orcamentos?: Json
          ano_fabricacao?: string | null
          conclusao_condicoes?: string | null
          created_at?: string
          created_by?: string | null
          custo_reparo?: number | null
          data_aquisicao?: string | null
          data_emissao?: string
          data_inspecao?: string | null
          equipamento_id?: string | null
          equipamento_nome?: string | null
          equipamento_tag?: string | null
          estado_conservacao?: string | null
          fotos?: Json
          historico?: string | null
          id?: string
          insp_condicoes_eletricas?: string | null
          insp_condicoes_fisicas?: string | null
          insp_condicoes_mecanicas?: string | null
          insp_funcionalidade?: string | null
          local_inspecao?: string | null
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          motivos_condenacao?: Json
          numero?: number
          observacoes_outros?: string | null
          outros_anexos?: Json
          parecer?: string | null
          patrimonio?: string | null
          registro_profissional?: string | null
          responsavel_tecnico?: string | null
          serie?: string | null
          tipo?: string | null
          updated_at?: string
          valor_novo_equivalente?: number | null
          valor_residual?: number | null
        }
        Relationships: []
      }
      estoque_inventarios: {
        Row: {
          created_at: string | null
          data_inventario: string | null
          id: string
          itens: Json | null
          local: string
          observacao: string | null
          status: string | null
          usuario: string | null
        }
        Insert: {
          created_at?: string | null
          data_inventario?: string | null
          id?: string
          itens?: Json | null
          local?: string
          observacao?: string | null
          status?: string | null
          usuario?: string | null
        }
        Update: {
          created_at?: string | null
          data_inventario?: string | null
          id?: string
          itens?: Json | null
          local?: string
          observacao?: string | null
          status?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          cod_sco: string | null
          created_at: string | null
          data_movimentacao: string | null
          deposito_destino: string | null
          deposito_origem: string | null
          descricao_sco: string | null
          documento_ref: string | null
          fator_conversao: number | null
          fornecedor_nome: string | null
          id: string
          local: string
          lote: string | null
          material_codigo: string
          material_descricao: string
          material_id: string
          observacao: string | null
          quantidade: number
          quantidade_sco: number | null
          tipo: string
          usuario: string | null
          validade: string | null
          valor_unitario: number | null
        }
        Insert: {
          cod_sco?: string | null
          created_at?: string | null
          data_movimentacao?: string | null
          deposito_destino?: string | null
          deposito_origem?: string | null
          descricao_sco?: string | null
          documento_ref?: string | null
          fator_conversao?: number | null
          fornecedor_nome?: string | null
          id?: string
          local?: string
          lote?: string | null
          material_codigo?: string
          material_descricao?: string
          material_id?: string
          observacao?: string | null
          quantidade?: number
          quantidade_sco?: number | null
          tipo?: string
          usuario?: string | null
          validade?: string | null
          valor_unitario?: number | null
        }
        Update: {
          cod_sco?: string | null
          created_at?: string | null
          data_movimentacao?: string | null
          deposito_destino?: string | null
          deposito_origem?: string | null
          descricao_sco?: string | null
          documento_ref?: string | null
          fator_conversao?: number | null
          fornecedor_nome?: string | null
          id?: string
          local?: string
          lote?: string | null
          material_codigo?: string
          material_descricao?: string
          material_id?: string
          observacao?: string | null
          quantidade?: number
          quantidade_sco?: number | null
          tipo?: string
          usuario?: string | null
          validade?: string | null
          valor_unitario?: number | null
        }
        Relationships: []
      }
      eventogramas: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          contrato_numero: string | null
          created_at: string
          data_assinatura: string | null
          descricao: string | null
          eventos: Json
          id: string
          numero: number
          obra: string
          observacoes: string | null
          responsavel: string | null
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          contrato_numero?: string | null
          created_at?: string
          data_assinatura?: string | null
          descricao?: string | null
          eventos?: Json
          id?: string
          numero?: number
          obra: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          contrato_numero?: string | null
          created_at?: string
          data_assinatura?: string | null
          descricao?: string | null
          eventos?: Json
          id?: string
          numero?: number
          obra?: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: []
      }
      evidencias: {
        Row: {
          anexos: Json | null
          centro_custo_id: string | null
          centro_custo_nome: string | null
          created_at: string | null
          data_fato_gerador: string | null
          data_registro: string | null
          descricao: string | null
          historico: Json | null
          id: string
          numero: number
          observacoes: string | null
          palavras_chave: string | null
          processo_vinculado: string | null
          responsavel_registro: string | null
          setor: string | null
          status: string | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          anexos?: Json | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          created_at?: string | null
          data_fato_gerador?: string | null
          data_registro?: string | null
          descricao?: string | null
          historico?: Json | null
          id?: string
          numero?: number
          observacoes?: string | null
          palavras_chave?: string | null
          processo_vinculado?: string | null
          responsavel_registro?: string | null
          setor?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
        }
        Update: {
          anexos?: Json | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          created_at?: string | null
          data_fato_gerador?: string | null
          data_registro?: string | null
          descricao?: string | null
          historico?: Json | null
          id?: string
          numero?: number
          observacoes?: string | null
          palavras_chave?: string | null
          processo_vinculado?: string | null
          responsavel_registro?: string | null
          setor?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      exames_periodicos: {
        Row: {
          anexo_aso_url: string | null
          clinica: string | null
          created_at: string
          data_realizacao: string | null
          data_vencimento: string
          funcionario_email: string | null
          funcionario_id: string
          funcionario_nome: string
          funcionario_telefone: string | null
          id: string
          notificado_10d: boolean
          notificado_20d: boolean
          notificado_30d: boolean
          observacoes: string | null
          resultado: string | null
          tipo_exame: string
        }
        Insert: {
          anexo_aso_url?: string | null
          clinica?: string | null
          created_at?: string
          data_realizacao?: string | null
          data_vencimento: string
          funcionario_email?: string | null
          funcionario_id: string
          funcionario_nome: string
          funcionario_telefone?: string | null
          id?: string
          notificado_10d?: boolean
          notificado_20d?: boolean
          notificado_30d?: boolean
          observacoes?: string | null
          resultado?: string | null
          tipo_exame: string
        }
        Update: {
          anexo_aso_url?: string | null
          clinica?: string | null
          created_at?: string
          data_realizacao?: string | null
          data_vencimento?: string
          funcionario_email?: string | null
          funcionario_id?: string
          funcionario_nome?: string
          funcionario_telefone?: string | null
          id?: string
          notificado_10d?: boolean
          notificado_20d?: boolean
          notificado_30d?: boolean
          observacoes?: string | null
          resultado?: string | null
          tipo_exame?: string
        }
        Relationships: []
      }
      fabricantes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      ferias: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          created_at: string
          data_fim_gozo: string | null
          data_inicio_gozo: string | null
          data_limite_concessao: string
          dias_abonados: number | null
          dias_direito: number
          dias_gozados: number | null
          funcionario_id: string
          funcionario_nome: string | null
          id: string
          notificado_30d: boolean | null
          notificado_60d: boolean | null
          notificado_vencida: boolean | null
          observacoes: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status: string
          updated_at: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          created_at?: string
          data_fim_gozo?: string | null
          data_inicio_gozo?: string | null
          data_limite_concessao: string
          dias_abonados?: number | null
          dias_direito?: number
          dias_gozados?: number | null
          funcionario_id: string
          funcionario_nome?: string | null
          id?: string
          notificado_30d?: boolean | null
          notificado_60d?: boolean | null
          notificado_vencida?: boolean | null
          observacoes?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status?: string
          updated_at?: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          created_at?: string
          data_fim_gozo?: string | null
          data_inicio_gozo?: string | null
          data_limite_concessao?: string
          dias_abonados?: number | null
          dias_direito?: number
          dias_gozados?: number | null
          funcionario_id?: string
          funcionario_nome?: string | null
          id?: string
          notificado_30d?: boolean | null
          notificado_60d?: boolean | null
          notificado_vencida?: boolean | null
          observacoes?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ferias_relatorio_envios: {
        Row: {
          created_at: string
          destinatario: string
          erro: string | null
          excel_url: string | null
          id: string
          motivo: string | null
          pdf_url: string | null
          resumo: Json
          status: string
        }
        Insert: {
          created_at?: string
          destinatario: string
          erro?: string | null
          excel_url?: string | null
          id?: string
          motivo?: string | null
          pdf_url?: string | null
          resumo?: Json
          status?: string
        }
        Update: {
          created_at?: string
          destinatario?: string
          erro?: string | null
          excel_url?: string | null
          id?: string
          motivo?: string | null
          pdf_url?: string | null
          resumo?: Json
          status?: string
        }
        Relationships: []
      }
      ferramentas: {
        Row: {
          centro_custo_atual_id: string | null
          centro_custo_atual_nome: string | null
          certificado_calibracao_url: string | null
          codigo: string
          created_at: string | null
          data_aquisicao: string | null
          data_calibracao: string | null
          descricao: string
          estado_conservacao: string | null
          foto_url: string | null
          id: string
          marca: string | null
          modelo: string | null
          nota_fiscal: string | null
          numero_serie: string | null
          observacoes: string | null
          patrimonio: string | null
          status: string | null
          validade_calibracao: string | null
          valor_aquisicao: number | null
        }
        Insert: {
          centro_custo_atual_id?: string | null
          centro_custo_atual_nome?: string | null
          certificado_calibracao_url?: string | null
          codigo?: string
          created_at?: string | null
          data_aquisicao?: string | null
          data_calibracao?: string | null
          descricao?: string
          estado_conservacao?: string | null
          foto_url?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          nota_fiscal?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          patrimonio?: string | null
          status?: string | null
          validade_calibracao?: string | null
          valor_aquisicao?: number | null
        }
        Update: {
          centro_custo_atual_id?: string | null
          centro_custo_atual_nome?: string | null
          certificado_calibracao_url?: string | null
          codigo?: string
          created_at?: string | null
          data_aquisicao?: string | null
          data_calibracao?: string | null
          descricao?: string
          estado_conservacao?: string | null
          foto_url?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          nota_fiscal?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          patrimonio?: string | null
          status?: string | null
          validade_calibracao?: string | null
          valor_aquisicao?: number | null
        }
        Relationships: []
      }
      ferramentas_emprestimos: {
        Row: {
          aprovado_por: string | null
          centro_custo_destino_id: string | null
          centro_custo_destino_nome: string | null
          centro_custo_origem_id: string | null
          centro_custo_origem_nome: string | null
          created_at: string | null
          data_aprovacao: string | null
          data_devolucao_prevista: string | null
          data_devolucao_real: string | null
          data_solicitacao: string | null
          ferramenta_descricao: string | null
          ferramenta_id: string
          id: string
          observacoes: string | null
          solicitante: string | null
          status: string | null
        }
        Insert: {
          aprovado_por?: string | null
          centro_custo_destino_id?: string | null
          centro_custo_destino_nome?: string | null
          centro_custo_origem_id?: string | null
          centro_custo_origem_nome?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          data_devolucao_prevista?: string | null
          data_devolucao_real?: string | null
          data_solicitacao?: string | null
          ferramenta_descricao?: string | null
          ferramenta_id?: string
          id?: string
          observacoes?: string | null
          solicitante?: string | null
          status?: string | null
        }
        Update: {
          aprovado_por?: string | null
          centro_custo_destino_id?: string | null
          centro_custo_destino_nome?: string | null
          centro_custo_origem_id?: string | null
          centro_custo_origem_nome?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          data_devolucao_prevista?: string | null
          data_devolucao_real?: string | null
          data_solicitacao?: string | null
          ferramenta_descricao?: string | null
          ferramenta_id?: string
          id?: string
          observacoes?: string | null
          solicitante?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ferramentas_historico: {
        Row: {
          created_at: string | null
          data_evento: string | null
          descricao: string | null
          ferramenta_descricao: string | null
          ferramenta_id: string
          id: string
          tipo: string | null
          usuario: string | null
        }
        Insert: {
          created_at?: string | null
          data_evento?: string | null
          descricao?: string | null
          ferramenta_descricao?: string | null
          ferramenta_id?: string
          id?: string
          tipo?: string | null
          usuario?: string | null
        }
        Update: {
          created_at?: string | null
          data_evento?: string | null
          descricao?: string | null
          ferramenta_descricao?: string | null
          ferramenta_id?: string
          id?: string
          tipo?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      ferramentas_vinculos: {
        Row: {
          created_at: string | null
          data_devolucao: string | null
          data_vinculo: string | null
          ferramenta_descricao: string | null
          ferramenta_id: string
          ferramentas_descricoes: Json | null
          ferramentas_ids: Json | null
          funcionario_id: string
          funcionario_nome: string | null
          id: string
          observacoes: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          data_devolucao?: string | null
          data_vinculo?: string | null
          ferramenta_descricao?: string | null
          ferramenta_id?: string
          ferramentas_descricoes?: Json | null
          ferramentas_ids?: Json | null
          funcionario_id?: string
          funcionario_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          data_devolucao?: string | null
          data_vinculo?: string | null
          ferramenta_descricao?: string | null
          ferramenta_id?: string
          ferramentas_descricoes?: Json | null
          ferramentas_ids?: Json | null
          funcionario_id?: string
          funcionario_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
        }
        Relationships: []
      }
      fin_centros_custo: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          codigo: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_condicoes_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          dias_parcelas: Json
          id: string
          intervalo_dias: number | null
          nome: string
          num_parcelas: number
          observacao: string | null
          percentual_entrada: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dias_parcelas?: Json
          id?: string
          intervalo_dias?: number | null
          nome: string
          num_parcelas?: number
          observacao?: string | null
          percentual_entrada?: number | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dias_parcelas?: Json
          id?: string
          intervalo_dias?: number | null
          nome?: string
          num_parcelas?: number
          observacao?: string | null
          percentual_entrada?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          conta: string | null
          created_at: string
          id: string
          nome: string
          observacao: string | null
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_contas_pagar: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          centro_custo_id: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          juridico_parcela_id: string | null
          observacao: string | null
          origem: string | null
          parcela_num: number
          parcela_total: number
          pedido_compra_id: string | null
          plano_conta_id: string | null
          recorrencia: Json | null
          status: string
          updated_at: string
          valor_pago: number
          valor_total: number
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          juridico_parcela_id?: string | null
          observacao?: string | null
          origem?: string | null
          parcela_num?: number
          parcela_total?: number
          pedido_compra_id?: string | null
          plano_conta_id?: string | null
          recorrencia?: Json | null
          status?: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          centro_custo_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          juridico_parcela_id?: string | null
          observacao?: string | null
          origem?: string | null
          parcela_num?: number
          parcela_total?: number
          pedido_compra_id?: string | null
          plano_conta_id?: string | null
          recorrencia?: Json | null
          status?: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_pagar_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "fin_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_contas_receber: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          created_at: string
          data_emissao: string | null
          data_recebimento: string | null
          data_vencimento: string
          descricao: string
          faturamento_id: string | null
          id: string
          observacao: string | null
          origem: string | null
          parcela_num: number
          parcela_total: number
          plano_conta_id: string | null
          status: string
          updated_at: string
          valor_recebido: number
          valor_total: number
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_recebimento?: string | null
          data_vencimento: string
          descricao: string
          faturamento_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string | null
          parcela_num?: number
          parcela_total?: number
          plano_conta_id?: string | null
          status?: string
          updated_at?: string
          valor_recebido?: number
          valor_total?: number
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string
          faturamento_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string | null
          parcela_num?: number
          parcela_total?: number
          plano_conta_id?: string | null
          status?: string
          updated_at?: string
          valor_recebido?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_receber_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "fin_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_lancamentos: {
        Row: {
          anexos: Json
          centro_custo_id: string | null
          conciliado: boolean
          conta_bancaria_id: string
          conta_destino_id: string | null
          conta_pagar_id: string | null
          conta_receber_id: string | null
          created_at: string
          data: string
          descricao: string | null
          id: string
          plano_conta_id: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          anexos?: Json
          centro_custo_id?: string | null
          conciliado?: boolean
          conta_bancaria_id: string
          conta_destino_id?: string | null
          conta_pagar_id?: string | null
          conta_receber_id?: string | null
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          plano_conta_id?: string | null
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          anexos?: Json
          centro_custo_id?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string
          conta_destino_id?: string | null
          conta_pagar_id?: string | null
          conta_receber_id?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          plano_conta_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_lancamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "fin_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_movimentos_ofx: {
        Row: {
          conciliado: boolean
          conta_bancaria_id: string
          created_at: string
          data: string
          descricao: string | null
          fitid: string
          id: string
          lancamento_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          conciliado?: boolean
          conta_bancaria_id: string
          created_at?: string
          data: string
          descricao?: string | null
          fitid: string
          id?: string
          lancamento_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          conciliado?: boolean
          conta_bancaria_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          fitid?: string
          id?: string
          lancamento_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_movimentos_ofx_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentos_ofx_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_plano_contas: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          id: string
          nome: string
          parent_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome: string
          parent_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome?: string
          parent_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_plano_contas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_cliente_historico: {
        Row: {
          alterado_por: string | null
          autorizado_por_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          detalhes: Json
          funcionario_id: string
          id: string
          justificativa: string | null
        }
        Insert: {
          alterado_por?: string | null
          autorizado_por_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          detalhes?: Json
          funcionario_id: string
          id?: string
          justificativa?: string | null
        }
        Update: {
          alterado_por?: string | null
          autorizado_por_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          detalhes?: Json
          funcionario_id?: string
          id?: string
          justificativa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_cliente_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_cliente_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_transferencia_solicitacoes: {
        Row: {
          cliente_atual_id: string | null
          cliente_atual_nome: string | null
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          decisao_observacao: string | null
          detalhes: Json
          funcionario_id: string
          funcionario_nome: string | null
          id: string
          justificativa: string | null
          novo_cliente_id: string
          novo_cliente_nome: string | null
          solicitado_em: string
          solicitado_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cliente_atual_id?: string | null
          cliente_atual_nome?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decisao_observacao?: string | null
          detalhes?: Json
          funcionario_id: string
          funcionario_nome?: string | null
          id?: string
          justificativa?: string | null
          novo_cliente_id: string
          novo_cliente_nome?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cliente_atual_id?: string | null
          cliente_atual_nome?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decisao_observacao?: string | null
          detalhes?: Json
          funcionario_id?: string
          funcionario_nome?: string | null
          id?: string
          justificativa?: string | null
          novo_cliente_id?: string
          novo_cliente_nome?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      funcionarios: {
        Row: {
          agencia: string | null
          altura: string | null
          anexos_documentos: Json | null
          bairro: string | null
          banco: string | null
          cargo_id: string | null
          categoria_cnh: string | null
          cep: string | null
          certificado_reservista: string | null
          chave_pix: string | null
          cidade: string | null
          cliente_id: string | null
          cnh: string | null
          complemento: string | null
          conselho_anexos: Json
          conselho_classe: string | null
          conselho_data_expedicao: string | null
          conselho_numero: string | null
          conselho_uf: string | null
          conta: string | null
          contatos_emergencia: Json
          cpf: string
          created_at: string | null
          ctps: string | null
          curso_formacao: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          dependentes: Json | null
          email: string | null
          epis: Json | null
          escolaridade: string | null
          estado_civil: string | null
          experiencia_fim: string | null
          experiencia_inicio: string | null
          experiencia_notificado_10d_final: boolean | null
          experiencia_notificado_10d_primeira: boolean | null
          experiencia_primeira_etapa: string | null
          experiencia_renovado: boolean | null
          foto: string | null
          id: string
          jornada_trabalho: string | null
          logradouro: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome: string
          nome_mae: string | null
          nome_pai: string | null
          nrs: Json | null
          numero: string | null
          observacoes: string | null
          orgao_emissor: string | null
          passagens: Json | null
          pcd: boolean | null
          pensao_alimenticia: Json
          peso: string | null
          pis: string | null
          rg: string | null
          salario: string | null
          secao_eleitoral: string | null
          serie_ctps: string | null
          sexo: string | null
          status: string | null
          tamanho_calca: string | null
          tamanho_calcado: string | null
          tamanho_camisa: string | null
          telefone: string | null
          telefone_whatsapp: string
          tipo_conta: string | null
          tipo_contrato: string | null
          tipo_pcd: string | null
          titulo_eleitor: string | null
          uf: string | null
          uniformes: Json
          validade_cnh: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          agencia?: string | null
          altura?: string | null
          anexos_documentos?: Json | null
          bairro?: string | null
          banco?: string | null
          cargo_id?: string | null
          categoria_cnh?: string | null
          cep?: string | null
          certificado_reservista?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cnh?: string | null
          complemento?: string | null
          conselho_anexos?: Json
          conselho_classe?: string | null
          conselho_data_expedicao?: string | null
          conselho_numero?: string | null
          conselho_uf?: string | null
          conta?: string | null
          contatos_emergencia?: Json
          cpf: string
          created_at?: string | null
          ctps?: string | null
          curso_formacao?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          dependentes?: Json | null
          email?: string | null
          epis?: Json | null
          escolaridade?: string | null
          estado_civil?: string | null
          experiencia_fim?: string | null
          experiencia_inicio?: string | null
          experiencia_notificado_10d_final?: boolean | null
          experiencia_notificado_10d_primeira?: boolean | null
          experiencia_primeira_etapa?: string | null
          experiencia_renovado?: boolean | null
          foto?: string | null
          id?: string
          jornada_trabalho?: string | null
          logradouro?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome: string
          nome_mae?: string | null
          nome_pai?: string | null
          nrs?: Json | null
          numero?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          passagens?: Json | null
          pcd?: boolean | null
          pensao_alimenticia?: Json
          peso?: string | null
          pis?: string | null
          rg?: string | null
          salario?: string | null
          secao_eleitoral?: string | null
          serie_ctps?: string | null
          sexo?: string | null
          status?: string | null
          tamanho_calca?: string | null
          tamanho_calcado?: string | null
          tamanho_camisa?: string | null
          telefone?: string | null
          telefone_whatsapp?: string
          tipo_conta?: string | null
          tipo_contrato?: string | null
          tipo_pcd?: string | null
          titulo_eleitor?: string | null
          uf?: string | null
          uniformes?: Json
          validade_cnh?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          agencia?: string | null
          altura?: string | null
          anexos_documentos?: Json | null
          bairro?: string | null
          banco?: string | null
          cargo_id?: string | null
          categoria_cnh?: string | null
          cep?: string | null
          certificado_reservista?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cnh?: string | null
          complemento?: string | null
          conselho_anexos?: Json
          conselho_classe?: string | null
          conselho_data_expedicao?: string | null
          conselho_numero?: string | null
          conselho_uf?: string | null
          conta?: string | null
          contatos_emergencia?: Json
          cpf?: string
          created_at?: string | null
          ctps?: string | null
          curso_formacao?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          dependentes?: Json | null
          email?: string | null
          epis?: Json | null
          escolaridade?: string | null
          estado_civil?: string | null
          experiencia_fim?: string | null
          experiencia_inicio?: string | null
          experiencia_notificado_10d_final?: boolean | null
          experiencia_notificado_10d_primeira?: boolean | null
          experiencia_primeira_etapa?: string | null
          experiencia_renovado?: boolean | null
          foto?: string | null
          id?: string
          jornada_trabalho?: string | null
          logradouro?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome?: string
          nome_mae?: string | null
          nome_pai?: string | null
          nrs?: Json | null
          numero?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          passagens?: Json | null
          pcd?: boolean | null
          pensao_alimenticia?: Json
          peso?: string | null
          pis?: string | null
          rg?: string | null
          salario?: string | null
          secao_eleitoral?: string | null
          serie_ctps?: string | null
          sexo?: string | null
          status?: string | null
          tamanho_calca?: string | null
          tamanho_calcado?: string | null
          tamanho_camisa?: string | null
          telefone?: string | null
          telefone_whatsapp?: string
          tipo_conta?: string | null
          tipo_contrato?: string | null
          tipo_pcd?: string | null
          titulo_eleitor?: string | null
          uf?: string | null
          uniformes?: Json
          validade_cnh?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: []
      }
      i0_items: {
        Row: {
          ano: number
          cod_sco: string | null
          created_at: string | null
          id: string
          mes: number
          valor: number | null
        }
        Insert: {
          ano?: number
          cod_sco?: string | null
          created_at?: string | null
          id?: string
          mes?: number
          valor?: number | null
        }
        Update: {
          ano?: number
          cod_sco?: string | null
          created_at?: string | null
          id?: string
          mes?: number
          valor?: number | null
        }
        Relationships: []
      }
      juridico_audiencias: {
        Row: {
          created_at: string | null
          data_audiencia: string
          hora: string | null
          id: string
          local: string | null
          notificado_10d: boolean
          notificado_2d: boolean
          notificado_5d: boolean
          notificado_7d: boolean
          observacoes: string | null
          processo_id: string
          processo_numero: string
          status: string | null
          tipo: string | null
          vara: string | null
        }
        Insert: {
          created_at?: string | null
          data_audiencia: string
          hora?: string | null
          id?: string
          local?: string | null
          notificado_10d?: boolean
          notificado_2d?: boolean
          notificado_5d?: boolean
          notificado_7d?: boolean
          observacoes?: string | null
          processo_id: string
          processo_numero?: string
          status?: string | null
          tipo?: string | null
          vara?: string | null
        }
        Update: {
          created_at?: string | null
          data_audiencia?: string
          hora?: string | null
          id?: string
          local?: string | null
          notificado_10d?: boolean
          notificado_2d?: boolean
          notificado_5d?: boolean
          notificado_7d?: boolean
          observacoes?: string | null
          processo_id?: string
          processo_numero?: string
          status?: string | null
          tipo?: string | null
          vara?: string | null
        }
        Relationships: []
      }
      juridico_contatos_notificacao: {
        Row: {
          ativo: boolean
          cpf: string | null
          crc: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          oab: string | null
          observacoes: string | null
          telefone_whatsapp: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          crc?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          oab?: string | null
          observacoes?: string | null
          telefone_whatsapp?: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          crc?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          oab?: string | null
          observacoes?: string | null
          telefone_whatsapp?: string
          tipo?: string
        }
        Relationships: []
      }
      juridico_decisoes_pagamentos: {
        Row: {
          agencia: string | null
          anexos: Json
          banco: string | null
          conta: string | null
          created_at: string
          data_decisao: string | null
          data_entrada: string | null
          descricao: string | null
          id: string
          juiz: string | null
          observacoes: string | null
          patrono_email: string | null
          patrono_escritorio: string | null
          patrono_nome: string | null
          patrono_oab: string | null
          patrono_telefone: string | null
          pix_chave: string | null
          pix_tipo: string | null
          primeiro_vencimento: string | null
          processo_id: string
          processo_numero: string | null
          qtd_parcelas: number
          status: string
          tipo: string
          tipo_conta: string | null
          titular_documento: string | null
          titular_nome: string | null
          updated_at: string
          valor_custas: number
          valor_entrada: number
          valor_honorarios: number
          valor_principal: number
          valor_total: number
        }
        Insert: {
          agencia?: string | null
          anexos?: Json
          banco?: string | null
          conta?: string | null
          created_at?: string
          data_decisao?: string | null
          data_entrada?: string | null
          descricao?: string | null
          id?: string
          juiz?: string | null
          observacoes?: string | null
          patrono_email?: string | null
          patrono_escritorio?: string | null
          patrono_nome?: string | null
          patrono_oab?: string | null
          patrono_telefone?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          primeiro_vencimento?: string | null
          processo_id: string
          processo_numero?: string | null
          qtd_parcelas?: number
          status?: string
          tipo?: string
          tipo_conta?: string | null
          titular_documento?: string | null
          titular_nome?: string | null
          updated_at?: string
          valor_custas?: number
          valor_entrada?: number
          valor_honorarios?: number
          valor_principal?: number
          valor_total?: number
        }
        Update: {
          agencia?: string | null
          anexos?: Json
          banco?: string | null
          conta?: string | null
          created_at?: string
          data_decisao?: string | null
          data_entrada?: string | null
          descricao?: string | null
          id?: string
          juiz?: string | null
          observacoes?: string | null
          patrono_email?: string | null
          patrono_escritorio?: string | null
          patrono_nome?: string | null
          patrono_oab?: string | null
          patrono_telefone?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          primeiro_vencimento?: string | null
          processo_id?: string
          processo_numero?: string | null
          qtd_parcelas?: number
          status?: string
          tipo?: string
          tipo_conta?: string | null
          titular_documento?: string | null
          titular_nome?: string | null
          updated_at?: string
          valor_custas?: number
          valor_entrada?: number
          valor_honorarios?: number
          valor_principal?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "juridico_decisoes_pagamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_trabalhistas"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_parcelas: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          decisao_id: string
          forma_pagamento: string | null
          id: string
          notificado_1d: boolean
          notificado_3d: boolean
          numero: number
          observacoes: string | null
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          decisao_id: string
          forma_pagamento?: string | null
          id?: string
          notificado_1d?: boolean
          notificado_3d?: boolean
          numero?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          decisao_id?: string
          forma_pagamento?: string | null
          id?: string
          notificado_1d?: boolean
          notificado_3d?: boolean
          numero?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "juridico_parcelas_decisao_id_fkey"
            columns: ["decisao_id"]
            isOneToOne: false
            referencedRelation: "juridico_decisoes_pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_artigo_equipamentos: {
        Row: {
          artigo_id: string
          created_at: string | null
          equipamento_descricao: string | null
          equipamento_id: string
          id: string
        }
        Insert: {
          artigo_id: string
          created_at?: string | null
          equipamento_descricao?: string | null
          equipamento_id: string
          id?: string
        }
        Update: {
          artigo_id?: string
          created_at?: string | null
          equipamento_descricao?: string | null
          equipamento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_artigo_equipamentos_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "kb_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_artigo_os: {
        Row: {
          artigo_id: string
          created_at: string | null
          id: string
          os_id: string
          os_numero: number | null
        }
        Insert: {
          artigo_id: string
          created_at?: string | null
          id?: string
          os_id: string
          os_numero?: number | null
        }
        Update: {
          artigo_id?: string
          created_at?: string | null
          id?: string
          os_id?: string
          os_numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_artigo_os_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "kb_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_artigos: {
        Row: {
          anexos: Json | null
          autor_email: string | null
          autor_nome: string | null
          categoria_id: string | null
          categoria_nome: string | null
          conteudo: string
          created_at: string | null
          embedding: string | null
          id: string
          nao_uteis: number | null
          resumo: string | null
          status: string | null
          tags: Json | null
          titulo: string
          updated_at: string | null
          uteis: number | null
          visualizacoes: number | null
        }
        Insert: {
          anexos?: Json | null
          autor_email?: string | null
          autor_nome?: string | null
          categoria_id?: string | null
          categoria_nome?: string | null
          conteudo?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          nao_uteis?: number | null
          resumo?: string | null
          status?: string | null
          tags?: Json | null
          titulo: string
          updated_at?: string | null
          uteis?: number | null
          visualizacoes?: number | null
        }
        Update: {
          anexos?: Json | null
          autor_email?: string | null
          autor_nome?: string | null
          categoria_id?: string | null
          categoria_nome?: string | null
          conteudo?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          nao_uteis?: number | null
          resumo?: string | null
          status?: string | null
          tags?: Json | null
          titulo?: string
          updated_at?: string | null
          uteis?: number | null
          visualizacoes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_artigos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "kb_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categorias: {
        Row: {
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      kb_faq: {
        Row: {
          categoria_id: string | null
          categoria_nome: string | null
          created_at: string | null
          embedding: string | null
          id: string
          ordem: number | null
          pergunta: string
          resposta: string
          tags: Json | null
          updated_at: string | null
          visualizacoes: number | null
        }
        Insert: {
          categoria_id?: string | null
          categoria_nome?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          ordem?: number | null
          pergunta: string
          resposta?: string
          tags?: Json | null
          updated_at?: string | null
          visualizacoes?: number | null
        }
        Update: {
          categoria_id?: string | null
          categoria_nome?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          ordem?: number | null
          pergunta?: string
          resposta?: string
          tags?: Json | null
          updated_at?: string | null
          visualizacoes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_faq_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "kb_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          anexos: Json | null
          created_at: string | null
          criado_em: string | null
          data: string | null
          data_fim: string | null
          dias_falta: number | null
          funcionario_id: string
          horas_extras: number | null
          id: string
          motivo: string | null
          observacao: string | null
          percentual: number | null
          tipo: string | null
          tipo_advertencia: string | null
          tipo_falta: string | null
        }
        Insert: {
          anexos?: Json | null
          created_at?: string | null
          criado_em?: string | null
          data?: string | null
          data_fim?: string | null
          dias_falta?: number | null
          funcionario_id?: string
          horas_extras?: number | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          percentual?: number | null
          tipo?: string | null
          tipo_advertencia?: string | null
          tipo_falta?: string | null
        }
        Update: {
          anexos?: Json | null
          created_at?: string | null
          criado_em?: string | null
          data?: string | null
          data_fim?: string | null
          dias_falta?: number | null
          funcionario_id?: string
          horas_extras?: number | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          percentual?: number | null
          tipo?: string | null
          tipo_advertencia?: string | null
          tipo_falta?: string | null
        }
        Relationships: []
      }
      licitacoes: {
        Row: {
          cidade: string | null
          created_at: string | null
          criterio_julgamento: string | null
          data_publicacao: string | null
          data_sessao: string | null
          estado: string | null
          exigencia_garantia: boolean | null
          exigencia_visita_tecnica: boolean | null
          grau_interesse: string | null
          id: string
          link_edital: string | null
          modalidade: string | null
          numero_edital: string | null
          numero_processo: string | null
          objeto_detalhado: string | null
          objeto_resumido: string | null
          observacoes: string | null
          orgao_licitante: string | null
          portal_disputa: string | null
          possibilidade_prorrogacao: boolean | null
          prazo_contratual: string | null
          prazo_esclarecimento: string | null
          prazo_impugnacao: string | null
          probabilidade_exito: string | null
          regime_execucao: string | null
          responsavel_interno: string | null
          status: string | null
          uasg: string | null
          valor_estimado: number | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string | null
          criterio_julgamento?: string | null
          data_publicacao?: string | null
          data_sessao?: string | null
          estado?: string | null
          exigencia_garantia?: boolean | null
          exigencia_visita_tecnica?: boolean | null
          grau_interesse?: string | null
          id?: string
          link_edital?: string | null
          modalidade?: string | null
          numero_edital?: string | null
          numero_processo?: string | null
          objeto_detalhado?: string | null
          objeto_resumido?: string | null
          observacoes?: string | null
          orgao_licitante?: string | null
          portal_disputa?: string | null
          possibilidade_prorrogacao?: boolean | null
          prazo_contratual?: string | null
          prazo_esclarecimento?: string | null
          prazo_impugnacao?: string | null
          probabilidade_exito?: string | null
          regime_execucao?: string | null
          responsavel_interno?: string | null
          status?: string | null
          uasg?: string | null
          valor_estimado?: number | null
        }
        Update: {
          cidade?: string | null
          created_at?: string | null
          criterio_julgamento?: string | null
          data_publicacao?: string | null
          data_sessao?: string | null
          estado?: string | null
          exigencia_garantia?: boolean | null
          exigencia_visita_tecnica?: boolean | null
          grau_interesse?: string | null
          id?: string
          link_edital?: string | null
          modalidade?: string | null
          numero_edital?: string | null
          numero_processo?: string | null
          objeto_detalhado?: string | null
          objeto_resumido?: string | null
          observacoes?: string | null
          orgao_licitante?: string | null
          portal_disputa?: string | null
          possibilidade_prorrogacao?: boolean | null
          prazo_contratual?: string | null
          prazo_esclarecimento?: string | null
          prazo_impugnacao?: string | null
          probabilidade_exito?: string | null
          regime_execucao?: string | null
          responsavel_interno?: string | null
          status?: string | null
          uasg?: string | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      licitacoes_analises: {
        Row: {
          analise_ia_gerada_em: string | null
          analise_ia_markdown: string | null
          analista: string | null
          created_at: string | null
          data_analise: string | null
          decisao_participar: string | null
          documentos_obrigatorios: string | null
          exigencia_garantia_proposta: string | null
          exigencia_vistoria: string | null
          exigencias_economicas: string | null
          exigencias_equipe: string | null
          exigencias_tecnicas: string | null
          id: string
          licitacao_id: string
          necessidade_cat_crea_cau: string | null
          necessidade_certidoes: string | null
          observacoes: string | null
          oportunidades_impugnacao: string | null
          pontos_restritivos: string | null
          resumo_objeto: string | null
          riscos_juridicos: string | null
        }
        Insert: {
          analise_ia_gerada_em?: string | null
          analise_ia_markdown?: string | null
          analista?: string | null
          created_at?: string | null
          data_analise?: string | null
          decisao_participar?: string | null
          documentos_obrigatorios?: string | null
          exigencia_garantia_proposta?: string | null
          exigencia_vistoria?: string | null
          exigencias_economicas?: string | null
          exigencias_equipe?: string | null
          exigencias_tecnicas?: string | null
          id?: string
          licitacao_id: string
          necessidade_cat_crea_cau?: string | null
          necessidade_certidoes?: string | null
          observacoes?: string | null
          oportunidades_impugnacao?: string | null
          pontos_restritivos?: string | null
          resumo_objeto?: string | null
          riscos_juridicos?: string | null
        }
        Update: {
          analise_ia_gerada_em?: string | null
          analise_ia_markdown?: string | null
          analista?: string | null
          created_at?: string | null
          data_analise?: string | null
          decisao_participar?: string | null
          documentos_obrigatorios?: string | null
          exigencia_garantia_proposta?: string | null
          exigencia_vistoria?: string | null
          exigencias_economicas?: string | null
          exigencias_equipe?: string | null
          exigencias_tecnicas?: string | null
          id?: string
          licitacao_id?: string
          necessidade_cat_crea_cau?: string | null
          necessidade_certidoes?: string | null
          observacoes?: string | null
          oportunidades_impugnacao?: string | null
          pontos_restritivos?: string | null
          resumo_objeto?: string | null
          riscos_juridicos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitacoes_analises_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacoes_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          categoria: string | null
          created_at: string | null
          data_emissao: string | null
          data_validade: string | null
          id: string
          licitacoes_vinculadas: Json | null
          nome: string
          observacoes: string | null
          orgao_emissor: string | null
          status: string | null
          tipo_documental: string | null
          versao: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          categoria?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          id?: string
          licitacoes_vinculadas?: Json | null
          nome?: string
          observacoes?: string | null
          orgao_emissor?: string | null
          status?: string | null
          tipo_documental?: string | null
          versao?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          categoria?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          id?: string
          licitacoes_vinculadas?: Json | null
          nome?: string
          observacoes?: string | null
          orgao_emissor?: string | null
          status?: string | null
          tipo_documental?: string | null
          versao?: number | null
        }
        Relationships: []
      }
      licitacoes_telefones_notificacao: {
        Row: {
          created_at: string | null
          id: string
          nome_contato: string
          telefone: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_contato?: string
          telefone?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_contato?: string
          telefone?: string
        }
        Relationships: []
      }
      login_auditoria: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
          motivo: string | null
          nome: string | null
          sucesso: boolean
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          motivo?: string | null
          nome?: string | null
          sucesso: boolean
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          motivo?: string | null
          nome?: string | null
          sucesso?: boolean
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      materiais_servicos: {
        Row: {
          categoria_id: string | null
          codigo: string | null
          created_at: string | null
          descricao: string | null
          estoque_minimo: number | null
          fabricante_id: string | null
          fotos: Json | null
          id: string
          tipo: string | null
          unidade_medida: string | null
        }
        Insert: {
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque_minimo?: number | null
          fabricante_id?: string | null
          fotos?: Json | null
          id?: string
          tipo?: string | null
          unidade_medida?: string | null
        }
        Update: {
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque_minimo?: number | null
          fabricante_id?: string | null
          fotos?: Json | null
          id?: string
          tipo?: string | null
          unidade_medida?: string | null
        }
        Relationships: []
      }
      material_sco_vinculos: {
        Row: {
          cod_sco: string
          created_at: string
          descricao_sco: string
          fator_conversao: number
          id: string
          material_id: string
          observacao: string
          padrao: boolean
          sco_id: string | null
          unidade_sco: string
          updated_at: string
        }
        Insert: {
          cod_sco: string
          created_at?: string
          descricao_sco?: string
          fator_conversao?: number
          id?: string
          material_id: string
          observacao?: string
          padrao?: boolean
          sco_id?: string | null
          unidade_sco?: string
          updated_at?: string
        }
        Update: {
          cod_sco?: string
          created_at?: string
          descricao_sco?: string
          fator_conversao?: number
          id?: string
          material_id?: string
          observacao?: string
          padrao?: boolean
          sco_id?: string | null
          unidade_sco?: string
          updated_at?: string
        }
        Relationships: []
      }
      medicoes_servicos: {
        Row: {
          anexos: Json | null
          cliente_id: string | null
          cliente_nome: string | null
          contrato: string | null
          created_at: string | null
          data_pagamento: string | null
          descricao: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          itens: Json | null
          medicoes: Json | null
          numero: number
          observacoes: string | null
          ordem_compra_id: string | null
          ordem_compra_numero: number | null
          percentual_medido: number | null
          status: string | null
          valor_empreiteiro: number | null
          valor_lasant: number | null
          valor_total_contratado: number | null
          valor_total_medido: number | null
        }
        Insert: {
          anexos?: Json | null
          cliente_id?: string | null
          cliente_nome?: string | null
          contrato?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens?: Json | null
          medicoes?: Json | null
          numero?: number
          observacoes?: string | null
          ordem_compra_id?: string | null
          ordem_compra_numero?: number | null
          percentual_medido?: number | null
          status?: string | null
          valor_empreiteiro?: number | null
          valor_lasant?: number | null
          valor_total_contratado?: number | null
          valor_total_medido?: number | null
        }
        Update: {
          anexos?: Json | null
          cliente_id?: string | null
          cliente_nome?: string | null
          contrato?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens?: Json | null
          medicoes?: Json | null
          numero?: number
          observacoes?: string | null
          ordem_compra_id?: string | null
          ordem_compra_numero?: number | null
          percentual_medido?: number | null
          status?: string | null
          valor_empreiteiro?: number | null
          valor_lasant?: number | null
          valor_total_contratado?: number | null
          valor_total_medido?: number | null
        }
        Relationships: []
      }
      mfa_otps: {
        Row: {
          attempts: number
          canal: string
          code_hash: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          purpose: string
          telefone: string | null
          used_at: string | null
          usuario_id: string
        }
        Insert: {
          attempts?: number
          canal?: string
          code_hash: string
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          purpose: string
          telefone?: string | null
          used_at?: string | null
          usuario_id: string
        }
        Update: {
          attempts?: number
          canal?: string
          code_hash?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          purpose?: string
          telefone?: string | null
          used_at?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      nfes_recebidas: {
        Row: {
          ambiente: string | null
          chave: string
          conta_pagar_id: string | null
          created_at: string
          danfe_url: string | null
          data_emissao: string | null
          data_recebimento: string | null
          destinatario_cnpj: string | null
          emitente_cnpj: string | null
          emitente_nome: string | null
          empresa_id: string | null
          id: string
          manifestacao: string | null
          motivo_rejeicao: string | null
          numero: string | null
          payload: Json | null
          pedido_compra_id: string | null
          rejeitada_em: string | null
          serie: string | null
          status: string | null
          updated_at: string
          valor_total: number | null
          vinculado_em: string | null
          xml_url: string | null
        }
        Insert: {
          ambiente?: string | null
          chave: string
          conta_pagar_id?: string | null
          created_at?: string
          danfe_url?: string | null
          data_emissao?: string | null
          data_recebimento?: string | null
          destinatario_cnpj?: string | null
          emitente_cnpj?: string | null
          emitente_nome?: string | null
          empresa_id?: string | null
          id?: string
          manifestacao?: string | null
          motivo_rejeicao?: string | null
          numero?: string | null
          payload?: Json | null
          pedido_compra_id?: string | null
          rejeitada_em?: string | null
          serie?: string | null
          status?: string | null
          updated_at?: string
          valor_total?: number | null
          vinculado_em?: string | null
          xml_url?: string | null
        }
        Update: {
          ambiente?: string | null
          chave?: string
          conta_pagar_id?: string | null
          created_at?: string
          danfe_url?: string | null
          data_emissao?: string | null
          data_recebimento?: string | null
          destinatario_cnpj?: string | null
          emitente_cnpj?: string | null
          emitente_nome?: string | null
          empresa_id?: string | null
          id?: string
          manifestacao?: string | null
          motivo_rejeicao?: string | null
          numero?: string | null
          payload?: Json | null
          pedido_compra_id?: string | null
          rejeitada_em?: string | null
          serie?: string | null
          status?: string | null
          updated_at?: string
          valor_total?: number | null
          vinculado_em?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfes_recebidas_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      nfse_config: {
        Row: {
          aliquota_iss_padrao: number | null
          ambiente: number
          cnae_padrao: string | null
          codigo_municipio_prestador: string | null
          codigo_nbs: string | null
          codigo_servico_padrao: string | null
          codigo_tributacao_municipio: string | null
          created_at: string
          empresa_id: string
          id: string
          incentivador_cultural: boolean
          iss_retido_padrao: boolean
          natureza_operacao: string | null
          optante_simples: boolean
          proximo_numero_dps: number
          regime_especial: string | null
          regime_tributario: string | null
          serie_padrao: string
          updated_at: string
        }
        Insert: {
          aliquota_iss_padrao?: number | null
          ambiente?: number
          cnae_padrao?: string | null
          codigo_municipio_prestador?: string | null
          codigo_nbs?: string | null
          codigo_servico_padrao?: string | null
          codigo_tributacao_municipio?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          incentivador_cultural?: boolean
          iss_retido_padrao?: boolean
          natureza_operacao?: string | null
          optante_simples?: boolean
          proximo_numero_dps?: number
          regime_especial?: string | null
          regime_tributario?: string | null
          serie_padrao?: string
          updated_at?: string
        }
        Update: {
          aliquota_iss_padrao?: number | null
          ambiente?: number
          cnae_padrao?: string | null
          codigo_municipio_prestador?: string | null
          codigo_nbs?: string | null
          codigo_servico_padrao?: string | null
          codigo_tributacao_municipio?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          incentivador_cultural?: boolean
          iss_retido_padrao?: boolean
          natureza_operacao?: string | null
          optante_simples?: boolean
          proximo_numero_dps?: number
          regime_especial?: string | null
          regime_tributario?: string | null
          serie_padrao?: string
          updated_at?: string
        }
        Relationships: []
      }
      nfses_emitidas: {
        Row: {
          ambiente: number
          chave_acesso: string | null
          cliente_id: string | null
          created_at: string
          data_cancelamento: string | null
          data_competencia: string | null
          data_emissao: string | null
          empresa_id: string | null
          faturamento_id: string | null
          id: string
          mensagem_retorno: string | null
          motivo_cancelamento: string | null
          numero_dps: number
          prestador: Json
          protocolo: string | null
          serie: string
          servico: Json
          status: string
          tomador: Json
          tributos: Json
          updated_at: string
          url_danfse: string | null
          valor_iss: number
          valor_liquido: number
          valor_servico: number
          xml_dps: string | null
          xml_nfse: string | null
        }
        Insert: {
          ambiente?: number
          chave_acesso?: string | null
          cliente_id?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          empresa_id?: string | null
          faturamento_id?: string | null
          id?: string
          mensagem_retorno?: string | null
          motivo_cancelamento?: string | null
          numero_dps: number
          prestador?: Json
          protocolo?: string | null
          serie?: string
          servico?: Json
          status?: string
          tomador?: Json
          tributos?: Json
          updated_at?: string
          url_danfse?: string | null
          valor_iss?: number
          valor_liquido?: number
          valor_servico?: number
          xml_dps?: string | null
          xml_nfse?: string | null
        }
        Update: {
          ambiente?: number
          chave_acesso?: string | null
          cliente_id?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          empresa_id?: string | null
          faturamento_id?: string | null
          id?: string
          mensagem_retorno?: string | null
          motivo_cancelamento?: string | null
          numero_dps?: number
          prestador?: Json
          protocolo?: string | null
          serie?: string
          servico?: Json
          status?: string
          tomador?: Json
          tributos?: Json
          updated_at?: string
          url_danfse?: string | null
          valor_iss?: number
          valor_liquido?: number
          valor_servico?: number
          xml_dps?: string | null
          xml_nfse?: string | null
        }
        Relationships: []
      }
      nfses_tomadas: {
        Row: {
          ambiente: string | null
          base_calculo: number | null
          chave: string
          codigo_verificacao: string | null
          conta_pagar_id: string | null
          created_at: string
          data_emissao: string | null
          data_recebimento: string | null
          discriminacao: string | null
          empresa_id: string | null
          id: string
          motivo_rejeicao: string | null
          municipio_prestacao: string | null
          numero: string | null
          origem: string | null
          payload: Json | null
          prestador_cnpj: string | null
          prestador_nome: string | null
          rejeitada_em: string | null
          serie: string | null
          status: string | null
          tomador_cnpj: string | null
          updated_at: string
          valor_iss: number | null
          valor_servicos: number | null
          valor_total: number | null
          xml_url: string | null
        }
        Insert: {
          ambiente?: string | null
          base_calculo?: number | null
          chave: string
          codigo_verificacao?: string | null
          conta_pagar_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_recebimento?: string | null
          discriminacao?: string | null
          empresa_id?: string | null
          id?: string
          motivo_rejeicao?: string | null
          municipio_prestacao?: string | null
          numero?: string | null
          origem?: string | null
          payload?: Json | null
          prestador_cnpj?: string | null
          prestador_nome?: string | null
          rejeitada_em?: string | null
          serie?: string | null
          status?: string | null
          tomador_cnpj?: string | null
          updated_at?: string
          valor_iss?: number | null
          valor_servicos?: number | null
          valor_total?: number | null
          xml_url?: string | null
        }
        Update: {
          ambiente?: string | null
          base_calculo?: number | null
          chave?: string
          codigo_verificacao?: string | null
          conta_pagar_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_recebimento?: string | null
          discriminacao?: string | null
          empresa_id?: string | null
          id?: string
          motivo_rejeicao?: string | null
          municipio_prestacao?: string | null
          numero?: string | null
          origem?: string | null
          payload?: Json | null
          prestador_cnpj?: string | null
          prestador_nome?: string | null
          rejeitada_em?: string | null
          serie?: string | null
          status?: string | null
          tomador_cnpj?: string | null
          updated_at?: string
          valor_iss?: number | null
          valor_servicos?: number | null
          valor_total?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfses_tomadas_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      nrs_catalogo: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          codigo: string
          created_at: string
          data_publicacao: string | null
          data_vigencia: string | null
          descricao: string
          id: string
          observacao: string | null
          revisoes: Json
          updated_at: string
          validade_dias: number | null
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          codigo: string
          created_at?: string
          data_publicacao?: string | null
          data_vigencia?: string | null
          descricao: string
          id?: string
          observacao?: string | null
          revisoes?: Json
          updated_at?: string
          validade_dias?: number | null
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          codigo?: string
          created_at?: string
          data_publicacao?: string | null
          data_vigencia?: string | null
          descricao?: string
          id?: string
          observacao?: string | null
          revisoes?: Json
          updated_at?: string
          validade_dias?: number | null
        }
        Relationships: []
      }
      obras: {
        Row: {
          cliente_id: string
          cliente_nome: string
          contrato_numero: string | null
          created_at: string
          data_inicio: string | null
          data_prevista_termino: string | null
          descricao: string | null
          endereco: string | null
          id: string
          nome: string
          numero: number
          observacoes: string | null
          processo_numero: string | null
          responsavel: string | null
          status: string | null
          updated_at: string
          valor_total_contrato: number | null
        }
        Insert: {
          cliente_id?: string
          cliente_nome?: string
          contrato_numero?: string | null
          created_at?: string
          data_inicio?: string | null
          data_prevista_termino?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          numero?: number
          observacoes?: string | null
          processo_numero?: string | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string
          valor_total_contrato?: number | null
        }
        Update: {
          cliente_id?: string
          cliente_nome?: string
          contrato_numero?: string | null
          created_at?: string
          data_inicio?: string | null
          data_prevista_termino?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          numero?: number
          observacoes?: string | null
          processo_numero?: string | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string
          valor_total_contrato?: number | null
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          anexos: Json
          aprovado_por: string | null
          categoria: string | null
          cliente_id: string
          cliente_nome: string
          created_at: string | null
          criado_por: string | null
          data_aprovacao: string | null
          data_criacao: string | null
          id: string
          itens_materiais: Json
          itens_sco: Json
          memoria_calculo: Json
          numero: number
          observacoes: string | null
          revisao_motivo: string | null
          revisoes: Json
          solicitacao_id: string
          solicitacao_numero: number
          status: string
          valor_total: number
        }
        Insert: {
          anexos?: Json
          aprovado_por?: string | null
          categoria?: string | null
          cliente_id?: string
          cliente_nome?: string
          created_at?: string | null
          criado_por?: string | null
          data_aprovacao?: string | null
          data_criacao?: string | null
          id?: string
          itens_materiais?: Json
          itens_sco?: Json
          memoria_calculo?: Json
          numero?: number
          observacoes?: string | null
          revisao_motivo?: string | null
          revisoes?: Json
          solicitacao_id?: string
          solicitacao_numero?: number
          status?: string
          valor_total?: number
        }
        Update: {
          anexos?: Json
          aprovado_por?: string | null
          categoria?: string | null
          cliente_id?: string
          cliente_nome?: string
          created_at?: string | null
          criado_por?: string | null
          data_aprovacao?: string | null
          data_criacao?: string | null
          id?: string
          itens_materiais?: Json
          itens_sco?: Json
          memoria_calculo?: Json
          numero?: number
          observacoes?: string | null
          revisao_motivo?: string | null
          revisoes?: Json
          solicitacao_id?: string
          solicitacao_numero?: number
          status?: string
          valor_total?: number
        }
        Relationships: []
      }
      orcamentos_sco: {
        Row: {
          bdi: number
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          criado_por: string | null
          desconto: number
          id: string
          itens: Json
          numero: number
          obra: string | null
          observacoes: string | null
          referencia: string | null
          status: string
          subtotal: number
          tipo_analise: string
          titulo: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          bdi?: number
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          criado_por?: string | null
          desconto?: number
          id?: string
          itens?: Json
          numero?: number
          obra?: string | null
          observacoes?: string | null
          referencia?: string | null
          status?: string
          subtotal?: number
          tipo_analise?: string
          titulo: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          bdi?: number
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          criado_por?: string | null
          desconto?: number
          id?: string
          itens?: Json
          numero?: number
          obra?: string | null
          observacoes?: string | null
          referencia?: string | null
          status?: string
          subtotal?: number
          tipo_analise?: string
          titulo?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          anexos: Json | null
          avaliacao: number | null
          avaliacao_data: string | null
          avaliacao_justificativa: string | null
          avaliacao_usuario: string | null
          bdi: number | null
          categoria: string | null
          cliente_id: string | null
          cliente_nome: string | null
          complexidade: string
          created_at: string | null
          data_faturamento: string | null
          data_inicio: string | null
          data_termino: string | null
          descricao_conclusao: string | null
          descricao_servicos: string | null
          faturado_em: string | null
          faturado_por: string | null
          fotos: Json | null
          historico: Json | null
          hora_inicio: string | null
          hora_termino: string | null
          id: string
          impresso: boolean
          impresso_em: string | null
          impresso_por: string | null
          local_descricao: string | null
          local_id: string | null
          materiais: Json | null
          materiais_estoque: Json | null
          matricula: string | null
          n_cliente: string | null
          numero: number
          observacoes: Json | null
          observacoes_fiscalizacao: Json | null
          operador_id: string | null
          operador_nome: string | null
          pavimento_descricao: string | null
          pavimento_id: string | null
          prioridade: string | null
          profissionais: Json | null
          ramal: string | null
          ressalva_aprovacao: string | null
          retorno_pendente: Json | null
          servico: string | null
          setor_descricao: string | null
          setor_id: string | null
          situacao: string | null
          solicitacao_id: string | null
          solicitacao_numero: number | null
          solicitante: string | null
          telefone: string | null
          tipo_os: Json | null
        }
        Insert: {
          anexos?: Json | null
          avaliacao?: number | null
          avaliacao_data?: string | null
          avaliacao_justificativa?: string | null
          avaliacao_usuario?: string | null
          bdi?: number | null
          categoria?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          complexidade?: string
          created_at?: string | null
          data_faturamento?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          descricao_conclusao?: string | null
          descricao_servicos?: string | null
          faturado_em?: string | null
          faturado_por?: string | null
          fotos?: Json | null
          historico?: Json | null
          hora_inicio?: string | null
          hora_termino?: string | null
          id?: string
          impresso?: boolean
          impresso_em?: string | null
          impresso_por?: string | null
          local_descricao?: string | null
          local_id?: string | null
          materiais?: Json | null
          materiais_estoque?: Json | null
          matricula?: string | null
          n_cliente?: string | null
          numero?: number
          observacoes?: Json | null
          observacoes_fiscalizacao?: Json | null
          operador_id?: string | null
          operador_nome?: string | null
          pavimento_descricao?: string | null
          pavimento_id?: string | null
          prioridade?: string | null
          profissionais?: Json | null
          ramal?: string | null
          ressalva_aprovacao?: string | null
          retorno_pendente?: Json | null
          servico?: string | null
          setor_descricao?: string | null
          setor_id?: string | null
          situacao?: string | null
          solicitacao_id?: string | null
          solicitacao_numero?: number | null
          solicitante?: string | null
          telefone?: string | null
          tipo_os?: Json | null
        }
        Update: {
          anexos?: Json | null
          avaliacao?: number | null
          avaliacao_data?: string | null
          avaliacao_justificativa?: string | null
          avaliacao_usuario?: string | null
          bdi?: number | null
          categoria?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          complexidade?: string
          created_at?: string | null
          data_faturamento?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          descricao_conclusao?: string | null
          descricao_servicos?: string | null
          faturado_em?: string | null
          faturado_por?: string | null
          fotos?: Json | null
          historico?: Json | null
          hora_inicio?: string | null
          hora_termino?: string | null
          id?: string
          impresso?: boolean
          impresso_em?: string | null
          impresso_por?: string | null
          local_descricao?: string | null
          local_id?: string | null
          materiais?: Json | null
          materiais_estoque?: Json | null
          matricula?: string | null
          n_cliente?: string | null
          numero?: number
          observacoes?: Json | null
          observacoes_fiscalizacao?: Json | null
          operador_id?: string | null
          operador_nome?: string | null
          pavimento_descricao?: string | null
          pavimento_id?: string | null
          prioridade?: string | null
          profissionais?: Json | null
          ramal?: string | null
          ressalva_aprovacao?: string | null
          retorno_pendente?: Json | null
          servico?: string | null
          setor_descricao?: string | null
          setor_id?: string | null
          situacao?: string | null
          solicitacao_id?: string | null
          solicitacao_numero?: number | null
          solicitante?: string | null
          telefone?: string | null
          tipo_os?: Json | null
        }
        Relationships: []
      }
      os_assinaturas: {
        Row: {
          base_legal: string
          codigo_verificador: string
          created_at: string
          hash_documento: string
          id: string
          ip_origem: string | null
          metodo_autenticacao: string
          nivel_assinatura: string
          os_id: string
          os_numero: number
          papel: string
          signatario_cargo: string | null
          signatario_email: string | null
          signatario_matricula: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento: string
          id?: string
          ip_origem?: string | null
          metodo_autenticacao?: string
          nivel_assinatura?: string
          os_id: string
          os_numero: number
          papel: string
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento?: string
          id?: string
          ip_origem?: string | null
          metodo_autenticacao?: string
          nivel_assinatura?: string
          os_id?: string
          os_numero?: number
          papel?: string
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome?: string
          signatario_user_id?: string
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      os_modelos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      pc_assinaturas: {
        Row: {
          base_legal: string
          codigo_verificador: string
          created_at: string
          hash_documento: string
          id: string
          ip_origem: string | null
          papel: string
          pedido_id: string
          pedido_numero: number
          signatario_cargo: string | null
          signatario_email: string | null
          signatario_matricula: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento: string
          id?: string
          ip_origem?: string | null
          papel?: string
          pedido_id: string
          pedido_numero: number
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento?: string
          id?: string
          ip_origem?: string | null
          papel?: string
          pedido_id?: string
          pedido_numero?: number
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome?: string
          signatario_user_id?: string
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      pedidos_compra: {
        Row: {
          comprador: string | null
          condicao_pagamento: string | null
          cotacao_id: string | null
          created_at: string | null
          data_criacao: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          historico_status: Json | null
          id: string
          itens: Json | null
          local_entrega: string | null
          notificado_atraso_entrega: string | null
          numero: number
          observacoes: string | null
          prazo_entrega: string | null
          requisicao_id: string | null
          requisicao_numero: number | null
          status: string | null
          valor_total: number | null
        }
        Insert: {
          comprador?: string | null
          condicao_pagamento?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          data_criacao?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          historico_status?: Json | null
          id?: string
          itens?: Json | null
          local_entrega?: string | null
          notificado_atraso_entrega?: string | null
          numero?: number
          observacoes?: string | null
          prazo_entrega?: string | null
          requisicao_id?: string | null
          requisicao_numero?: number | null
          status?: string | null
          valor_total?: number | null
        }
        Update: {
          comprador?: string | null
          condicao_pagamento?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          data_criacao?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          historico_status?: Json | null
          id?: string
          itens?: Json | null
          local_entrega?: string | null
          notificado_atraso_entrega?: string | null
          numero?: number
          observacoes?: string | null
          prazo_entrega?: string | null
          requisicao_id?: string | null
          requisicao_numero?: number | null
          status?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      perfis_acesso: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          permissoes: Json
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          permissoes?: Json
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          permissoes?: Json
        }
        Relationships: []
      }
      plano_manutencao_atividades: {
        Row: {
          anexos: Json | null
          checklist: Json | null
          created_at: string | null
          descricao: string
          equipamento_id: string | null
          equipamento_nome: string | null
          id: string
          notificado_15d: boolean | null
          notificado_5d: boolean | null
          observacoes: string | null
          periodicidade: string | null
          plano_id: string
          prioridade: string | null
          proxima_execucao: string | null
          responsavel: string | null
          status: string | null
          tipo: string | null
          ultima_execucao: string | null
          updated_at: string | null
        }
        Insert: {
          anexos?: Json | null
          checklist?: Json | null
          created_at?: string | null
          descricao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          id?: string
          notificado_15d?: boolean | null
          notificado_5d?: boolean | null
          observacoes?: string | null
          periodicidade?: string | null
          plano_id: string
          prioridade?: string | null
          proxima_execucao?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string | null
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Update: {
          anexos?: Json | null
          checklist?: Json | null
          created_at?: string | null
          descricao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          id?: string
          notificado_15d?: boolean | null
          notificado_5d?: boolean | null
          observacoes?: string | null
          periodicidade?: string | null
          plano_id?: string
          prioridade?: string | null
          proxima_execucao?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string | null
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_manutencao_atividades_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_manutencao"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_manutencao_execucoes: {
        Row: {
          atividade_id: string
          checklist_resultado: Json | null
          created_at: string | null
          data_execucao: string | null
          evidencias: Json | null
          id: string
          observacoes: string | null
          os_id: string | null
          os_numero: number | null
          percentual_conformidade: number | null
          plano_id: string
          responsavel: string | null
        }
        Insert: {
          atividade_id: string
          checklist_resultado?: Json | null
          created_at?: string | null
          data_execucao?: string | null
          evidencias?: Json | null
          id?: string
          observacoes?: string | null
          os_id?: string | null
          os_numero?: number | null
          percentual_conformidade?: number | null
          plano_id: string
          responsavel?: string | null
        }
        Update: {
          atividade_id?: string
          checklist_resultado?: Json | null
          created_at?: string | null
          data_execucao?: string | null
          evidencias?: Json | null
          id?: string
          observacoes?: string | null
          os_id?: string | null
          os_numero?: number | null
          percentual_conformidade?: number | null
          plano_id?: string
          responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_manutencao_execucoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "plano_manutencao_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_manutencao_execucoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_manutencao"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_manutencao: {
        Row: {
          anexos: Json | null
          cliente_id: string
          cliente_nome: string
          contrato: string | null
          created_at: string | null
          equipamentos_cobertos: Json | null
          escopo: string | null
          id: string
          observacoes: string | null
          responsavel_tecnico_id: string | null
          responsavel_tecnico_nome: string | null
          status: string | null
          titulo: string
          updated_at: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          anexos?: Json | null
          cliente_id?: string
          cliente_nome?: string
          contrato?: string | null
          created_at?: string | null
          equipamentos_cobertos?: Json | null
          escopo?: string | null
          id?: string
          observacoes?: string | null
          responsavel_tecnico_id?: string | null
          responsavel_tecnico_nome?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          anexos?: Json | null
          cliente_id?: string
          cliente_nome?: string
          contrato?: string | null
          created_at?: string | null
          equipamentos_cobertos?: Json | null
          escopo?: string | null
          id?: string
          observacoes?: string | null
          responsavel_tecnico_id?: string | null
          responsavel_tecnico_nome?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      pmoc_atividades: {
        Row: {
          ativa: boolean | null
          checklist_id: string | null
          checklist_titulo: string | null
          created_at: string | null
          descricao: string
          duracao_estimada: string | null
          equipamento_id: string | null
          equipamento_nome: string | null
          id: string
          materiais_previstos: Json | null
          parametros_tecnicos: string | null
          periodicidade: string | null
          plano_id: string
          prioridade: string | null
          procedimento_falha: string | null
          proxima_execucao: string | null
          tipo: string | null
          ultima_execucao: string | null
        }
        Insert: {
          ativa?: boolean | null
          checklist_id?: string | null
          checklist_titulo?: string | null
          created_at?: string | null
          descricao?: string
          duracao_estimada?: string | null
          equipamento_id?: string | null
          equipamento_nome?: string | null
          id?: string
          materiais_previstos?: Json | null
          parametros_tecnicos?: string | null
          periodicidade?: string | null
          plano_id?: string
          prioridade?: string | null
          procedimento_falha?: string | null
          proxima_execucao?: string | null
          tipo?: string | null
          ultima_execucao?: string | null
        }
        Update: {
          ativa?: boolean | null
          checklist_id?: string | null
          checklist_titulo?: string | null
          created_at?: string | null
          descricao?: string
          duracao_estimada?: string | null
          equipamento_id?: string | null
          equipamento_nome?: string | null
          id?: string
          materiais_previstos?: Json | null
          parametros_tecnicos?: string | null
          periodicidade?: string | null
          plano_id?: string
          prioridade?: string | null
          procedimento_falha?: string | null
          proxima_execucao?: string | null
          tipo?: string | null
          ultima_execucao?: string | null
        }
        Relationships: []
      }
      pmoc_atividades_execucoes: {
        Row: {
          atividade_descricao: string | null
          atividade_id: string
          confirmado_por: string | null
          created_at: string
          data_confirmacao: string | null
          data_execucao: string
          equipamento_id: string | null
          equipamento_nome: string | null
          fotos: Json
          id: string
          observacoes: string | null
          periodicidade: string | null
          plano_id: string | null
          proxima_execucao: string | null
          registrado_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          atividade_descricao?: string | null
          atividade_id: string
          confirmado_por?: string | null
          created_at?: string
          data_confirmacao?: string | null
          data_execucao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          fotos?: Json
          id?: string
          observacoes?: string | null
          periodicidade?: string | null
          plano_id?: string | null
          proxima_execucao?: string | null
          registrado_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          atividade_descricao?: string | null
          atividade_id?: string
          confirmado_por?: string | null
          created_at?: string
          data_confirmacao?: string | null
          data_execucao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          fotos?: Json
          id?: string
          observacoes?: string | null
          periodicidade?: string | null
          plano_id?: string | null
          proxima_execucao?: string | null
          registrado_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pmoc_atividades_execucoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "pmoc_atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      pmoc_biblioteca_rotinas: {
        Row: {
          ativa: boolean | null
          checklist_itens: Json | null
          created_at: string | null
          descricao: string | null
          duracao_estimada: string | null
          id: string
          materiais_sugeridos: Json | null
          periodicidade_sugerida: string | null
          tipo_atividade: string | null
          tipo_equipamento: string | null
          titulo: string
          versao: number | null
        }
        Insert: {
          ativa?: boolean | null
          checklist_itens?: Json | null
          created_at?: string | null
          descricao?: string | null
          duracao_estimada?: string | null
          id?: string
          materiais_sugeridos?: Json | null
          periodicidade_sugerida?: string | null
          tipo_atividade?: string | null
          tipo_equipamento?: string | null
          titulo?: string
          versao?: number | null
        }
        Update: {
          ativa?: boolean | null
          checklist_itens?: Json | null
          created_at?: string | null
          descricao?: string | null
          duracao_estimada?: string | null
          id?: string
          materiais_sugeridos?: Json | null
          periodicidade_sugerida?: string | null
          tipo_atividade?: string | null
          tipo_equipamento?: string | null
          titulo?: string
          versao?: number | null
        }
        Relationships: []
      }
      pmoc_inconformidades: {
        Row: {
          ambiente: string | null
          causa_provavel: string | null
          created_at: string | null
          data_encerramento: string | null
          descricao: string
          equipamento_id: string | null
          equipamento_nome: string | null
          evidencias: Json | null
          gravidade: string | null
          historico: Json | null
          id: string
          numero: number
          os_id: string | null
          plano_acao: string | null
          plano_id: string | null
          prazo: string | null
          reavaliacao: string | null
          reincidencia: number | null
          responsavel: string | null
          status: string | null
        }
        Insert: {
          ambiente?: string | null
          causa_provavel?: string | null
          created_at?: string | null
          data_encerramento?: string | null
          descricao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          evidencias?: Json | null
          gravidade?: string | null
          historico?: Json | null
          id?: string
          numero?: number
          os_id?: string | null
          plano_acao?: string | null
          plano_id?: string | null
          prazo?: string | null
          reavaliacao?: string | null
          reincidencia?: number | null
          responsavel?: string | null
          status?: string | null
        }
        Update: {
          ambiente?: string | null
          causa_provavel?: string | null
          created_at?: string | null
          data_encerramento?: string | null
          descricao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          evidencias?: Json | null
          gravidade?: string | null
          historico?: Json | null
          id?: string
          numero?: number
          os_id?: string | null
          plano_acao?: string | null
          plano_id?: string | null
          prazo?: string | null
          reavaliacao?: string | null
          reincidencia?: number | null
          responsavel?: string | null
          status?: string | null
        }
        Relationships: []
      }
      pmoc_ordens_servico: {
        Row: {
          aprovado_por: string | null
          atividade_id: string | null
          checklist_id: string | null
          checklist_resultado: Json | null
          created_at: string | null
          data_abertura: string | null
          data_aprovacao: string | null
          data_conclusao: string | null
          data_inicio_execucao: string | null
          data_prazo: string | null
          descricao: string
          equipamento_id: string | null
          equipamento_nome: string | null
          equipe: string | null
          evidencias: Json | null
          evidencias_obrigatorias: boolean | null
          id: string
          local_descricao: string | null
          materiais_previstos: Json | null
          materiais_utilizados: Json | null
          numero: number
          observacoes: string | null
          origem: string | null
          plano_id: string | null
          prioridade: string | null
          status: string | null
          tecnico_responsavel: string | null
          tipo: string | null
          unidade: string | null
        }
        Insert: {
          aprovado_por?: string | null
          atividade_id?: string | null
          checklist_id?: string | null
          checklist_resultado?: Json | null
          created_at?: string | null
          data_abertura?: string | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_inicio_execucao?: string | null
          data_prazo?: string | null
          descricao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          equipe?: string | null
          evidencias?: Json | null
          evidencias_obrigatorias?: boolean | null
          id?: string
          local_descricao?: string | null
          materiais_previstos?: Json | null
          materiais_utilizados?: Json | null
          numero?: number
          observacoes?: string | null
          origem?: string | null
          plano_id?: string | null
          prioridade?: string | null
          status?: string | null
          tecnico_responsavel?: string | null
          tipo?: string | null
          unidade?: string | null
        }
        Update: {
          aprovado_por?: string | null
          atividade_id?: string | null
          checklist_id?: string | null
          checklist_resultado?: Json | null
          created_at?: string | null
          data_abertura?: string | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_inicio_execucao?: string | null
          data_prazo?: string | null
          descricao?: string
          equipamento_id?: string | null
          equipamento_nome?: string | null
          equipe?: string | null
          evidencias?: Json | null
          evidencias_obrigatorias?: boolean | null
          id?: string
          local_descricao?: string | null
          materiais_previstos?: Json | null
          materiais_utilizados?: Json | null
          numero?: number
          observacoes?: string | null
          origem?: string | null
          plano_id?: string | null
          prioridade?: string | null
          status?: string | null
          tecnico_responsavel?: string | null
          tipo?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      pmoc_planos: {
        Row: {
          ambiente_critico: string | null
          cliente_id: string | null
          cliente_nome: string | null
          contingencia: string | null
          contrato: string | null
          created_at: string | null
          descricao: string | null
          documentos_anexos: Json | null
          edificio: string | null
          historico_revisoes: Json | null
          id: string
          observacoes: string | null
          procedimentos_falha: string | null
          responsavel_tecnico_id: string | null
          responsavel_tecnico_nome: string | null
          revisao: number | null
          status: string | null
          titulo: string
          unidade: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ambiente_critico?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          contingencia?: string | null
          contrato?: string | null
          created_at?: string | null
          descricao?: string | null
          documentos_anexos?: Json | null
          edificio?: string | null
          historico_revisoes?: Json | null
          id?: string
          observacoes?: string | null
          procedimentos_falha?: string | null
          responsavel_tecnico_id?: string | null
          responsavel_tecnico_nome?: string | null
          revisao?: number | null
          status?: string | null
          titulo?: string
          unidade?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ambiente_critico?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          contingencia?: string | null
          contrato?: string | null
          created_at?: string | null
          descricao?: string | null
          documentos_anexos?: Json | null
          edificio?: string | null
          historico_revisoes?: Json | null
          id?: string
          observacoes?: string | null
          procedimentos_falha?: string | null
          responsavel_tecnico_id?: string | null
          responsavel_tecnico_nome?: string | null
          revisao?: number | null
          status?: string | null
          titulo?: string
          unidade?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      pmoc_qualidade_ar_medicoes: {
        Row: {
          anexos: Json
          co2: number | null
          conforme: boolean | null
          created_at: string | null
          data_medicao: string | null
          hora_medicao: string | null
          id: string
          observacoes: string | null
          outros_parametros: Json | null
          plano_acao: string | null
          ponto_descricao: string | null
          ponto_id: string
          pressao_diferencial: number | null
          relatorio_laboratorial_url: string | null
          renovacao_ar: number | null
          responsavel: string | null
          temperatura: number | null
          umidade: number | null
        }
        Insert: {
          anexos?: Json
          co2?: number | null
          conforme?: boolean | null
          created_at?: string | null
          data_medicao?: string | null
          hora_medicao?: string | null
          id?: string
          observacoes?: string | null
          outros_parametros?: Json | null
          plano_acao?: string | null
          ponto_descricao?: string | null
          ponto_id?: string
          pressao_diferencial?: number | null
          relatorio_laboratorial_url?: string | null
          renovacao_ar?: number | null
          responsavel?: string | null
          temperatura?: number | null
          umidade?: number | null
        }
        Update: {
          anexos?: Json
          co2?: number | null
          conforme?: boolean | null
          created_at?: string | null
          data_medicao?: string | null
          hora_medicao?: string | null
          id?: string
          observacoes?: string | null
          outros_parametros?: Json | null
          plano_acao?: string | null
          ponto_descricao?: string | null
          ponto_id?: string
          pressao_diferencial?: number | null
          relatorio_laboratorial_url?: string | null
          renovacao_ar?: number | null
          responsavel?: string | null
          temperatura?: number | null
          umidade?: number | null
        }
        Relationships: []
      }
      pmoc_qualidade_ar_pontos: {
        Row: {
          ambiente: string | null
          cliente_id: string | null
          created_at: string | null
          descricao: string
          edificio: string | null
          id: string
          parametros_monitorados: Json | null
          pavimento: string | null
          periodicidade_coleta: string | null
          plano_id: string | null
          status: string | null
          tipo_ambiente: string | null
        }
        Insert: {
          ambiente?: string | null
          cliente_id?: string | null
          created_at?: string | null
          descricao?: string
          edificio?: string | null
          id?: string
          parametros_monitorados?: Json | null
          pavimento?: string | null
          periodicidade_coleta?: string | null
          plano_id?: string | null
          status?: string | null
          tipo_ambiente?: string | null
        }
        Update: {
          ambiente?: string | null
          cliente_id?: string | null
          created_at?: string | null
          descricao?: string
          edificio?: string | null
          id?: string
          parametros_monitorados?: Json | null
          pavimento?: string | null
          periodicidade_coleta?: string | null
          plano_id?: string | null
          status?: string | null
          tipo_ambiente?: string | null
        }
        Relationships: []
      }
      pmoc_responsaveis_tecnicos: {
        Row: {
          clientes_vinculados: Json | null
          created_at: string | null
          documento_art_rrt: string | null
          documento_url: string | null
          email: string | null
          especialidade: string | null
          id: string
          nome: string
          observacoes: string | null
          registro_profissional: string | null
          status: string | null
          telefone: string | null
          tipo_registro: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          clientes_vinculados?: Json | null
          created_at?: string | null
          documento_art_rrt?: string | null
          documento_url?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          registro_profissional?: string | null
          status?: string | null
          telefone?: string | null
          tipo_registro?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          clientes_vinculados?: Json | null
          created_at?: string | null
          documento_art_rrt?: string | null
          documento_url?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          registro_profissional?: string | null
          status?: string | null
          telefone?: string | null
          tipo_registro?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      ponto_espelho_dia: {
        Row: {
          atrasos_min: number | null
          cpf: string | null
          created_at: string
          data: string
          funcionario_id: string | null
          horas_extras_min: number | null
          horas_faltantes_min: number | null
          horas_trabalhadas_min: number | null
          id: string
          observacao: string | null
          pontomais_employee_id: number | null
          raw: Json | null
          saldo_min: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          atrasos_min?: number | null
          cpf?: string | null
          created_at?: string
          data: string
          funcionario_id?: string | null
          horas_extras_min?: number | null
          horas_faltantes_min?: number | null
          horas_trabalhadas_min?: number | null
          id?: string
          observacao?: string | null
          pontomais_employee_id?: number | null
          raw?: Json | null
          saldo_min?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          atrasos_min?: number | null
          cpf?: string | null
          created_at?: string
          data?: string
          funcionario_id?: string | null
          horas_extras_min?: number | null
          horas_faltantes_min?: number | null
          horas_trabalhadas_min?: number | null
          id?: string
          observacao?: string | null
          pontomais_employee_id?: number | null
          raw?: Json | null
          saldo_min?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_espelho_dia_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_marcacoes: {
        Row: {
          cpf: string | null
          created_at: string
          data_hora: string
          endereco: string | null
          funcionario_id: string | null
          hash: string
          id: string
          latitude: number | null
          longitude: number | null
          origem: string | null
          pontomais_employee_id: number | null
          pontomais_time_card_id: number | null
          raw: Json | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_hora: string
          endereco?: string | null
          funcionario_id?: string | null
          hash: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: string | null
          pontomais_employee_id?: number | null
          pontomais_time_card_id?: number | null
          raw?: Json | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_hora?: string
          endereco?: string | null
          funcionario_id?: string | null
          hash?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: string | null
          pontomais_employee_id?: number | null
          pontomais_time_card_id?: number | null
          raw?: Json | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_marcacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_sync_log: {
        Row: {
          created_at: string
          detalhes: Json | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          mensagem: string | null
          origem: string
          periodo_fim: string | null
          periodo_ini: string | null
          status: string
          total_espelhos: number | null
          total_funcionarios: number | null
          total_funcionarios_vinculados: number | null
          total_marcacoes: number | null
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          mensagem?: string | null
          origem?: string
          periodo_fim?: string | null
          periodo_ini?: string | null
          status?: string
          total_espelhos?: number | null
          total_funcionarios?: number | null
          total_funcionarios_vinculados?: number | null
          total_marcacoes?: number | null
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          mensagem?: string | null
          origem?: string
          periodo_fim?: string | null
          periodo_ini?: string | null
          status?: string
          total_espelhos?: number | null
          total_funcionarios?: number | null
          total_funcionarios_vinculados?: number | null
          total_marcacoes?: number | null
        }
        Relationships: []
      }
      portal_acessos_log: {
        Row: {
          acao: string
          cpf: string | null
          created_at: string
          credencial_id: string | null
          detalhes: Json | null
          id: number
          ip: string | null
          sucesso: boolean
          user_agent: string | null
        }
        Insert: {
          acao: string
          cpf?: string | null
          created_at?: string
          credencial_id?: string | null
          detalhes?: Json | null
          id?: number
          ip?: string | null
          sucesso: boolean
          user_agent?: string | null
        }
        Update: {
          acao?: string
          cpf?: string | null
          created_at?: string
          credencial_id?: string | null
          detalhes?: Json | null
          id?: number
          ip?: string | null
          sucesso?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_acessos_log_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "portal_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_credenciais: {
        Row: {
          ativo: boolean
          bloqueado_ate: string | null
          candidato_ref: string | null
          cpf: string
          created_at: string
          email: string | null
          funcionario_id: string | null
          id: string
          processo_seletivo_id: string | null
          reset_token: string | null
          reset_token_expira: string | null
          senha_hash: string | null
          telefone: string | null
          tentativas_falhas: number
          tipo_acesso: string
          ultimo_login: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bloqueado_ate?: string | null
          candidato_ref?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          funcionario_id?: string | null
          id?: string
          processo_seletivo_id?: string | null
          reset_token?: string | null
          reset_token_expira?: string | null
          senha_hash?: string | null
          telefone?: string | null
          tentativas_falhas?: number
          tipo_acesso: string
          ultimo_login?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bloqueado_ate?: string | null
          candidato_ref?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          funcionario_id?: string | null
          id?: string
          processo_seletivo_id?: string | null
          reset_token?: string | null
          reset_token_expira?: string | null
          senha_hash?: string | null
          telefone?: string | null
          tentativas_falhas?: number
          tipo_acesso?: string
          ultimo_login?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_credenciais_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_credenciais_processo_seletivo_id_fkey"
            columns: ["processo_seletivo_id"]
            isOneToOne: false
            referencedRelation: "processos_seletivos"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_documentos_candidato: {
        Row: {
          cpf: string
          created_at: string
          enviado_em: string
          id: string
          nome_arquivo: string
          observacao: string | null
          processo_seletivo_id: string | null
          revisado_em: string | null
          revisor_id: string | null
          status: string
          storage_path: string
          tamanho_bytes: number | null
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          enviado_em?: string
          id?: string
          nome_arquivo: string
          observacao?: string | null
          processo_seletivo_id?: string | null
          revisado_em?: string | null
          revisor_id?: string | null
          status?: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          enviado_em?: string
          id?: string
          nome_arquivo?: string
          observacao?: string | null
          processo_seletivo_id?: string | null
          revisado_em?: string | null
          revisor_id?: string | null
          status?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_documentos_candidato_processo_seletivo_id_fkey"
            columns: ["processo_seletivo_id"]
            isOneToOne: false
            referencedRelation: "processos_seletivos"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_ficha_admissao: {
        Row: {
          bancarios: Json
          candidato_ref: string
          contatos_emergencia: Json
          cpf: string
          created_at: string
          dados_pessoais: Json
          dependentes: Json
          endereco: Json
          enviado_em: string | null
          id: string
          observacoes_rh: string | null
          processo_seletivo_id: string | null
          revisado_em: string | null
          revisor_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bancarios?: Json
          candidato_ref: string
          contatos_emergencia?: Json
          cpf: string
          created_at?: string
          dados_pessoais?: Json
          dependentes?: Json
          endereco?: Json
          enviado_em?: string | null
          id?: string
          observacoes_rh?: string | null
          processo_seletivo_id?: string | null
          revisado_em?: string | null
          revisor_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bancarios?: Json
          candidato_ref?: string
          contatos_emergencia?: Json
          cpf?: string
          created_at?: string
          dados_pessoais?: Json
          dependentes?: Json
          endereco?: Json
          enviado_em?: string | null
          id?: string
          observacoes_rh?: string | null
          processo_seletivo_id?: string | null
          revisado_em?: string | null
          revisor_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_ficha_admissao_processo_seletivo_id_fkey"
            columns: ["processo_seletivo_id"]
            isOneToOne: false
            referencedRelation: "processos_seletivos"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_holerites: {
        Row: {
          arquivo_path: string
          assinado_em: string | null
          assinatura_dispositivo: string | null
          assinatura_hash: string | null
          assinatura_imagem: string | null
          assinatura_ip: string | null
          competencia_ano: number
          competencia_mes: number
          created_at: string
          descricao: string | null
          disponibilizado_em: string
          disponibilizado_por: string | null
          funcionario_id: string
          id: string
          tipo: string
          updated_at: string
          visualizado_em: string | null
        }
        Insert: {
          arquivo_path: string
          assinado_em?: string | null
          assinatura_dispositivo?: string | null
          assinatura_hash?: string | null
          assinatura_imagem?: string | null
          assinatura_ip?: string | null
          competencia_ano: number
          competencia_mes: number
          created_at?: string
          descricao?: string | null
          disponibilizado_em?: string
          disponibilizado_por?: string | null
          funcionario_id: string
          id?: string
          tipo: string
          updated_at?: string
          visualizado_em?: string | null
        }
        Update: {
          arquivo_path?: string
          assinado_em?: string | null
          assinatura_dispositivo?: string | null
          assinatura_hash?: string | null
          assinatura_imagem?: string | null
          assinatura_ip?: string | null
          competencia_ano?: number
          competencia_mes?: number
          created_at?: string
          descricao?: string | null
          disponibilizado_em?: string
          disponibilizado_por?: string | null
          funcionario_id?: string
          id?: string
          tipo?: string
          updated_at?: string
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_holerites_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_holerites_import_item: {
        Row: {
          cpf_detectado: string | null
          created_at: string
          funcionario_id: string | null
          horas_extras: number | null
          horas_trabalhadas: number | null
          id: string
          ignorar: boolean
          lote_id: string
          nome_detectado: string | null
          observacao: string | null
          pagina: number
          pdf_pagina_base64: string | null
          publicado: boolean
          salario_base: number | null
          status_match: string
          tipo: string
          total_descontos: number | null
          total_proventos: number | null
          updated_at: string
          valor_horas_extras: number | null
          valor_liquido: number | null
        }
        Insert: {
          cpf_detectado?: string | null
          created_at?: string
          funcionario_id?: string | null
          horas_extras?: number | null
          horas_trabalhadas?: number | null
          id?: string
          ignorar?: boolean
          lote_id: string
          nome_detectado?: string | null
          observacao?: string | null
          pagina: number
          pdf_pagina_base64?: string | null
          publicado?: boolean
          salario_base?: number | null
          status_match?: string
          tipo?: string
          total_descontos?: number | null
          total_proventos?: number | null
          updated_at?: string
          valor_horas_extras?: number | null
          valor_liquido?: number | null
        }
        Update: {
          cpf_detectado?: string | null
          created_at?: string
          funcionario_id?: string | null
          horas_extras?: number | null
          horas_trabalhadas?: number | null
          id?: string
          ignorar?: boolean
          lote_id?: string
          nome_detectado?: string | null
          observacao?: string | null
          pagina?: number
          pdf_pagina_base64?: string | null
          publicado?: boolean
          salario_base?: number | null
          status_match?: string
          tipo?: string
          total_descontos?: number | null
          total_proventos?: number | null
          updated_at?: string
          valor_horas_extras?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_holerites_import_item_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_holerites_import_item_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "portal_holerites_import_lote"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_holerites_import_lote: {
        Row: {
          arquivo_nome: string
          competencia_ano: number
          competencia_mes: number
          created_at: string
          id: string
          importado_por: string | null
          importado_por_nome: string | null
          status: string
          total_paginas: number
          total_publicados: number
          updated_at: string
        }
        Insert: {
          arquivo_nome: string
          competencia_ano: number
          competencia_mes: number
          created_at?: string
          id?: string
          importado_por?: string | null
          importado_por_nome?: string | null
          status?: string
          total_paginas?: number
          total_publicados?: number
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string
          competencia_ano?: number
          competencia_mes?: number
          created_at?: string
          id?: string
          importado_por?: string | null
          importado_por_nome?: string | null
          status?: string
          total_paginas?: number
          total_publicados?: number
          updated_at?: string
        }
        Relationships: []
      }
      portal_solicitacoes_rh: {
        Row: {
          anexo_nome: string | null
          anexo_path: string | null
          assunto: string
          cpf: string
          created_at: string
          descricao: string | null
          funcionario_id: string
          id: string
          respondido_em: string | null
          respondido_por: string | null
          resposta_rh: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_path?: string | null
          assunto: string
          cpf: string
          created_at?: string
          descricao?: string | null
          funcionario_id: string
          id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_rh?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_path?: string | null
          assunto?: string
          cpf?: string
          created_at?: string
          descricao?: string | null
          funcionario_id?: string
          id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_rh?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_termos_assinados: {
        Row: {
          assinado_em: string
          cpf: string
          created_at: string
          funcionario_id: string | null
          hash_sha256: string
          id: string
          ip: string | null
          processo_seletivo_id: string | null
          texto_aceite: string
          tipo_acesso: string
          tipo_termo: string
          user_agent: string | null
          versao_termo: string | null
        }
        Insert: {
          assinado_em?: string
          cpf: string
          created_at?: string
          funcionario_id?: string | null
          hash_sha256: string
          id?: string
          ip?: string | null
          processo_seletivo_id?: string | null
          texto_aceite: string
          tipo_acesso: string
          tipo_termo: string
          user_agent?: string | null
          versao_termo?: string | null
        }
        Update: {
          assinado_em?: string
          cpf?: string
          created_at?: string
          funcionario_id?: string | null
          hash_sha256?: string
          id?: string
          ip?: string | null
          processo_seletivo_id?: string | null
          texto_aceite?: string
          tipo_acesso?: string
          tipo_termo?: string
          user_agent?: string | null
          versao_termo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_termos_assinados_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_termos_assinados_processo_seletivo_id_fkey"
            columns: ["processo_seletivo_id"]
            isOneToOne: false
            referencedRelation: "processos_seletivos"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_treinamentos: {
        Row: {
          assinado_em: string | null
          assinatura_dispositivo: string | null
          assinatura_hash: string | null
          assinatura_ip: string | null
          certificado_path: string | null
          concluido_em: string | null
          cpf: string
          created_at: string
          id: string
          nota: number | null
          processo_seletivo_id: string | null
          resp_assinado_em: string | null
          resp_assinante_cargo: string | null
          resp_assinante_nome: string | null
          resp_assinatura_hash: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          assinado_em?: string | null
          assinatura_dispositivo?: string | null
          assinatura_hash?: string | null
          assinatura_ip?: string | null
          certificado_path?: string | null
          concluido_em?: string | null
          cpf: string
          created_at?: string
          id?: string
          nota?: number | null
          processo_seletivo_id?: string | null
          resp_assinado_em?: string | null
          resp_assinante_cargo?: string | null
          resp_assinante_nome?: string | null
          resp_assinatura_hash?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          assinado_em?: string | null
          assinatura_dispositivo?: string | null
          assinatura_hash?: string | null
          assinatura_ip?: string | null
          certificado_path?: string | null
          concluido_em?: string | null
          cpf?: string
          created_at?: string
          id?: string
          nota?: number | null
          processo_seletivo_id?: string | null
          resp_assinado_em?: string | null
          resp_assinante_cargo?: string | null
          resp_assinante_nome?: string | null
          resp_assinatura_hash?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_treinamentos_processo_seletivo_id_fkey"
            columns: ["processo_seletivo_id"]
            isOneToOne: false
            referencedRelation: "processos_seletivos"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_anexos_edital: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          mime_type: string | null
          nome: string
          pregao_id: string
          storage_path: string | null
          tamanho_bytes: number | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          mime_type?: string | null
          nome: string
          pregao_id: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          mime_type?: string | null
          nome?: string
          pregao_id?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregao_anexos_edital_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_documentos_exigidos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          nome: string
          obrigatorio: boolean
          ordem: number
          pregao_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          id?: string
          nome?: string
          obrigatorio?: boolean
          ordem?: number
          pregao_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          nome?: string
          obrigatorio?: boolean
          ordem?: number
          pregao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregao_documentos_exigidos_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_eventos: {
        Row: {
          ator_id: string | null
          ator_nome: string
          ator_tipo: string
          evento: string
          id: string
          ip: string | null
          item_id: string | null
          payload: Json
          pregao_id: string
          ts: string
        }
        Insert: {
          ator_id?: string | null
          ator_nome?: string
          ator_tipo?: string
          evento?: string
          id?: string
          ip?: string | null
          item_id?: string | null
          payload?: Json
          pregao_id: string
          ts?: string
        }
        Update: {
          ator_id?: string | null
          ator_nome?: string
          ator_tipo?: string
          evento?: string
          id?: string
          ip?: string | null
          item_id?: string | null
          payload?: Json
          pregao_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregao_eventos_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_habilitacao: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          documento_exigido_id: string | null
          documento_nome: string
          id: string
          observacao: string
          participante_id: string
          pregao_id: string
          status: string
          updated_at: string
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          documento_exigido_id?: string | null
          documento_nome?: string
          id?: string
          observacao?: string
          participante_id: string
          pregao_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          documento_exigido_id?: string | null
          documento_nome?: string
          id?: string
          observacao?: string
          participante_id?: string
          pregao_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregao_habilitacao_documento_exigido_id_fkey"
            columns: ["documento_exigido_id"]
            isOneToOne: false
            referencedRelation: "pregao_documentos_exigidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_habilitacao_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "pregao_participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_habilitacao_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_itens: {
        Row: {
          agrupamento: string
          created_at: string
          descricao: string
          encerra_em: string | null
          encerrado_em: string | null
          id: string
          iniciado_em: string | null
          lote_codigo: string | null
          material_id: string | null
          observacoes: string
          ordem: number
          preco_referencia: number
          preco_referencia_sigiloso: boolean
          pregao_id: string
          quantidade: number
          status: string
          unidade: string
          updated_at: string
          vencedor_participante_id: string | null
          vencedor_valor: number | null
          vencedor_valor_unitario: number | null
        }
        Insert: {
          agrupamento?: string
          created_at?: string
          descricao?: string
          encerra_em?: string | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string | null
          lote_codigo?: string | null
          material_id?: string | null
          observacoes?: string
          ordem?: number
          preco_referencia?: number
          preco_referencia_sigiloso?: boolean
          pregao_id: string
          quantidade?: number
          status?: string
          unidade?: string
          updated_at?: string
          vencedor_participante_id?: string | null
          vencedor_valor?: number | null
          vencedor_valor_unitario?: number | null
        }
        Update: {
          agrupamento?: string
          created_at?: string
          descricao?: string
          encerra_em?: string | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string | null
          lote_codigo?: string | null
          material_id?: string | null
          observacoes?: string
          ordem?: number
          preco_referencia?: number
          preco_referencia_sigiloso?: boolean
          pregao_id?: string
          quantidade?: number
          status?: string
          unidade?: string
          updated_at?: string
          vencedor_participante_id?: string | null
          vencedor_valor?: number | null
          vencedor_valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pregao_itens_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_lances: {
        Row: {
          cancelado: boolean
          id: string
          item_id: string
          motivo_cancelamento: string | null
          participante_id: string
          pregao_id: string
          ts: string
          valor: number
        }
        Insert: {
          cancelado?: boolean
          id?: string
          item_id: string
          motivo_cancelamento?: string | null
          participante_id: string
          pregao_id: string
          ts?: string
          valor: number
        }
        Update: {
          cancelado?: boolean
          id?: string
          item_id?: string
          motivo_cancelamento?: string | null
          participante_id?: string
          pregao_id?: string
          ts?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pregao_lances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pregao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_lances_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "pregao_participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_lances_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_mensagens: {
        Row: {
          autor_id: string | null
          autor_nome_exibicao: string
          autor_tipo: string
          id: string
          item_id: string | null
          mensagem: string
          pregao_id: string
          ts: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome_exibicao?: string
          autor_tipo?: string
          id?: string
          item_id?: string | null
          mensagem?: string
          pregao_id: string
          ts?: string
        }
        Update: {
          autor_id?: string | null
          autor_nome_exibicao?: string
          autor_tipo?: string
          id?: string
          item_id?: string | null
          mensagem?: string
          pregao_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregao_mensagens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pregao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_mensagens_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_participantes: {
        Row: {
          apelido: string
          apelido_seq: number
          chat_aberto: boolean
          created_at: string
          fornecedor_cnpj: string
          fornecedor_id: string
          fornecedor_nome: string
          id: string
          motivo_status: string | null
          pregao_id: string
          status: string
          termo_aceito_em: string | null
          termo_aceito_ip: string | null
          termo_hash: string | null
          updated_at: string
        }
        Insert: {
          apelido?: string
          apelido_seq?: number
          chat_aberto?: boolean
          created_at?: string
          fornecedor_cnpj?: string
          fornecedor_id: string
          fornecedor_nome?: string
          id?: string
          motivo_status?: string | null
          pregao_id: string
          status?: string
          termo_aceito_em?: string | null
          termo_aceito_ip?: string | null
          termo_hash?: string | null
          updated_at?: string
        }
        Update: {
          apelido?: string
          apelido_seq?: number
          chat_aberto?: boolean
          created_at?: string
          fornecedor_cnpj?: string
          fornecedor_id?: string
          fornecedor_nome?: string
          id?: string
          motivo_status?: string | null
          pregao_id?: string
          status?: string
          termo_aceito_em?: string | null
          termo_aceito_ip?: string | null
          termo_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregao_participantes_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_propostas_fechadas: {
        Row: {
          enviada_em: string
          id: string
          item_id: string
          participante_id: string
          pregao_id: string
          revelada: boolean
          valor: number
        }
        Insert: {
          enviada_em?: string
          id?: string
          item_id: string
          participante_id: string
          pregao_id: string
          revelada?: boolean
          valor: number
        }
        Update: {
          enviada_em?: string
          id?: string
          item_id?: string
          participante_id?: string
          pregao_id?: string
          revelada?: boolean
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pregao_propostas_fechadas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pregao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_propostas_fechadas_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "pregao_participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_propostas_fechadas_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregao_propostas_iniciais: {
        Row: {
          enviada_em: string
          id: string
          item_id: string
          marca: string | null
          modelo: string | null
          observacoes: string
          participante_id: string
          pregao_id: string
          valor: number
        }
        Insert: {
          enviada_em?: string
          id?: string
          item_id: string
          marca?: string | null
          modelo?: string | null
          observacoes?: string
          participante_id: string
          pregao_id: string
          valor?: number
        }
        Update: {
          enviada_em?: string
          id?: string
          item_id?: string
          marca?: string | null
          modelo?: string | null
          observacoes?: string
          participante_id?: string
          pregao_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pregao_propostas_iniciais_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pregao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_propostas_iniciais_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "pregao_participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregao_propostas_iniciais_pregao_id_fkey"
            columns: ["pregao_id"]
            isOneToOne: false
            referencedRelation: "pregoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pregoes: {
        Row: {
          created_at: string
          data_abertura_credenciamento: string | null
          data_abertura_propostas: string | null
          data_encerramento_disputa: string | null
          data_inicio_disputa: string | null
          data_publicacao: string | null
          decremento_minimo: number
          decremento_tipo: string
          id: string
          modalidade: string
          motivo_cancelamento: string | null
          numero: number
          objeto: string
          observacoes: string
          pregoeiro_id: string | null
          pregoeiro_nome: string | null
          resultado_publico: boolean
          status: string
          tempo_disputa_min: number
          tempo_prorrogacao_min: number
          termo_hash: string | null
          termo_participacao: string
          tipo_disputa: string
          updated_at: string
          valor_estimado: number
          valor_estimado_sigiloso: boolean
        }
        Insert: {
          created_at?: string
          data_abertura_credenciamento?: string | null
          data_abertura_propostas?: string | null
          data_encerramento_disputa?: string | null
          data_inicio_disputa?: string | null
          data_publicacao?: string | null
          decremento_minimo?: number
          decremento_tipo?: string
          id?: string
          modalidade?: string
          motivo_cancelamento?: string | null
          numero?: number
          objeto?: string
          observacoes?: string
          pregoeiro_id?: string | null
          pregoeiro_nome?: string | null
          resultado_publico?: boolean
          status?: string
          tempo_disputa_min?: number
          tempo_prorrogacao_min?: number
          termo_hash?: string | null
          termo_participacao?: string
          tipo_disputa?: string
          updated_at?: string
          valor_estimado?: number
          valor_estimado_sigiloso?: boolean
        }
        Update: {
          created_at?: string
          data_abertura_credenciamento?: string | null
          data_abertura_propostas?: string | null
          data_encerramento_disputa?: string | null
          data_inicio_disputa?: string | null
          data_publicacao?: string | null
          decremento_minimo?: number
          decremento_tipo?: string
          id?: string
          modalidade?: string
          motivo_cancelamento?: string | null
          numero?: number
          objeto?: string
          observacoes?: string
          pregoeiro_id?: string | null
          pregoeiro_nome?: string | null
          resultado_publico?: boolean
          status?: string
          tempo_disputa_min?: number
          tempo_prorrogacao_min?: number
          termo_hash?: string | null
          termo_participacao?: string
          tipo_disputa?: string
          updated_at?: string
          valor_estimado?: number
          valor_estimado_sigiloso?: boolean
        }
        Relationships: []
      }
      processos_seletivos: {
        Row: {
          candidatos: Json | null
          created_at: string | null
          data_criacao: string | null
          id: string
          numero: number | null
          requisicao_id: string
        }
        Insert: {
          candidatos?: Json | null
          created_at?: string | null
          data_criacao?: string | null
          id?: string
          numero?: number | null
          requisicao_id?: string
        }
        Update: {
          candidatos?: Json | null
          created_at?: string | null
          data_criacao?: string | null
          id?: string
          numero?: number | null
          requisicao_id?: string
        }
        Relationships: []
      }
      processos_trabalhistas: {
        Row: {
          advogado_autor: string | null
          advogado_autor_oab: string | null
          advogado_empresa: string | null
          advogados_empresa: Json
          anexos: Json | null
          autor_cpf: string | null
          autor_nome: string
          cliente_id: string | null
          cliente_nome: string | null
          comarca: string | null
          created_at: string | null
          data_distribuicao: string | null
          estado: string | null
          fase_processual: string | null
          honorarios: number | null
          id: string
          numero_processo: string
          objeto_acao: string | null
          observacoes: string | null
          preposto: string | null
          provisao_contabil: number | null
          risco: string | null
          status: string | null
          valor_acordo: number | null
          valor_causa: number | null
          valor_condenacao: number | null
          vara: string | null
        }
        Insert: {
          advogado_autor?: string | null
          advogado_autor_oab?: string | null
          advogado_empresa?: string | null
          advogados_empresa?: Json
          anexos?: Json | null
          autor_cpf?: string | null
          autor_nome?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          comarca?: string | null
          created_at?: string | null
          data_distribuicao?: string | null
          estado?: string | null
          fase_processual?: string | null
          honorarios?: number | null
          id?: string
          numero_processo?: string
          objeto_acao?: string | null
          observacoes?: string | null
          preposto?: string | null
          provisao_contabil?: number | null
          risco?: string | null
          status?: string | null
          valor_acordo?: number | null
          valor_causa?: number | null
          valor_condenacao?: number | null
          vara?: string | null
        }
        Update: {
          advogado_autor?: string | null
          advogado_autor_oab?: string | null
          advogado_empresa?: string | null
          advogados_empresa?: Json
          anexos?: Json | null
          autor_cpf?: string | null
          autor_nome?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          comarca?: string | null
          created_at?: string | null
          data_distribuicao?: string | null
          estado?: string | null
          fase_processual?: string | null
          honorarios?: number | null
          id?: string
          numero_processo?: string
          objeto_acao?: string | null
          observacoes?: string | null
          preposto?: string | null
          provisao_contabil?: number | null
          risco?: string | null
          status?: string | null
          valor_acordo?: number | null
          valor_causa?: number | null
          valor_condenacao?: number | null
          vara?: string | null
        }
        Relationships: []
      }
      processos_trabalhistas_andamentos: {
        Row: {
          created_at: string | null
          data_andamento: string | null
          descricao: string | null
          id: string
          prazo_limite: string | null
          processo_id: string
          responsavel: string | null
          status_prazo: string | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          data_andamento?: string | null
          descricao?: string | null
          id?: string
          prazo_limite?: string | null
          processo_id: string
          responsavel?: string | null
          status_prazo?: string | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          data_andamento?: string | null
          descricao?: string | null
          id?: string
          prazo_limite?: string | null
          processo_id?: string
          responsavel?: string | null
          status_prazo?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_trabalhistas_andamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_trabalhistas"
            referencedColumns: ["id"]
          },
        ]
      }
      promocoes: {
        Row: {
          aprovado_em: string | null
          aprovador_id: string | null
          aprovador_nome: string | null
          cargo_anterior_id: string | null
          cargo_anterior_nome: string | null
          cargo_novo_id: string
          cargo_novo_nome: string
          cliente_anterior_id: string | null
          cliente_anterior_nome: string | null
          cliente_novo_id: string | null
          cliente_novo_nome: string | null
          created_at: string
          data_promocao: string
          funcionario_id: string
          id: string
          motivo: string | null
          observacoes: string | null
          salario_anterior: string | null
          salario_novo: string | null
          status: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          aprovador_nome?: string | null
          cargo_anterior_id?: string | null
          cargo_anterior_nome?: string | null
          cargo_novo_id: string
          cargo_novo_nome: string
          cliente_anterior_id?: string | null
          cliente_anterior_nome?: string | null
          cliente_novo_id?: string | null
          cliente_novo_nome?: string | null
          created_at?: string
          data_promocao?: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
          salario_anterior?: string | null
          salario_novo?: string | null
          status?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          aprovador_nome?: string | null
          cargo_anterior_id?: string | null
          cargo_anterior_nome?: string | null
          cargo_novo_id?: string
          cargo_novo_nome?: string
          cliente_anterior_id?: string | null
          cliente_anterior_nome?: string | null
          cliente_novo_id?: string | null
          cliente_novo_nome?: string | null
          created_at?: string
          data_promocao?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
          salario_anterior?: string | null
          salario_novo?: string | null
          status?: string
        }
        Relationships: []
      }
      rdo_assinaturas: {
        Row: {
          base_legal: string
          codigo_verificador: string
          created_at: string
          hash_documento: string
          id: string
          ip_origem: string | null
          metodo_autenticacao: string
          nivel_assinatura: string
          papel: string
          rdo_id: string
          rdo_numero: number
          signatario_cargo: string | null
          signatario_email: string | null
          signatario_matricula: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento: string
          id?: string
          ip_origem?: string | null
          metodo_autenticacao?: string
          nivel_assinatura?: string
          papel: string
          rdo_id: string
          rdo_numero: number
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome: string
          signatario_user_id: string
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          base_legal?: string
          codigo_verificador?: string
          created_at?: string
          hash_documento?: string
          id?: string
          ip_origem?: string | null
          metodo_autenticacao?: string
          nivel_assinatura?: string
          papel?: string
          rdo_id?: string
          rdo_numero?: number
          signatario_cargo?: string | null
          signatario_email?: string | null
          signatario_matricula?: string | null
          signatario_nome?: string
          signatario_user_id?: string
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      rdos: {
        Row: {
          anexos: Json | null
          assinatura_fiscalizacao: string | null
          assinatura_fiscalizacao_nome: string | null
          assinatura_responsavel: string | null
          assinatura_responsavel_nome: string | null
          atividades: Json | null
          avanco_fisico_geral: number | null
          cliente_id: string
          cliente_nome: string
          clima_manha: string | null
          clima_noite: string | null
          clima_tarde: string | null
          condicao_manha: string | null
          condicao_noite: string | null
          condicao_tarde: string | null
          created_at: string | null
          data_rdo: string
          efetivo: Json | null
          equipamentos: Json | null
          id: string
          numero: number
          obra: string
          obra_id: string | null
          observacoes: string | null
          ocorrencias: string | null
          responsavel: string
          responsavel_tecnico_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          anexos?: Json | null
          assinatura_fiscalizacao?: string | null
          assinatura_fiscalizacao_nome?: string | null
          assinatura_responsavel?: string | null
          assinatura_responsavel_nome?: string | null
          atividades?: Json | null
          avanco_fisico_geral?: number | null
          cliente_id?: string
          cliente_nome?: string
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          condicao_manha?: string | null
          condicao_noite?: string | null
          condicao_tarde?: string | null
          created_at?: string | null
          data_rdo?: string
          efetivo?: Json | null
          equipamentos?: Json | null
          id?: string
          numero?: number
          obra?: string
          obra_id?: string | null
          observacoes?: string | null
          ocorrencias?: string | null
          responsavel?: string
          responsavel_tecnico_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          anexos?: Json | null
          assinatura_fiscalizacao?: string | null
          assinatura_fiscalizacao_nome?: string | null
          assinatura_responsavel?: string | null
          assinatura_responsavel_nome?: string | null
          atividades?: Json | null
          avanco_fisico_geral?: number | null
          cliente_id?: string
          cliente_nome?: string
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          condicao_manha?: string | null
          condicao_noite?: string | null
          condicao_tarde?: string | null
          created_at?: string | null
          data_rdo?: string
          efetivo?: Json | null
          equipamentos?: Json | null
          id?: string
          numero?: number
          obra?: string
          obra_id?: string | null
          observacoes?: string | null
          ocorrencias?: string | null
          responsavel?: string
          responsavel_tecnico_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          anexos_nf: Json | null
          created_at: string | null
          data_recebimento: string | null
          fornecedor_nome: string | null
          id: string
          itens: Json | null
          local_entrega: string | null
          nota_fiscal: string | null
          observacao_geral: string | null
          pedido_id: string | null
          pedido_numero: number | null
          requisicao_id: string | null
          requisicao_numero: number | null
          tipo: string | null
          usuario: string | null
        }
        Insert: {
          anexos_nf?: Json | null
          created_at?: string | null
          data_recebimento?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens?: Json | null
          local_entrega?: string | null
          nota_fiscal?: string | null
          observacao_geral?: string | null
          pedido_id?: string | null
          pedido_numero?: number | null
          requisicao_id?: string | null
          requisicao_numero?: number | null
          tipo?: string | null
          usuario?: string | null
        }
        Update: {
          anexos_nf?: Json | null
          created_at?: string | null
          data_recebimento?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens?: Json | null
          local_entrega?: string | null
          nota_fiscal?: string | null
          observacao_geral?: string | null
          pedido_id?: string | null
          pedido_numero?: number | null
          requisicao_id?: string | null
          requisicao_numero?: number | null
          tipo?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      requisicoes: {
        Row: {
          aprovado_por: string | null
          atividades_cargo: string | null
          carga_horaria: string | null
          cargo_id: string | null
          cargo_nome: string | null
          cargo_substituido: string | null
          conhecimento_informatica: string | null
          created_at: string | null
          data_criacao: string | null
          data_desligamento: string | null
          experiencia: string | null
          formacao: Json | null
          formacao_detalhe: string | null
          headcount: string | null
          historico_status: Json | null
          id: string
          indicados: Json
          interno_externo: string | null
          jornada: string | null
          matricula: string | null
          motivo_outros: string | null
          nome_substituido: string | null
          numero: number
          orcamento: string | null
          origem_vaga: string | null
          salario_substituido: string | null
          salario_vaga: string | null
          solicitante: string | null
          status: string | null
          tipo_contratacao: Json | null
          tipo_contratacao_detalhe: string | null
          tipo_vaga: string | null
          unidade: string | null
        }
        Insert: {
          aprovado_por?: string | null
          atividades_cargo?: string | null
          carga_horaria?: string | null
          cargo_id?: string | null
          cargo_nome?: string | null
          cargo_substituido?: string | null
          conhecimento_informatica?: string | null
          created_at?: string | null
          data_criacao?: string | null
          data_desligamento?: string | null
          experiencia?: string | null
          formacao?: Json | null
          formacao_detalhe?: string | null
          headcount?: string | null
          historico_status?: Json | null
          id?: string
          indicados?: Json
          interno_externo?: string | null
          jornada?: string | null
          matricula?: string | null
          motivo_outros?: string | null
          nome_substituido?: string | null
          numero?: number
          orcamento?: string | null
          origem_vaga?: string | null
          salario_substituido?: string | null
          salario_vaga?: string | null
          solicitante?: string | null
          status?: string | null
          tipo_contratacao?: Json | null
          tipo_contratacao_detalhe?: string | null
          tipo_vaga?: string | null
          unidade?: string | null
        }
        Update: {
          aprovado_por?: string | null
          atividades_cargo?: string | null
          carga_horaria?: string | null
          cargo_id?: string | null
          cargo_nome?: string | null
          cargo_substituido?: string | null
          conhecimento_informatica?: string | null
          created_at?: string | null
          data_criacao?: string | null
          data_desligamento?: string | null
          experiencia?: string | null
          formacao?: Json | null
          formacao_detalhe?: string | null
          headcount?: string | null
          historico_status?: Json | null
          id?: string
          indicados?: Json
          interno_externo?: string | null
          jornada?: string | null
          matricula?: string | null
          motivo_outros?: string | null
          nome_substituido?: string | null
          numero?: number
          orcamento?: string | null
          origem_vaga?: string | null
          salario_substituido?: string | null
          salario_vaga?: string | null
          solicitante?: string | null
          status?: string | null
          tipo_contratacao?: Json | null
          tipo_contratacao_detalhe?: string | null
          tipo_vaga?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      requisicoes_compras: {
        Row: {
          anexos: Json | null
          centro_custo: string | null
          centro_custo_nome: string | null
          created_at: string | null
          data_criacao: string | null
          historico_status: Json | null
          id: string
          itens: Json | null
          justificativa: string | null
          local_entrega: string | null
          numero: number
          prazo_desejado: string | null
          solicitante: string | null
          status: string | null
          urgencia: string | null
        }
        Insert: {
          anexos?: Json | null
          centro_custo?: string | null
          centro_custo_nome?: string | null
          created_at?: string | null
          data_criacao?: string | null
          historico_status?: Json | null
          id?: string
          itens?: Json | null
          justificativa?: string | null
          local_entrega?: string | null
          numero?: number
          prazo_desejado?: string | null
          solicitante?: string | null
          status?: string | null
          urgencia?: string | null
        }
        Update: {
          anexos?: Json | null
          centro_custo?: string | null
          centro_custo_nome?: string | null
          created_at?: string | null
          data_criacao?: string | null
          historico_status?: Json | null
          id?: string
          itens?: Json | null
          justificativa?: string | null
          local_entrega?: string | null
          numero?: number
          prazo_desejado?: string | null
          solicitante?: string | null
          status?: string | null
          urgencia?: string | null
        }
        Relationships: []
      }
      requisicoes_compras_justificativas: {
        Row: {
          created_at: string
          id: string
          motivo: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
        }
        Relationships: []
      }
      responsaveis_tecnicos: {
        Row: {
          carteira_crea_nome: string | null
          carteira_crea_url: string | null
          cpf: string
          crea: string
          created_at: string
          id: string
          nome: string
          titulo: string
          updated_at: string
        }
        Insert: {
          carteira_crea_nome?: string | null
          carteira_crea_url?: string | null
          cpf: string
          crea: string
          created_at?: string
          id?: string
          nome: string
          titulo: string
          updated_at?: string
        }
        Update: {
          carteira_crea_nome?: string | null
          carteira_crea_url?: string | null
          cpf?: string
          crea?: string
          created_at?: string
          id?: string
          nome?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      sco_categorias: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
          tipo: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao: string
          tipo: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      sco_composicoes: {
        Row: {
          created_at: string
          elementar_codigo: string | null
          elementar_descricao: string | null
          id: string
          quantidade: number
          referencia: string
          reutilizado: string | null
          servico_codigo: string
          unidade: string | null
        }
        Insert: {
          created_at?: string
          elementar_codigo?: string | null
          elementar_descricao?: string | null
          id?: string
          quantidade?: number
          referencia?: string
          reutilizado?: string | null
          servico_codigo: string
          unidade?: string | null
        }
        Update: {
          created_at?: string
          elementar_codigo?: string | null
          elementar_descricao?: string | null
          id?: string
          quantidade?: number
          referencia?: string
          reutilizado?: string | null
          servico_codigo?: string
          unidade?: string | null
        }
        Relationships: []
      }
      sco_elementares: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
          grupo: string | null
          preco: number
          referencia: string
          reutilizado: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao: string
          grupo?: string | null
          preco?: number
          referencia: string
          reutilizado?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
          grupo?: string | null
          preco?: number
          referencia?: string
          reutilizado?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sco_servicos: {
        Row: {
          capitulo: string | null
          capitulo_descricao: string | null
          codigo: string
          created_at: string
          descricao: string
          preco: number
          referencia: string
          secao: string | null
          secao_descricao: string | null
          subsecao: string | null
          subsecao_descricao: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          capitulo?: string | null
          capitulo_descricao?: string | null
          codigo: string
          created_at?: string
          descricao: string
          preco?: number
          referencia: string
          secao?: string | null
          secao_descricao?: string | null
          subsecao?: string | null
          subsecao_descricao?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          capitulo?: string | null
          capitulo_descricao?: string | null
          codigo?: string
          created_at?: string
          descricao?: string
          preco?: number
          referencia?: string
          secao?: string | null
          secao_descricao?: string | null
          subsecao?: string | null
          subsecao_descricao?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scos: {
        Row: {
          cod_sco: string | null
          created_at: string | null
          descricao_sco: string | null
          familia: string | null
          id: string
          tipo: string | null
          unidade: string | null
        }
        Insert: {
          cod_sco?: string | null
          created_at?: string | null
          descricao_sco?: string | null
          familia?: string | null
          id?: string
          tipo?: string | null
          unidade?: string | null
        }
        Update: {
          cod_sco?: string | null
          created_at?: string | null
          descricao_sco?: string | null
          familia?: string | null
          id?: string
          tipo?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      servicos: {
        Row: {
          categoria_id: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_servicos: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string | null
          data_hora_solicitacao: string | null
          descricao_servicos: string | null
          equipamento_id: string | null
          equipamento_nome: string | null
          historico: Json | null
          id: string
          imagens: Json | null
          impresso: boolean
          impresso_em: string | null
          impresso_por: string | null
          local_descricao: string | null
          local_id: string | null
          numero: number
          observacoes: string | null
          pavimento_descricao: string | null
          pavimento_id: string | null
          prioridade: string | null
          ressalva_aprovacao: string | null
          setor_descricao: string | null
          setor_id: string | null
          situacao: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          tipo: string | null
          visitado: boolean
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string | null
          data_hora_solicitacao?: string | null
          descricao_servicos?: string | null
          equipamento_id?: string | null
          equipamento_nome?: string | null
          historico?: Json | null
          id?: string
          imagens?: Json | null
          impresso?: boolean
          impresso_em?: string | null
          impresso_por?: string | null
          local_descricao?: string | null
          local_id?: string | null
          numero: number
          observacoes?: string | null
          pavimento_descricao?: string | null
          pavimento_id?: string | null
          prioridade?: string | null
          ressalva_aprovacao?: string | null
          setor_descricao?: string | null
          setor_id?: string | null
          situacao?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          tipo?: string | null
          visitado?: boolean
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string | null
          data_hora_solicitacao?: string | null
          descricao_servicos?: string | null
          equipamento_id?: string | null
          equipamento_nome?: string | null
          historico?: Json | null
          id?: string
          imagens?: Json | null
          impresso?: boolean
          impresso_em?: string | null
          impresso_por?: string | null
          local_descricao?: string | null
          local_id?: string | null
          numero?: number
          observacoes?: string | null
          pavimento_descricao?: string | null
          pavimento_id?: string | null
          prioridade?: string | null
          ressalva_aprovacao?: string | null
          setor_descricao?: string | null
          setor_id?: string | null
          situacao?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          tipo?: string | null
          visitado?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_grid_column_prefs: {
        Row: {
          column_order: Json
          created_at: string
          id: string
          page_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          column_order?: Json
          created_at?: string
          id?: string
          page_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          column_order?: Json
          created_at?: string
          id?: string
          page_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          auth_user_id: string | null
          cargo_id: string | null
          clientes_permitidos: Json | null
          created_at: string | null
          email: string
          id: string
          limite_aprovacao_compras: number
          limite_aprovacao_os: number
          matricula: string | null
          nome: string
          perfil_acesso_id: string | null
          ramal: string | null
          senha_status: string
          telefone: string | null
        }
        Insert: {
          auth_user_id?: string | null
          cargo_id?: string | null
          clientes_permitidos?: Json | null
          created_at?: string | null
          email?: string
          id?: string
          limite_aprovacao_compras?: number
          limite_aprovacao_os?: number
          matricula?: string | null
          nome?: string
          perfil_acesso_id?: string | null
          ramal?: string | null
          senha_status?: string
          telefone?: string | null
        }
        Update: {
          auth_user_id?: string | null
          cargo_id?: string | null
          clientes_permitidos?: Json | null
          created_at?: string | null
          email?: string
          id?: string
          limite_aprovacao_compras?: number
          limite_aprovacao_os?: number
          matricula?: string | null
          nome?: string
          perfil_acesso_id?: string | null
          ramal?: string | null
          senha_status?: string
          telefone?: string | null
        }
        Relationships: []
      }
      usuarios_credenciais: {
        Row: {
          created_at: string
          senha: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          senha?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          senha?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_credenciais_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campanhas: {
        Row: {
          agendado_para: string | null
          ativo: boolean
          created_at: string
          dias_semana: number[] | null
          hora_envio: string | null
          id: string
          mensagem: string
          modo: string
          nome: string
          proximo_envio: string | null
          recorrencia: string | null
          total_destinatarios: number
          total_erro: number
          total_sucesso: number
          ultimo_envio_em: string | null
          updated_at: string
        }
        Insert: {
          agendado_para?: string | null
          ativo?: boolean
          created_at?: string
          dias_semana?: number[] | null
          hora_envio?: string | null
          id?: string
          mensagem: string
          modo?: string
          nome: string
          proximo_envio?: string | null
          recorrencia?: string | null
          total_destinatarios?: number
          total_erro?: number
          total_sucesso?: number
          ultimo_envio_em?: string | null
          updated_at?: string
        }
        Update: {
          agendado_para?: string | null
          ativo?: boolean
          created_at?: string
          dias_semana?: number[] | null
          hora_envio?: string | null
          id?: string
          mensagem?: string
          modo?: string
          nome?: string
          proximo_envio?: string | null
          recorrencia?: string | null
          total_destinatarios?: number
          total_erro?: number
          total_sucesso?: number
          ultimo_envio_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_envios: {
        Row: {
          campanha_id: string | null
          enviado_em: string
          erro: string | null
          funcionario_id: string | null
          funcionario_nome: string | null
          id: string
          sucesso: boolean
          telefone: string | null
        }
        Insert: {
          campanha_id?: string | null
          enviado_em?: string
          erro?: string | null
          funcionario_id?: string | null
          funcionario_nome?: string | null
          id?: string
          sucesso?: boolean
          telefone?: string | null
        }
        Update: {
          campanha_id?: string | null
          enviado_em?: string
          erro?: string | null
          funcionario_id?: string | null
          funcionario_nome?: string | null
          id?: string
          sucesso?: boolean
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_envios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      arquivar_auditoria:
        | { Args: { _dias?: number }; Returns: number }
        | { Args: { _dias?: number; _lote?: number }; Returns: number }
      arquivar_auditoria_ciclo: { Args: { _dias?: number }; Returns: number }
      current_usuario_id: { Args: never; Returns: string }
      has_module: { Args: { _modulo: string }; Returns: boolean }
      is_acesso_total: { Args: never; Returns: boolean }
      kb_buscar_semantico: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          categoria_nome: string
          conteudo: string
          id: string
          similarity: number
          tipo: string
          titulo: string
        }[]
      }
      processos_seletivos_leves: {
        Args: never
        Returns: {
          candidatos: Json
          created_at: string
          data_criacao: string
          id: string
          numero: number
          requisicao_id: string
        }[]
      }
      refresh_usuario_senha_status: {
        Args: { _usuario_id: string }
        Returns: undefined
      }
      req_header: { Args: { _name: string }; Returns: string }
      strip_anexo_base64: { Args: { _a: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
