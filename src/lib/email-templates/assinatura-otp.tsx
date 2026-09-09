import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'LASANT CONSTRUÇÕES'

interface AssinaturaOtpProps {
  nomeUsuario?: string
  codigo?: string
  documento?: string
  papel?: string
}

const AssinaturaOtpEmail = ({ nomeUsuario, codigo, documento, papel }: AssinaturaOtpProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Código de assinatura eletrônica: ${codigo ?? ""}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{SITE_NAME}</Heading>
          <Text style={subtitle}>Assinatura Eletrônica Avançada</Text>
        </Section>

        <Hr style={divider} />

        <Text style={text}>
          Olá <strong>{nomeUsuario || 'Usuário'}</strong>,
        </Text>

        <Text style={text}>
          Foi solicitada a assinatura eletrônica do documento{' '}
          <strong>{documento || '-'}</strong>
          {papel ? <> na qualidade de <strong>{papel}</strong></> : null}. Use o código abaixo
          para concluir a assinatura:
        </Text>

        <Section style={codeBoxWrapper}>
          <Section style={codeBox}>
            <Text style={code}>{codigo}</Text>
          </Section>
        </Section>

        <Text style={textMuted}>
          O código é válido por 10 minutos e de uso único. Ao informá-lo, você confirma sua
          identidade como signatário, nos termos do Art. 4º, II da Lei nº 14.063/2020.
        </Text>

        <Text style={textMuted}>
          Se você não solicitou esta assinatura, ignore este e-mail e comunique imediatamente
          o administrador do sistema.
        </Text>

        <Hr style={divider} />

        <Text style={footer}>
          {SITE_NAME} — Mensagem automática, por favor não responda.
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = {
  backgroundColor: '#f5f3ff',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  margin: 0, padding: '40px 20px',
}
const container = {
  backgroundColor: '#ffffff', maxWidth: '600px', margin: '0 auto',
  borderRadius: '12px', overflow: 'hidden',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
}
const headerSection = { padding: '32px 32px 16px', textAlign: 'center' as const }
const h1 = { color: '#673ab7', fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }
const subtitle = { color: '#6b7280', fontSize: '14px', margin: 0 }
const divider = { borderColor: '#e5e7eb', margin: '0 32px' }
const text = { color: '#374151', fontSize: '15px', lineHeight: '24px', padding: '0 32px', margin: '16px 0' }
const textMuted = { color: '#6b7280', fontSize: '13px', lineHeight: '20px', padding: '0 32px', margin: '16px 0' }
const codeBoxWrapper = { padding: '24px 32px' }
const codeBox = {
  backgroundColor: '#f5f3ff', borderRadius: '8px',
  padding: '20px', textAlign: 'center' as const,
  border: '2px dashed #673ab7',
}
const code = {
  color: '#673ab7', fontSize: '30px', fontWeight: 700,
  letterSpacing: '8px', margin: 0, fontFamily: 'monospace',
}
const footer = {
  color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const,
  padding: '16px 32px 24px', margin: 0,
}

export const template: TemplateEntry = {
  component: AssinaturaOtpEmail,
  subject: 'Código de assinatura eletrônica — LASANT CONSTRUÇÕES',
  displayName: 'Token de Assinatura Eletrônica',
  previewData: {
    nomeUsuario: 'João Silva',
    codigo: '482913',
    documento: 'Ordem de Serviço nº 120',
    papel: 'Fiscal do Contrato',
  },
}
