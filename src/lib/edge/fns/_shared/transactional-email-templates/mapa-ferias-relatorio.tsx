import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry.ts'

interface Props {
  empresa?: string
  motivo?: string
  pdfUrl?: string
  excelUrl?: string
  total?: number
  vencidas?: number
  criticas?: number
  atencao?: number
  semCobertura?: number
  geradoEm?: string
}

const Email = ({
  empresa = 'LASANT',
  motivo,
  pdfUrl,
  excelUrl,
  total = 0,
  vencidas = 0,
  criticas = 0,
  atencao = 0,
  semCobertura = 0,
  geradoEm,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Mapa de Férias atualizado — relatórios em PDF e Excel</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{empresa}</Text>
          <Heading style={h1}>Mapa de Férias atualizado</Heading>
        </Section>

        <Text style={text}>
          Os relatórios do Mapa de Férias foram gerados automaticamente após uma atualização no módulo.
        </Text>
        {motivo ? <Text style={muted}>Motivo: {motivo}</Text> : null}
        {geradoEm ? <Text style={muted}>Gerado em: {geradoEm}</Text> : null}

        <Section style={box}>
          <Text style={item}>Total de períodos: <b>{total}</b></Text>
          <Text style={item}>Vencidas: <b style={{ color: '#dc2626' }}>{vencidas}</b></Text>
          <Text style={item}>Críticas (≤30 dias): <b style={{ color: '#dc2626' }}>{criticas}</b></Text>
          <Text style={item}>Atenção (31–60 dias): <b style={{ color: '#d97706' }}>{atencao}</b></Text>
          <Text style={item}>Sem cobertura interna: <b style={{ color: '#dc2626' }}>{semCobertura}</b></Text>
        </Section>

        {pdfUrl ? (
          <Button style={btn} href={pdfUrl}>
            Baixar relatório em PDF
          </Button>
        ) : null}
        {excelUrl ? (
          <Button style={{ ...btn, backgroundColor: '#1e3a6b' }} href={excelUrl}>
            Baixar planilha em Excel
          </Button>
        ) : null}

        <Hr style={hr} />
        <Text style={muted}>
          CLT Art. 134 — a concessão das férias deve ocorrer em até 12 meses após o término do período aquisitivo.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Mapa de Férias atualizado — relatórios PDF e Excel',
  displayName: 'Relatório do Mapa de Férias (RH)',
  previewData: {
    empresa: 'LASANT',
    motivo: 'Novo período de férias cadastrado',
    pdfUrl: 'https://example.com/relatorio.pdf',
    excelUrl: 'https://example.com/relatorio.xlsx',
    total: 42,
    vencidas: 2,
    criticas: 5,
    atencao: 7,
    semCobertura: 1,
    geradoEm: '28/08/2026, 21:00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '600px' }
const header = { borderBottom: '3px solid #673ab7', paddingBottom: '12px', marginBottom: '16px' }
const brand = { margin: '0', fontSize: '13px', letterSpacing: '2px', color: '#673ab7', fontWeight: 'bold' as const }
const h1 = { margin: '6px 0 0', fontSize: '22px', color: '#1e3a6b' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '22px' }
const muted = { fontSize: '12px', color: '#6b7280', margin: '4px 0' }
const box = {
  backgroundColor: '#f5f7fa',
  borderRadius: '12px',
  padding: '14px 18px',
  margin: '18px 0',
}
const item = { fontSize: '13px', color: '#333333', margin: '4px 0' }
const btn = {
  backgroundColor: '#673ab7',
  color: '#ffffff',
  borderRadius: '12px',
  padding: '12px 20px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'block',
  textAlign: 'center' as const,
  marginBottom: '10px',
}
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
