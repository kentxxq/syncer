import fs from 'fs'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'
import type { SyncConfig } from '../../shared/types'

/** 默认配置目录 */
const CONFIG_DIR = path.join(os.homedir(), '.config', 'syncer')
/** 默认配置文件路径 */
const CONFIG_FILE = path.join(CONFIG_DIR, 'syncer.yaml')
/** 同步包存储目录 */
const PACKAGES_DIR = path.join(CONFIG_DIR, 'packages')
/** Git 仓库缓存目录 */
const CACHE_DIR = path.join(CONFIG_DIR, '.cache')

export function getConfigDir(): string {
  return CONFIG_DIR
}

export function getPackagesDir(): string {
  return PACKAGES_DIR
}

export function getCacheDir(): string {
  return CACHE_DIR
}

export function getPackageDir(pkgName: string): string {
  return path.join(PACKAGES_DIR, pkgName)
}

function ensureDirectories(): void {
  for (const dir of [CONFIG_DIR, PACKAGES_DIR, CACHE_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

function createDefaultConfig(): SyncConfig {
  return {
    variables: {
      git_email: 'fake_email',
      git_name: 'fake_username'
    },
    packages: []
  }
}

export function loadConfig(): SyncConfig {
  ensureDirectories()

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = createDefaultConfig()
    saveConfig(defaultConfig)
    return defaultConfig
  }

  const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
  const config = yaml.load(content) as SyncConfig

  return {
    variables: config?.variables || {},
    packages: config?.packages || []
  }
}

export function saveConfig(config: SyncConfig): void {
  ensureDirectories()
  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    noRefs: true
  })
  fs.writeFileSync(CONFIG_FILE, content, 'utf-8')
}

/** 创建新的本地包 */
export function createPackage(name: string, type: 'file' | 'directory'): void {
  ensureDirectories()
  const pkgDir = getPackageDir(name)
  if (!fs.existsSync(pkgDir)) {
    fs.mkdirSync(pkgDir, { recursive: true })
  }
  // 单文件包创建空 content 文件
  if (type === 'file') {
    const contentFile = path.join(pkgDir, 'content')
    if (!fs.existsSync(contentFile)) {
      fs.writeFileSync(contentFile, '', 'utf-8')
    }
  }
  // 添加到配置
  const config = loadConfig()
  if (!config.packages.some((p) => p.name === name)) {
    config.packages.push({ name, type, targets: [] })
    saveConfig(config)
  }
}

/** 删除包（文件 + 配置） */
export function deletePackage(name: string): void {
  const pkgDir = getPackageDir(name)
  if (fs.existsSync(pkgDir)) {
    fs.rmSync(pkgDir, { recursive: true, force: true })
  }
  const config = loadConfig()
  config.packages = config.packages.filter((p) => p.name !== name)
  saveConfig(config)
}

/** 列出包内文件的相对路径列表 */
export function listPackageFiles(pkgName: string): string[] {
  const pkgDir = getPackageDir(pkgName)
  if (!fs.existsSync(pkgDir)) return []

  const results: string[] = []
  function walk(dir: string, prefix: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel)
      } else {
        results.push(rel)
      }
    }
  }
  walk(pkgDir, '')
  return results
}

/** 列出包内指定子路径下的直接子项（文件+目录） */
export function listPackageEntries(
  pkgName: string,
  subPath?: string
): { name: string; type: 'file' | 'directory' }[] {
  const pkgDir = getPackageDir(pkgName)
  const targetDir = subPath ? path.join(pkgDir, subPath) : pkgDir
  if (!fs.existsSync(targetDir)) return []

  const entries = fs.readdirSync(targetDir, { withFileTypes: true })
  return entries
    .map((entry) => ({
      name: entry.name,
      type: (entry.isDirectory() ? 'directory' : 'file') as 'file' | 'directory'
    }))
    .sort((a, b) => {
      // 目录排前面，同类型按名称排序
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}
