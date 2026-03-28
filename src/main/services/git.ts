import simpleGit from 'simple-git'
import fs from 'fs'
import path from 'path'
import { loadConfig, saveConfig, getCacheDir, getPackageDir } from './config'

/** 根据 Git URL 生成缓存目录名 */
function getCacheRepoDir(gitUrl: string): string {
  // https://github.com/obra/superpowers.git → github.com-obra-superpowers
  const cleaned = gitUrl
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[/\\:]/g, '-')
  return path.join(getCacheDir(), cleaned)
}

/** 递归复制目录 */
function copyDirRecursive(src: string, dst: string): void {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const dstPath = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath)
    } else {
      fs.copyFileSync(srcPath, dstPath)
    }
  }
}

/** 确保仓库已克隆到缓存目录，返回缓存路径 */
async function ensureCloned(gitUrl: string, branch?: string): Promise<string> {
  const repoDir = getCacheRepoDir(gitUrl)

  if (fs.existsSync(path.join(repoDir, '.git'))) {
    // 已存在，fetch 最新
    const git = simpleGit(repoDir)
    await git.fetch()
    return repoDir
  }

  // 首次克隆
  const parentDir = path.dirname(repoDir)
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true })
  await simpleGit().clone(gitUrl, repoDir, ['--branch', branch || 'main'])
  return repoDir
}

/** 从仓库缓存复制指定子路径内容到包目录 */
function copySubPathToPackage(repoDir: string, subPath: string, pkgDir: string): void {
  const srcDir = path.join(repoDir, subPath)
  if (!fs.existsSync(srcDir)) {
    throw new Error(`子路径不存在: ${subPath}`)
  }
  // 清空目标后复制
  if (fs.existsSync(pkgDir)) fs.rmSync(pkgDir, { recursive: true, force: true })
  fs.mkdirSync(pkgDir, { recursive: true })
  copyDirRecursive(srcDir, pkgDir)
}

/** 从 Git 仓库导入包 */
export async function importFromGit(
  name: string,
  gitUrl: string,
  subPath: string,
  branch?: string
): Promise<void> {
  const repoDir = await ensureCloned(gitUrl, branch)
  const git = simpleGit(repoDir)

  // 获取当前 commit hash
  const log = await git.log({ maxCount: 1 })
  const version = log.latest?.hash || 'unknown'

  // 复制内容到包目录
  const pkgDir = getPackageDir(name)
  copySubPathToPackage(repoDir, subPath, pkgDir)

  // 更新配置
  const config = loadConfig()
  if (!config.packages.some((p) => p.name === name)) {
    config.packages.push({
      name,
      type: 'directory',
      origin: {
        git: gitUrl,
        path: subPath,
        branch: branch || 'main',
        version
      },
      targets: []
    })
    saveConfig(config)
  }
}

/** 检查包是否有上游新版本 */
export async function checkUpdate(
  pkgName: string
): Promise<{ hasUpdate: boolean; latestVersion?: string }> {
  const config = loadConfig()
  const pkg = config.packages.find((p) => p.name === pkgName)
  if (!pkg?.origin) return { hasUpdate: false }

  const repoDir = await ensureCloned(pkg.origin.git, pkg.origin.branch)
  const git = simpleGit(repoDir)
  await git.fetch()

  // 获取远程最新 commit
  const branch = pkg.origin.branch || 'main'
  const log = await git.log({ maxCount: 1, from: `origin/${branch}` })
  const latestVersion = log.latest?.hash || 'unknown'
  const hasUpdate = latestVersion !== pkg.origin.version

  return { hasUpdate, latestVersion }
}

/** 拉取上游更新并覆盖本地包内容 */
export async function pullUpdate(pkgName: string): Promise<void> {
  const config = loadConfig()
  const pkg = config.packages.find((p) => p.name === pkgName)
  if (!pkg?.origin) return

  const repoDir = await ensureCloned(pkg.origin.git, pkg.origin.branch)
  const git = simpleGit(repoDir)
  await git.pull()

  // 获取最新版本 hash
  const log = await git.log({ maxCount: 1 })
  const latestVersion = log.latest?.hash || 'unknown'

  // 复制新内容到包目录
  copySubPathToPackage(repoDir, pkg.origin.path, getPackageDir(pkgName))

  // 更新配置中的版本号
  pkg.origin.version = latestVersion
  saveConfig(config)
}
