import os from 'os'

/**
 * 收集系统变量，自动注入到模板渲染上下文
 * 这些变量是只读的，不存储在配置文件中
 */
export function getSystemVariables(): Record<string, string> {
  return {
    home: os.homedir(),
    username: os.userInfo().username,
    hostname: os.hostname(),
    os: os.type(),
    arch: os.arch(),
    platform: process.platform,
    shell: process.env.SHELL || process.env.COMSPEC || '',
    tmpdir: os.tmpdir()
  }
}
