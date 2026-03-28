import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { registerIpcHandlers } from "./ipc";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

/**
 * 通知主窗口刷新数据
 */
export function notifyMainWindowRefresh(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app:refresh");
  }
}

/**
 * 创建编辑器子窗口
 */
export function createEditorWindow(pkgName: string, filePath?: string, readOnly?: boolean): void {
  const title = filePath
    ? `${readOnly ? "查看" : "编辑"} - ${pkgName}/${filePath}`
    : `${readOnly ? "查看" : "编辑"} - ${pkgName}`;
  let hashPath = filePath
    ? `/editor/${encodeURIComponent(pkgName)}/${encodeURIComponent(filePath)}`
    : `/editor/${encodeURIComponent(pkgName)}`;
  if (readOnly) hashPath += "?readonly";

  const win = new BrowserWindow({
    width: 900,
    height: 650,
    title,
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  // 编辑器关闭时通知主窗口刷新
  win.on("closed", () => {
    notifyMainWindowRefresh();
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#${hashPath}`);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: hashPath,
    });
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.syncer");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
