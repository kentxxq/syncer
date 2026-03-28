import fs from "fs";
import path from "path";
import { loadConfig, saveConfig, getPackageDir } from "./config";
import { renderTemplate, resolveTargetPath } from "./template";
import type {
  Package,
  SyncConfig,
  SyncStatus,
  TargetStatus,
  PackageStatus,
} from "../../shared/types";

/** 读取包内文件内容 */
export function readPackageFile(pkgName: string, filePath?: string): string {
  const pkgDir = getPackageDir(pkgName);
  // 单文件包默认读取 content，目录包需指定 filePath
  const absPath = filePath ? path.join(pkgDir, filePath) : path.join(pkgDir, "content");
  if (!fs.existsSync(absPath)) return "";
  return fs.readFileSync(absPath, "utf-8");
}

/** 写入包内文件内容 */
export function writePackageFile(pkgName: string, content: string, filePath?: string): void {
  const pkgDir = getPackageDir(pkgName);
  const absPath = filePath ? path.join(pkgDir, filePath) : path.join(pkgDir, "content");
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(absPath, content, "utf-8");
}

/** 删除包内指定文件 */
export function deletePackageFile(pkgName: string, filePath: string): void {
  const pkgDir = getPackageDir(pkgName);
  const absPath = path.join(pkgDir, filePath);
  if (fs.existsSync(absPath)) {
    fs.unlinkSync(absPath);
    // 清理空父目录
    let dir = path.dirname(absPath);
    while (dir !== pkgDir && fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmSync(dir, { recursive: true, force: true });
        dir = path.dirname(dir);
      } else {
        break;
      }
    }
  }
}

/** 在包内创建子目录 */
export function createPackageDir(pkgName: string, dirPath: string): void {
  const pkgDir = getPackageDir(pkgName);
  const absPath = path.join(pkgDir, dirPath);
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }
}

/** 读取目标文件内容 */
export function readTargetFile(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return "";
  return fs.readFileSync(targetPath, "utf-8");
}

// ===================== 状态检查 =====================

/** 检查单文件包某个目标的同步状态 */
function checkFileTargetStatus(pkg: Package, targetPath: string, config: SyncConfig): SyncStatus {
  const resolved = resolveTargetPath(targetPath, config);
  const contentFile = path.join(getPackageDir(pkg.name), "content");
  if (!fs.existsSync(contentFile)) return "missing";
  if (!fs.existsSync(resolved)) return "missing";

  const targetDef = pkg.targets.find((t) => t.path === targetPath);
  const sourceContent = fs.readFileSync(contentFile, "utf-8");
  const rendered =
    targetDef?.template !== false ? renderTemplate(sourceContent, config) : sourceContent;
  const current = fs.readFileSync(resolved, "utf-8");
  return rendered === current ? "synced" : "outdated";
}

/** 检查目录包某个目标的同步状态 */
function checkDirTargetStatus(pkg: Package, targetPath: string, config: SyncConfig): SyncStatus {
  const resolved = resolveTargetPath(targetPath, config);
  const pkgDir = getPackageDir(pkg.name);
  if (!fs.existsSync(pkgDir)) return "missing";
  if (!fs.existsSync(resolved)) return "missing";
  return compareDirs(pkgDir, resolved) ? "synced" : "outdated";
}

/** 递归对比两个目录内容是否一致 */
function compareDirs(srcDir: string, dstDir: string): boolean {
  if (!fs.existsSync(srcDir) || !fs.existsSync(dstDir)) return false;
  const srcEntries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of srcEntries) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      if (!compareDirs(srcPath, dstPath)) return false;
    } else {
      if (!fs.existsSync(dstPath)) return false;
      if (fs.readFileSync(srcPath, "utf-8") !== fs.readFileSync(dstPath, "utf-8")) return false;
    }
  }
  return true;
}

// ===================== 包状态查询 =====================

/** 获取单个包的综合状态 */
export function getPackageStatus(pkg: Package): PackageStatus {
  const config = loadConfig();
  const targetStatuses: TargetStatus[] = pkg.targets.map((t) => {
    const checkFn = pkg.type === "file" ? checkFileTargetStatus : checkDirTargetStatus;
    return {
      path: t.path,
      resolvedPath: resolveTargetPath(t.path, config),
      status: checkFn(pkg, t.path, config),
      template: t.template !== false,
    };
  });
  return { pkg, targetStatuses };
}

/** 获取所有包的状态列表 */
export function listPackageStatuses(): PackageStatus[] {
  const config = loadConfig();
  return config.packages.map((pkg) => getPackageStatus(pkg));
}

// ===================== 目标管理 =====================

/** 为包添加同步目标 */
export function addTarget(pkgName: string, targetPath: string, template = true): void {
  const config = loadConfig();
  const pkg = config.packages.find((p) => p.name === pkgName);
  if (!pkg) return;
  if (!pkg.targets.some((t) => t.path === targetPath)) {
    pkg.targets.push({ path: targetPath, template });
    saveConfig(config);
  }
}

/** 删除包的某个同步目标 */
export function removeTarget(pkgName: string, targetPath: string): void {
  const config = loadConfig();
  const pkg = config.packages.find((p) => p.name === pkgName);
  if (!pkg) return;
  pkg.targets = pkg.targets.filter((t) => t.path !== targetPath);
  saveConfig(config);
}

// ===================== 同步执行 =====================

/** 执行同步（指定包名或全部） */
export function executeSync(pkgName?: string): void {
  const config = loadConfig();
  const packages = pkgName ? config.packages.filter((p) => p.name === pkgName) : config.packages;

  for (const pkg of packages) {
    if (pkg.type === "file") {
      syncFilePackage(pkg, config);
    } else {
      syncDirPackage(pkg, config);
    }
  }
}

/** 同步单文件包：读取 content → 模板渲染 → 写入目标 */
function syncFilePackage(pkg: Package, config: SyncConfig): void {
  const contentFile = path.join(getPackageDir(pkg.name), "content");
  if (!fs.existsSync(contentFile)) return;
  const sourceContent = fs.readFileSync(contentFile, "utf-8");

  for (const target of pkg.targets) {
    const rendered =
      target.template !== false ? renderTemplate(sourceContent, config) : sourceContent;
    const resolved = resolveTargetPath(target.path, config);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, rendered, "utf-8");
  }
}

/** 同步目录包：递归复制整个目录到目标 */
function syncDirPackage(pkg: Package, config: SyncConfig): void {
  const pkgDir = getPackageDir(pkg.name);
  if (!fs.existsSync(pkgDir)) return;

  for (const target of pkg.targets) {
    const resolved = resolveTargetPath(target.path, config);
    copyDirRecursive(pkgDir, resolved);
  }
}

/** 递归复制目录 */
function copyDirRecursive(src: string, dst: string): void {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}
