import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = "LASANT CONSTRUÇÕES"

interface PasswordResetProps {
  nomeUsuario?: string
  senhaTemporaria?: string
  nomeEmpresa?: string
}

const PasswordResetEmail = ({ nomeUsuario, senhaTemporaria, nomeEmpresa }: PasswordResetProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {nomeEmpresa || SITE_NAME} — Recuperação de senha
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{nomeEmpresa || SITE_NAME}</Heading>
          <Text style={subtitle}>Recuperação de Senha</Text>
        </Section>

        <Hr style={divider} />

        <Text style={text}>
          Olá <strong>{nomeUsuario || 'Usuário'}</strong>,
        </Text>

        <Text style={text}>
          Recebemos uma solicitação de recuperação de senha para a sua conta. Sua nova senha temporária é:
        </Text>

        <Section style={codeBox}>
          <Text style={code}>{senhaTemporaria}</Text>
        </Section>

        <Text style={text}>
          Por motivos de segurança, recomendamos que você acesse o sistema e altere essa senha no seu cadastro de usuário assim que possível.
        </Text>

        <Text style={textMuted}>
          Se você não solicitou esta recuperação, entre em contato com o administrador do sistema imediatamente.
        </Text>

        <Hr style={divider} />

        <Text style={footer}>
          {nomeEmpresa || SITE_NAME} — Mensagem automática, por favor não responda.
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
const codeBox = {
  backgroundColor: '#f5f3ff', borderRadius: '8px',
  margin: '24px 32px', padding: '20px', textAlign: 'center' as const,
  border: '2px dashed #673ab7',
}
const code = {
  color: '#673ab7', fontSize: '28px', fontWeight: 700,
  letterSpacing: '4px', margin: 0, fontFamily: 'monospace',
}
const footer = {
  color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const,
  padding: '16px 32px 24px', margin: 0,
}

export const template: TemplateEntry = {
  component: PasswordResetEmail,
  subject: 'Recuperação de Senha — LASANT CONSTRUÇÕES',
  displayName: 'Recuperação de Senha',
  previewData: {
    nomeUsuario: 'João Silva',
    senhaTemporaria: 'Abc12345',
    nomeEmpresa: 'LASANT CONSTRUÇÕES',
  },
}
