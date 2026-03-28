import { ipcMain, app } from "electron";
import {
  loadConfig,
  saveConfig,
  createPackage,
  deletePackage,
  listPackageFiles,
  listPackageEntries,
} from "./services/config";
import { getSystemVariables } from "./services/system";
import { renderTemplate } from "./services/template";
import {
  readPackageFile,
  writePackageFile,
  deletePackageFile,
  createPackageDir,
  readTargetFile,
  listPackageStatuses,
  addTarget,
  removeTarget,
  executeSync,
} from "./services/sync";
import { importFromGit, checkUpdate, pullUpdate, cleanUnusedGitCache } from "./services/git";
import { createEditorWindow, notifyMainWindowRefresh } from "./index";
import type { SyncConfig } from "../shared/types";

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(): void {
  // === 配置 ===
  ipcMain.handle("config:load", () => loadConfig());
  ipcMain.handle("config:save", (_e, config: SyncConfig) => saveConfig(config));
  ipcMain.handle("system:variables", () => getSystemVariables());

  // === 包管理 ===
  ipcMain.handle("package:list", () => listPackageStatuses());
  ipcMain.handle("package:create", (_e, name: string, type: "file" | "directory") =>
    createPackage(name, type),
  );
  ipcMain.handle("package:delete", (_e, name: string) => {
    deletePackage(name);
    cleanUnusedGitCache();
  });
  ipcMain.handle(
    "package:import-git",
    async (_e, name: string, gitUrl: string, subPath: string, branch?: string) => {
      await importFromGit(name, gitUrl, subPath, branch);
      cleanUnusedGitCache();
    },
  );

  // === 包内容 ===
  ipcMain.handle("package:read-file", (_e, pkgName: string, filePath?: string) =>
    readPackageFile(pkgName, filePath),
  );
  ipcMain.handle(
    "package:write-file",
    (_e, pkgName: string, content: string, filePath?: string) => {
      writePackageFile(pkgName, content, filePath);
      notifyMainWindowRefresh();
    },
  );
  ipcMain.handle("package:delete-file", (_e, pkgName: string, filePath: string) => {
    deletePackageFile(pkgName, filePath);
    notifyMainWindowRefresh();
  });
  ipcMain.handle("package:create-dir", (_e, pkgName: string, dirPath: string) => {
    createPackageDir(pkgName, dirPath);
    notifyMainWindowRefresh();
  });
  ipcMain.handle("package:list-files", (_e, pkgName: string) => listPackageFiles(pkgName));
  ipcMain.handle("package:list-entries", (_e, pkgName: string, subPath?: string) =>
    listPackageEntries(pkgName, subPath),
  );

  // === 目标管理 ===
  ipcMain.handle("target:add", (_e, pkgName: string, targetPath: string, template?: boolean) =>
    addTarget(pkgName, targetPath, template),
  );
  ipcMain.handle("target:remove", (_e, pkgName: string, targetPath: string) =>
    removeTarget(pkgName, targetPath),
  );

  // === 同步与模板 ===
  ipcMain.handle("template:render", (_e, content: string) => {
    const config = loadConfig();
    return renderTemplate(content, config);
  });
  ipcMain.handle("file:read-target", (_e, targetPath: string) => readTargetFile(targetPath));
  ipcMain.handle("sync:execute", (_e, pkgName?: string) => executeSync(pkgName));

  // === Git ===
  ipcMain.handle("git:check-update", (_e, pkgName: string) => checkUpdate(pkgName));
  ipcMain.handle("git:pull-update", (_e, pkgName: string) => pullUpdate(pkgName));

  // === 窗口 ===
  ipcMain.handle("window:editor", (_e, pkgName: string, filePath?: string, readOnly?: boolean) =>
    createEditorWindow(pkgName, filePath, readOnly),
  );

  // === 应用信息 ===
  ipcMain.handle("app:version", () => app.getVersion());
}
