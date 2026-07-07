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
  nome?: string
  email?: string
  senhaProvisoria?: string
  portalUrl?: string
  reativado?: boolean
}

const Email = ({
  nome = 'usuário',
  email = '',
  senhaProvisoria = '',
  portalUrl = 'https://portal-hseconsulting.lovable.app/auth',
  reativado = false,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {reativado
        ? 'Seu acesso ao Portal HSE Consulting foi reativado'
        : 'Seu acesso ao Portal HSE Consulting foi criado'}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>HSE Consulting</Heading>
        </Section>

        <Section style={content}>
          <Heading as="h1" style={h1}>
            {reativado ? 'Acesso reativado' : 'Bem-vindo(a) ao Portal HSE'}
          </Heading>
          <Text style={text}>Olá {nome},</Text>
          <Text style={text}>
            {reativado
              ? 'Seu acesso ao Portal HSE Consulting foi reativado. Utilize as credenciais abaixo para entrar. No primeiro acesso, você será solicitado(a) a definir uma nova senha pessoal.'
              : 'Seu acesso ao Portal HSE Consulting foi criado. Utilize as credenciais abaixo para entrar. No primeiro acesso, você será solicitado(a) a definir uma nova senha pessoal.'}
          </Text>

          <Section style={credBox}>
            <Text style={credLabel}>E-mail</Text>
            <Text style={credValue}>{email}</Text>
            <Hr style={hr} />
            <Text style={credLabel}>Senha provisória</Text>
            <Text style={credValue}>{senhaProvisoria}</Text>
          </Section>

          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Button href={portalUrl} style={button}>
              Acessar o portal
            </Button>
          </Section>

          <Text style={muted}>
            Por segurança, esta senha é temporária e deve ser trocada no primeiro acesso.
            Se você não esperava este e-mail, ignore-o ou entre em contato com o administrador.
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
  subject: (data: any) =>
    data?.reativado
      ? 'Seu acesso ao Portal HSE foi reativado'
      : 'Suas credenciais de acesso ao Portal HSE',
  displayName: 'Credenciais de acesso',
  previewData: {
    nome: 'Maria Silva',
    email: 'maria@empresa.com.br',
    senhaProvisoria: 'Abc123XyZ!',
    portalUrl: 'https://portal-hseconsulting.lovable.app/auth',
    reativado: false,
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px',
}
const header = {
  background: 'linear-gradient(135deg, #0b1c3f 0%, #17408b 55%, #17a34a 100%)',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
}
const brand = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700,
  margin: 0,
  letterSpacing: '0.5px',
}
const content = { padding: '24px 4px 8px' }
const h1 = {
  color: '#0b1c3f',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 12px',
}
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
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontWeight: 600,
  margin: '0 0 4px',
  wordBreak: 'break-all' as const,
}
const button = {
  backgroundColor: '#17a34a',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '10px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const muted = { color: '#64748b', fontSize: '13px', lineHeight: '20px', margin: '16px 0 0' }
const hr = { borderColor: '#e2e8f0', margin: '20px 0' }
const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: 0,
}