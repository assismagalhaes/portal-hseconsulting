/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
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
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clienteNome?: string
  destinatarioNome?: string
  propostaNumero?: string
  propostaTitulo?: string
  valorTotal?: string
  validade?: string
  linkAceite?: string
  remetenteNome?: string
  mensagemPersonalizada?: string
}

const Email = ({
  clienteNome = '',
  destinatarioNome = '',
  propostaNumero = '',
  propostaTitulo = '',
  valorTotal = '',
  validade = '',
  linkAceite = '',
  remetenteNome = 'Equipe HSE Consulting',
  mensagemPersonalizada = '',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      Proposta {propostaNumero} disponível para aceite eletrônico
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>HSE Consulting</Heading>
        </Section>

        <Section style={content}>
          <Heading as="h1" style={h1}>Proposta pronta para aceite</Heading>
          <Text style={text}>Olá {destinatarioNome || 'time'},</Text>
          <Text style={text}>
            Encaminhamos a proposta comercial <strong>{propostaNumero}</strong>
            {clienteNome ? <> destinada a <strong>{clienteNome}</strong></> : null} para sua análise e aceite eletrônico.
          </Text>

          {mensagemPersonalizada ? (
            <Section style={msgBox}>
              <Text style={msgText}>{mensagemPersonalizada}</Text>
            </Section>
          ) : null}

          <Section style={credBox}>
            <Text style={credLabel}>Proposta</Text>
            <Text style={credValue}>{propostaNumero}{propostaTitulo ? ` — ${propostaTitulo}` : ''}</Text>
            {valorTotal ? (
              <>
                <Hr style={hr} />
                <Text style={credLabel}>Valor total</Text>
                <Text style={credValue}>{valorTotal}</Text>
              </>
            ) : null}
            {validade ? (
              <>
                <Hr style={hr} />
                <Text style={credLabel}>Validade</Text>
                <Text style={credValue}>{validade}</Text>
              </>
            ) : null}
          </Section>

          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Button href={linkAceite} style={button}>
              Visualizar e assinar proposta
            </Button>
          </Section>

          <Text style={muted}>
            Ao clicar no botão acima você acessa a proposta completa e pode registrar seu aceite ou recusa
            com assinatura eletrônica. O link é único e vinculado a esta proposta — não o compartilhe com terceiros.
          </Text>

          <Text style={{ ...text, marginTop: '20px' }}>
            Qualquer dúvida, é só responder este e-mail.
          </Text>
          <Text style={text}>
            Atenciosamente,<br />
            <strong>{remetenteNome}</strong>
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>HSE Consulting — Segurança do Trabalho e Meio Ambiente</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: any) => `Proposta ${data?.propostaNumero || ''} — aceite eletrônico`,
  displayName: 'Proposta • Link de aceite',
  previewData: {
    clienteNome: 'Novaterra Ambiental',
    destinatarioNome: 'Maria Silva',
    propostaNumero: 'P-2026-90014',
    propostaTitulo: 'Elaboração de PGR e PCMSO',
    valorTotal: 'R$ 24.800,00',
    validade: '31/12/2026',
    linkAceite: 'https://portal.hseconsulting.com.br/aceite/exemplo-token',
    remetenteNome: 'Equipe HSE Consulting',
    mensagemPersonalizada: 'Segue conforme conversado. Fico à disposição.',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const header = {
  background: 'linear-gradient(135deg, #0b1c3f 0%, #17408b 55%, #17a34a 100%)',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
}
const brand = { color: '#ffffff', fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }
const content = { padding: '24px 4px 8px' }
const h1 = { color: '#0b1c3f', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px' }
const credBox = {
  backgroundColor: '#f1f5f9',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px 18px',
  margin: '16px 0',
}
const credLabel = {
  color: '#64748b',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.6px',
  margin: '0 0 4px',
}
const credValue = {
  color: '#0b1c3f',
  fontSize: '16px',
  fontWeight: 600,
  margin: '0 0 4px',
  wordBreak: 'break-word' as const,
}
const msgBox = {
  backgroundColor: '#eef7ff',
  borderLeft: '4px solid #17408b',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '12px 0 16px',
}
const msgText = { color: '#0b1c3f', fontSize: '14px', lineHeight: '21px', margin: 0, whiteSpace: 'pre-wrap' as const }
const button = {
  backgroundColor: '#17a34a',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '10px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const muted = { color: '#64748b', fontSize: '13px', lineHeight: '20px', margin: '16px 0 0' }
const hr = { borderColor: '#e2e8f0', margin: '20px 0' }
const footer = { color: '#94a3b8', fontSize: '12px', textAlign: 'center' as const, margin: 0 }