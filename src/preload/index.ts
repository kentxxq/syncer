import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { SyncConfig, SyncerAPI } from '../shared/types'

/** 暴露给渲染进程的 Syncer API */
const syncerApi: SyncerAPI = {
  // 配置
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config: SyncConfig) => ipcRenderer.invoke('config:save', config),
  getSystemVariables: () => ipcRenderer.invoke('system:variables'),

  // 包管理
  listPackages: () => ipcRenderer.invoke('package:list'),
  createPackage: (name, type) => ipcRenderer.invoke('package:create', name, type),
  deletePackage: (name) => ipcRenderer.invoke('package:delete', name),
  importFromGit: (name, gitUrl, subPath, branch?) =>
    ipcRenderer.invoke('package:import-git', name, gitUrl, subPath, branch),

  // 包内容
  readPackageFile: (pkgName, filePath?) =>
    ipcRenderer.invoke('package:read-file', pkgName, filePath),
  writePackageFile: (pkgName, content, filePath?) =>
    ipcRenderer.invoke('package:write-file', pkgName, content, filePath),
  deletePackageFile: (pkgName, filePath) =>
    ipcRenderer.invoke('package:delete-file', pkgName, filePath),
  createPackageDir: (pkgName, dirPath) =>
    ipcRenderer.invoke('package:create-dir', pkgName, dirPath),
  listPackageFiles: (pkgName) => ipcRenderer.invoke('package:list-files', pkgName),
  listPackageEntries: (pkgName, subPath?) =>
    ipcRenderer.invoke('package:list-entries', pkgName, subPath),

  // 目标管理
  addTarget: (pkgName, targetPath, template?) =>
    ipcRenderer.invoke('target:add', pkgName, targetPath, template),
  removeTarget: (pkgName, targetPath) =>
    ipcRenderer.invoke('target:remove', pkgName, targetPath),

  // 同步
  executeSync: (pkgName?) => ipcRenderer.invoke('sync:execute', pkgName),
  renderTemplate: (content) => ipcRenderer.invoke('template:render', content),
  readTargetFile: (targetPath) => ipcRenderer.invoke('file:read-target', targetPath),

  // Git
  checkUpdate: (pkgName) => ipcRenderer.invoke('git:check-update', pkgName),
  pullUpdate: (pkgName) => ipcRenderer.invoke('git:pull-update', pkgName),

  // 窗口
  openEditor: (pkgName, filePath?, readOnly?) =>
    ipcRenderer.invoke('window:editor', pkgName, filePath, readOnly),

  // 事件
  onRefresh: (callback) => {
    ipcRenderer.on('app:refresh', () => callback())
  },

  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('app:version')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', syncerApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = syncerApi
}
