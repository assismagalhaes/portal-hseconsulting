import { template as credenciaisAcesso } from './credenciais-acesso.tsx'
import { template as propostaAceiteLink } from './proposta-aceite-link.tsx'

export type TemplateEntry = {
  component: (props: any) => any
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string | ((data: any) => string)
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'credenciais-acesso': credenciaisAcesso,
  'proposta-aceite-link': propostaAceiteLink,
}