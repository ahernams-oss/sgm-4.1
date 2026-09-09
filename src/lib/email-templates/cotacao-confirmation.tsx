import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section, Img,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = "LASANT CONSTRUÇÕES"
const LOGO_URL = "https://coordinate-finder.lovable.app/__l5e/assets-v1/5a89feaa-50bb-4659-ad17-c29629bff31f/logo-lasant.png"

interface CotacaoConfirmationProps {
  fornecedorNome?: string
  cotacaoNumero?: number
  comprador?: string
  link?: string
  pdfUrl?: string
  nomeEmpresa?: string
}

const CotacaoConfirmationEmail = ({
  fornecedorNome,
  cotacaoNumero,
  comprador,
  link,
  pdfUrl,
  nomeEmpresa,
}: CotacaoConfirmationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {` — Solicitação de Cotação #`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} width="164" height="67" alt="Lasant Construções" style={logo} />
          <Heading style={h1}>{nomeEmpresa || SITE_NAME}</Heading>
          <Text style={subtitle}>Solicitação de Cotação</Text>
        </Section>

        <Hr style={divider} />

        <Text style={text}>
          Prezado(a) <strong>{fornecedorNome || 'Fornecedor'}</strong>,
        </Text>

        <Text style={text}>
          Convidamos sua empresa a participar do nosso processo de cotação{' '}
          <strong>#{cotacaoNumero || '---'}</strong>.
        </Text>

        <Text style={text}>
          Para enviar sua proposta de preços, acesse o link abaixo e preencha
          os valores solicitados:
        </Text>

        {link && (
          <Section style={buttonSection}>
            <Button style={button} href={link}>
              Enviar Proposta
            </Button>
          </Section>
        )}

        {pdfUrl && (
          <>
            <Text style={text}>
              Em anexo, segue o <strong>PDF da cotação</strong> com todos os itens e condições solicitadas:
            </Text>
            <Section style={buttonSection}>
              <Button style={button} href={pdfUrl}>
                Baixar PDF da Cotação
              </Button>
            </Section>
          </>
        )}

        <Text style={textSmall}>
          Caso não consiga clicar no botão, copie e cole o link no seu navegador:
        </Text>
        {link && <Text style={linkText}>{link}</Text>}
        {pdfUrl && <Text style={linkText}>{pdfUrl}</Text>}

        <Hr style={divider} />

        <Text style={footer}>
          Atenciosamente,
          <br />
          {comprador || 'Departamento de Compras'}
          <br />
          {nomeEmpresa || SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CotacaoConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `${data.nomeEmpresa || SITE_NAME} — Solicitação de Cotação #${data.cotacaoNumero || ''}`,
  displayName: 'Solicitação de Cotação',
  previewData: {
    fornecedorNome: 'Fornecedor Exemplo LTDA',
    cotacaoNumero: 123,
    comprador: 'João Silva',
    link: 'https://example.com/cotacao/proposta/abc123',
    nomeEmpresa: 'LASANT CONSTRUÇÕES LTDA',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '24px 32px', maxWidth: '580px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, paddingBottom: '8px' }
const logo = { display: 'block', margin: '0 auto 16px', maxWidth: '164px', height: 'auto' }
const h1 = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1e3a6e',
  margin: '0 0 4px',
}
const subtitle = {
  fontSize: '16px',
  color: '#4a5568',
  margin: '0',
  fontWeight: '500' as const,
}
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '14px', color: '#2d3748', lineHeight: '1.6', margin: '0 0 14px' }
const textSmall = { fontSize: '12px', color: '#718096', lineHeight: '1.5', margin: '0 0 4px' }
const linkText = { fontSize: '12px', color: '#1e3a6e', wordBreak: 'break-all' as const, margin: '0 0 14px' }
const buttonSection = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: '#1e3a6e',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  padding: '12px 32px',
  borderRadius: '6px',
  textDecoration: 'none',
}
const footer = { fontSize: '13px', color: '#718096', lineHeight: '1.6', margin: '0' }
