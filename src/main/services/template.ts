import Handlebars from 'handlebars'
import { getSystemVariables } from './system'
import type { SyncConfig } from '../../shared/types'

/**
 * 渲染模板内容
 * 上下文 = 系统变量 + 用户自定义变量（用户变量优先级更高）
 */
export function renderTemplate(content: string, config: SyncConfig): string {
  const systemVars = getSystemVariables()
  // 用户变量覆盖同名系统变量
  const context = { ...systemVars, ...config.variables }
  const template = Handlebars.compile(content, { noEscape: true })
  return template(context)
}

/**
 * 渲染目标路径中的模板变量
 * 例如 {{home}}/.zshrc => /Users/xxx/.zshrc
 */
export function resolveTargetPath(targetPattern: string, config: SyncConfig): string {
  return renderTemplate(targetPattern, config)
}
