import * as React from 'react'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as cotacaoConfirmation } from './cotacao-confirmation.tsx'
import { template as ordemCompraConfirmation } from './ordem-compra-confirmation.tsx'
import { template as passwordReset } from './password-reset.tsx'
import { template as assinaturaOtp } from './assinatura-otp.tsx'
import { template as mapaFeriasRelatorio } from './mapa-ferias-relatorio.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'cotacao-confirmation': cotacaoConfirmation,
  'ordem-compra-confirmation': ordemCompraConfirmation,
  'password-reset': passwordReset,
  'assinatura-otp': assinaturaOtp,
  'mapa-ferias-relatorio': mapaFeriasRelatorio,
}
