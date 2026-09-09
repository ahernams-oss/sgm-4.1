import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as cotacaoConfirmation } from './cotacao-confirmation'
import { template as ordemCompraConfirmation } from './ordem-compra-confirmation'
import { template as passwordReset } from './password-reset'
import { template as assinaturaOtp } from './assinatura-otp'
import { template as mapaFeriasRelatorio } from './mapa-ferias-relatorio'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'cotacao-confirmation': cotacaoConfirmation,
  'ordem-compra-confirmation': ordemCompraConfirmation,
  'password-reset': passwordReset,
  'assinatura-otp': assinaturaOtp,
  'mapa-ferias-relatorio': mapaFeriasRelatorio,
}
