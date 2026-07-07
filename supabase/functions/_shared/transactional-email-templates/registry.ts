import { template as credenciaisAcesso } from './credenciais-acesso.tsx'

export type TemplateEntry = {
  component: (props: any) => any
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string | ((data: any) => string)
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'credenciais-acesso': credenciaisAcesso,
}