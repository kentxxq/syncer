/** 上游来源 */
export interface PackageOrigin {
  /** Git 仓库 URL */
  git: string;
  /** 仓库内子路径 */
  path: string;
  /** 分支，默认 main */
  branch?: string;
  /** 锁定的 commit hash */
  version: string;
}

/** 同步目标 */
export interface PackageTarget {
  /** 目标路径，支持 handlebars 模板变量 */
  path: string;
  /** 是否启用模板渲染（仅 file 包有效），默认 true */
  template?: boolean;
}

/** 同步包 */
export interface Package {
  /** 包名称，唯一标识 */
  name: string;
  /** 包类型 */
  type: "file" | "directory";
  /** 上游来源（可选） */
  origin?: PackageOrigin;
  /** 同步目标列表 */
  targets: PackageTarget[];
}

/** 同步状态 */
export type SyncStatus = "synced" | "outdated" | "missing";

/** 目录条目（文件管理器用） */
export interface DirEntry {
  /** 条目名称 */
  name: string;
  /** 条目类型 */
  type: "file" | "directory";
}

/** 目标同步状态 */
export interface TargetStatus {
  /** 目标路径模板 */
  path: string;
  /** 解析后的实际路径 */
  resolvedPath: string;
  /** 同步状态 */
  status: SyncStatus;
  /** 是否启用模板渲染 */
  template: boolean;
}

/** 包的综合状态信息（前端展示用） */
export interface PackageStatus {
  /** 包基本信息 */
  pkg: Package;
  /** 所有目标的同步状态 */
  targetStatuses: TargetStatus[];
  /** 是否有上游新版本 */
  hasUpdate?: boolean;
  /** 上游最新版本 hash */
  latestVersion?: string;
}

/** 主配置 */
export interface SyncConfig {
  /** 用户自定义变量 */
  variables: Record<string, string>;
  /** 同步包列表 */
  packages: Package[];
}

/** IPC API 接口定义 */
export interface SyncerAPI {
  // === 配置 ===
  loadConfig: () => Promise<SyncConfig>;
  saveConfig: (config: SyncConfig) => Promise<void>;
  getSystemVariables: () => Promise<Record<string, string>>;

  // === 包管理 ===
  listPackages: () => Promise<PackageStatus[]>;
  createPackage: (name: string, type: "file" | "directory") => Promise<void>;
  deletePackage: (name: string) => Promise<void>;
  importFromGit: (name: string, gitUrl: string, subPath: string, branch?: string) => Promise<void>;

  // === 包内容 ===
  readPackageFile: (pkgName: string, filePath?: string) => Promise<string>;
  writePackageFile: (pkgName: string, content: string, filePath?: string) => Promise<void>;
  deletePackageFile: (pkgName: string, filePath: string) => Promise<void>;
  createPackageDir: (pkgName: string, dirPath: string) => Promise<void>;
  listPackageFiles: (pkgName: string) => Promise<string[]>;
  listPackageEntries: (pkgName: string, subPath?: string) => Promise<DirEntry[]>;

  // === 目标管理 ===
  addTarget: (pkgName: string, targetPath: string, template?: boolean) => Promise<void>;
  removeTarget: (pkgName: string, targetPath: string) => Promise<void>;

  // === 同步 ===
  executeSync: (pkgName?: string) => Promise<void>;
  renderTemplate: (content: string) => Promise<string>;
  readTargetFile: (targetPath: string) => Promise<string>;

  // === Git 操作 ===
  checkUpdate: (pkgName: string) => Promise<{ hasUpdate: boolean; latestVersion?: string }>;
  pullUpdate: (pkgName: string) => Promise<void>;

  // === 窗口 ===
  openEditor: (pkgName: string, filePath?: string, readOnly?: boolean) => Promise<void>;

  // === 事件 ===
  onRefresh: (callback: () => void) => void;

  // === 应用信息 ===
  getAppVersion: () => Promise<string>;
}
