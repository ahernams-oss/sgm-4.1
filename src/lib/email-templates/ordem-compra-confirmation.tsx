import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Button,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = "LASANT CONSTRUÇÕES"

interface OrdemCompraProps {
  fornecedorNome?: string
  pedidoNumero?: number
  valorTotal?: string
  condicaoPagamento?: string
  prazoEntrega?: string
  comprador?: string
  nomeEmpresa?: string
  pdfUrl?: string
}

const OrdemCompraConfirmationEmail = ({
  fornecedorNome,
  pedidoNumero,
  valorTotal,
  condicaoPagamento,
  prazoEntrega,
  comprador,
  nomeEmpresa,
  pdfUrl,
}: OrdemCompraProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {` — Ordem de Compra #`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{nomeEmpresa || SITE_NAME}</Heading>
          <Text style={subtitle}>Ordem de Compra</Text>
        </Section>

        <Hr style={divider} />

        <Text style={text}>
          Prezado(a) <strong>{fornecedorNome || 'Fornecedor'}</strong>,
        </Text>

        <Text style={text}>
          Informamos que foi emitida a Ordem de Compra{' '}
          <strong>#{pedidoNumero || '---'}</strong> para sua empresa.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Nº Pedido</Text>
          <Text style={detailValue}>#{pedidoNumero || '---'}</Text>

          {valorTotal && (
            <>
              <Text style={detailLabel}>Valor Total</Text>
              <Text style={detailValue}>{valorTotal}</Text>
            </>
          )}

          {condicaoPagamento && (
            <>
              <Text style={detailLabel}>Condição de Pagamento</Text>
              <Text style={detailValue}>{condicaoPagamento}</Text>
            </>
          )}

          {prazoEntrega && (
            <>
              <Text style={detailLabel}>Prazo de Entrega</Text>
              <Text style={detailValue}>{prazoEntrega}</Text>
            </>
          )}
        </Section>

        {pdfUrl ? (
          <Section style={buttonSection}>
            <Button style={downloadButton} href={pdfUrl}>
              Baixar Ordem de Compra (PDF)
            </Button>
          </Section>
        ) : (
          <Text style={text}>
            O PDF da Ordem de Compra será disponibilizado para download conforme procedimento interno.
          </Text>
        )}

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
  component: OrdemCompraConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `${data.nomeEmpresa || SITE_NAME} — Ordem de Compra #${data.pedidoNumero || ''}`,
  displayName: 'Ordem de Compra',
  previewData: {
    fornecedorNome: 'Fornecedor Exemplo LTDA',
    pedidoNumero: 456,
    valorTotal: 'R$ 15.000,00',
    condicaoPagamento: '30/60/90 dias',
    prazoEntrega: '15 dias úteis',
    comprador: 'João Silva',
    nomeEmpresa: 'LASANT CONSTRUÇÕES LTDA',
    pdfUrl: 'https://example.com/ordem.pdf',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '24px 32px', maxWidth: '580px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, paddingBottom: '8px' }
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
const detailsBox = {
  backgroundColor: '#f7fafc',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
  border: '1px solid #e2e8f0',
}
const detailLabel = {
  fontSize: '11px',
  color: '#718096',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 2px',
  fontWeight: '600' as const,
}
const detailValue = {
  fontSize: '14px',
  color: '#1a202c',
  margin: '0 0 12px',
  fontWeight: '500' as const,
}
const buttonSection = { textAlign: 'center' as const, margin: '24px 0' }
const downloadButton = {
  backgroundColor: '#1e3a6e',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
}
const footer = { fontSize: '13px', color: '#718096', lineHeight: '1.6', margin: '0' }
