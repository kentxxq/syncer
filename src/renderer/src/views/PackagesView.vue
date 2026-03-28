<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import MonacoEditor from "../components/MonacoEditor.vue";
import type { PackageStatus, DirEntry } from "../../../shared/types";

// =========== 状态 ===========
const packages = ref<PackageStatus[]>([]);
const selectedPkg = ref("");
const searchQuery = ref("");
const activeTab = ref<"overview" | "files" | "targets">("overview");
const statusMessage = ref("");
const syncing = ref(false);

// 新增弹窗
const showCreateDialog = ref(false);
const createMode = ref<"file" | "directory" | "git">("file");
const newPkgName = ref("");
const gitUrl = ref("");
const gitSubPath = ref("");
const gitBranch = ref("main");

// 添加目标弹窗
const showAddTarget = ref(false);
const newTargetPath = ref("");

// 目录导航（目录包）
const currentPath = ref("");
const dirEntries = ref<DirEntry[]>([]);

// 内嵌编辑器状态（单文件包）
const fileContent = ref("");
const fileSaved = ref(false);
const fileLoading = ref(false);

// 目录包：新建文件/目录弹窗
const showNewFileDialog = ref(false);
const newFilePath = ref("");
const showNewDirDialog = ref(false);
const newDirPath = ref("");

// Git 操作状态
const pulling = ref(false);

// =========== 计算属性 ===========
const filteredPackages = computed(() => {
  if (!searchQuery.value) return packages.value;
  const q = searchQuery.value.toLowerCase();
  return packages.value.filter((p) => p.pkg.name.toLowerCase().includes(q));
});

const currentPkgStatus = computed(() => {
  return packages.value.find((p) => p.pkg.name === selectedPkg.value);
});

const currentPkg = computed(() => currentPkgStatus.value?.pkg);

// 是否为只读包（有 Git origin 的包不允许编辑）
const isReadOnly = computed(() => !!currentPkg.value?.origin);

// =========== 加载 ===========
async function loadPackages(): Promise<void> {
  try {
    packages.value = await window.api.listPackages();
    if (!selectedPkg.value && packages.value.length > 0) {
      selectedPkg.value = packages.value[0].pkg.name;
    }
    if (selectedPkg.value && !packages.value.some((p) => p.pkg.name === selectedPkg.value)) {
      selectedPkg.value = packages.value[0]?.pkg.name || "";
    }
  } catch (e) {
    console.error("加载包列表失败:", e);
  }
}

async function loadDirEntries(): Promise<void> {
  if (!selectedPkg.value) {
    dirEntries.value = [];
    return;
  }
  try {
    dirEntries.value = await window.api.listPackageEntries(
      selectedPkg.value,
      currentPath.value || undefined,
    );
  } catch (e) {
    console.error("加载目录内容失败:", e);
  }
}

// 面包屑路径段
const breadcrumbs = computed(() => {
  if (!currentPath.value) return [];
  return currentPath.value.split("/");
});

function enterDir(name: string): void {
  currentPath.value = currentPath.value ? `${currentPath.value}/${name}` : name;
  loadDirEntries();
}

function goToRoot(): void {
  currentPath.value = "";
  loadDirEntries();
}

function goToBreadcrumb(index: number): void {
  const parts = breadcrumbs.value.slice(0, index + 1);
  currentPath.value = parts.join("/");
  loadDirEntries();
}

/** 获取相对于包根目录的完整路径 */
function fullPath(name: string): string {
  return currentPath.value ? `${currentPath.value}/${name}` : name;
}

// =========== 包操作 ===========
async function createNewPackage(): Promise<void> {
  const name = newPkgName.value.trim();
  if (!name) return;

  try {
    if (createMode.value === "git") {
      const url = gitUrl.value.trim();
      const sub = gitSubPath.value.trim();
      if (!url || !sub) return;
      showStatus("正在从 Git 导入...");
      await window.api.importFromGit(name, url, sub, gitBranch.value || "main");
      showStatus(`已导入: ${name}`);
    } else {
      await window.api.createPackage(name, createMode.value);
      showStatus(`已创建: ${name}`);
    }
    showCreateDialog.value = false;
    resetCreateForm();
    await loadPackages();
    selectedPkg.value = name;
  } catch (e: any) {
    console.error("创建包（或导入）失败:", e);
    const msg = e.message ? e.message.split("Error:").pop()?.trim() || e.message : "未知错误";
    showStatus(`失败: ${msg}`);
  }
}

function resetCreateForm(): void {
  newPkgName.value = "";
  gitUrl.value = "";
  gitSubPath.value = "";
  gitBranch.value = "main";
  createMode.value = "file";
}

async function deletePkg(name: string): Promise<void> {
  if (!confirm(`确认删除包 "${name}" 及其所有内容？`)) return;
  try {
    await window.api.deletePackage(name);
    if (selectedPkg.value === name) {
      selectedPkg.value = "";
      fileContent.value = "";
    }
    await loadPackages();
    showStatus(`已删除: ${name}`);
  } catch (e) {
    console.error("删除包失败:", e);
  }
}

function openEditor(pkgName: string, filePath?: string, readOnly?: boolean): void {
  window.api.openEditor(pkgName, filePath, readOnly);
}

// =========== 内嵌编辑器（单文件包） ===========
async function loadFileContent(): Promise<void> {
  if (!selectedPkg.value || currentPkg.value?.type !== "file") return;
  fileLoading.value = true;
  try {
    fileContent.value = await window.api.readPackageFile(selectedPkg.value);
  } catch (e) {
    console.error("读取文件内容失败:", e);
  } finally {
    fileLoading.value = false;
  }
}

async function saveFileContent(): Promise<void> {
  if (!selectedPkg.value) return;
  try {
    await window.api.writePackageFile(selectedPkg.value, fileContent.value);
    fileSaved.value = true;
    setTimeout(() => {
      fileSaved.value = false;
    }, 2000);
  } catch (e) {
    console.error("保存文件失败:", e);
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    // 单文件包在 files tab 时保存
    if (activeTab.value === "files" && currentPkg.value?.type === "file") {
      saveFileContent();
    }
  }
}

// =========== 目录包文件操作 ===========
async function createNewFile(): Promise<void> {
  const fileName = newFilePath.value.trim();
  if (!fileName || !selectedPkg.value) return;
  const filePath = fullPath(fileName);
  try {
    await window.api.writePackageFile(selectedPkg.value, "", filePath);
    showNewFileDialog.value = false;
    newFilePath.value = "";
    await loadDirEntries();
    showStatus(`已创建文件: ${fileName}`);
  } catch (e) {
    console.error("创建文件失败:", e);
    showStatus("创建文件失败");
  }
}

async function createNewDir(): Promise<void> {
  const dirName = newDirPath.value.trim();
  if (!dirName || !selectedPkg.value) return;
  const dirPath = fullPath(dirName);
  try {
    await window.api.createPackageDir(selectedPkg.value, dirPath);
    showNewDirDialog.value = false;
    newDirPath.value = "";
    await loadDirEntries();
    showStatus(`已创建目录: ${dirName}`);
  } catch (e) {
    console.error("创建目录失败:", e);
    showStatus("创建目录失败");
  }
}

async function deleteFile(name: string): Promise<void> {
  const filePath = fullPath(name);
  if (!confirm(`确认删除文件 "${name}"？`)) return;
  try {
    await window.api.deletePackageFile(selectedPkg.value, filePath);
    await loadDirEntries();
    showStatus(`已删除: ${name}`);
  } catch (e) {
    console.error("删除文件失败:", e);
    showStatus("删除文件失败");
  }
}

// =========== 目标操作 ===========
async function addNewTarget(): Promise<void> {
  const path = newTargetPath.value.trim();
  if (!path || !selectedPkg.value) return;
  try {
    await window.api.addTarget(selectedPkg.value, path);
    showAddTarget.value = false;
    newTargetPath.value = "";
    await loadPackages();
    showStatus(`已添加目标: ${path}`);
  } catch (e) {
    console.error("添加目标失败:", e);
  }
}

async function removeTargetItem(targetPath: string): Promise<void> {
  if (!confirm(`确认取消同步到 "${targetPath}"？`)) return;
  try {
    await window.api.removeTarget(selectedPkg.value, targetPath);
    await loadPackages();
    showStatus("已移除目标");
  } catch (e) {
    console.error("移除目标失败:", e);
  }
}

// =========== 同步 ===========
async function syncCurrent(): Promise<void> {
  if (!selectedPkg.value) return;
  syncing.value = true;
  try {
    await window.api.executeSync(selectedPkg.value);
    await loadPackages();
    showStatus(`同步完成: ${selectedPkg.value}`);
  } catch (e) {
    console.error("同步失败:", e);
    showStatus("同步失败");
  } finally {
    syncing.value = false;
  }
}

async function syncAll(): Promise<void> {
  syncing.value = true;
  try {
    await window.api.executeSync();
    await loadPackages();
    showStatus("全部同步完成");
  } catch (e) {
    console.error("同步失败:", e);
    showStatus("同步失败");
  } finally {
    syncing.value = false;
  }
}

// =========== Git 操作 ===========
async function doUpdate(): Promise<void> {
  if (!selectedPkg.value) return;
  pulling.value = true;
  try {
    await window.api.pullUpdate(selectedPkg.value);
    await loadPackages();
    if (activeTab.value === "files") {
      await loadDirEntries();
    }
    showStatus("更新完成");
  } catch (e) {
    console.error("更新失败:", e);
    showStatus("更新失败");
  } finally {
    pulling.value = false;
  }
}

// =========== 工具 ===========
function showStatus(msg: string): void {
  statusMessage.value = msg;
  setTimeout(() => {
    statusMessage.value = "";
  }, 3000);
}

function pkgIcon(ps: PackageStatus): string {
  if (ps.pkg.origin) return "🔗";
  return ps.pkg.type === "file" ? "📄" : "📁";
}

function pkgStatusIcon(ps: PackageStatus): string {
  if (ps.targetStatuses.length === 0) return "—";
  if (ps.targetStatuses.every((t) => t.status === "synced")) return "✓";
  if (ps.targetStatuses.some((t) => t.status === "missing")) return "?";
  return "✗";
}

function pkgStatusClass(ps: PackageStatus): string {
  if (ps.targetStatuses.length === 0) return "";
  if (ps.targetStatuses.every((t) => t.status === "synced")) return "status-synced";
  if (ps.targetStatuses.some((t) => t.status === "missing")) return "status-missing";
  return "status-outdated";
}

function targetStatusIcon(status: string): string {
  switch (status) {
    case "synced":
      return "✓";
    case "outdated":
      return "✗";
    case "missing":
      return "?";
    default:
      return "—";
  }
}

function targetStatusLabel(status: string): string {
  switch (status) {
    case "synced":
      return "已同步";
    case "outdated":
      return "需更新";
    case "missing":
      return "未同步";
    default:
      return "未知";
  }
}

// =========== 生命周期 ===========
watch(selectedPkg, () => {
  activeTab.value = "overview";
  fileContent.value = "";
  currentPath.value = "";
  dirEntries.value = [];
});

// 切到 files tab 时自动加载
watch(activeTab, (tab) => {
  if (tab === "files") {
    if (currentPkg.value?.type === "file") {
      loadFileContent();
    } else {
      loadDirEntries();
    }
  }
});

onMounted(() => {
  loadPackages();
  window.addEventListener("keydown", handleKeydown);
  window.api.onRefresh(() => {
    loadPackages();
    if (activeTab.value === "files" && currentPkg.value?.type === "directory") {
      loadDirEntries();
    }
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="main-layout">
    <!-- 头部 -->
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">⚡ Syncer</h1>
        <span class="app-subtitle">同步包管理</span>
      </div>
      <div class="header-right">
        <span v-if="statusMessage" class="status-toast">{{ statusMessage }}</span>
        <button class="btn btn-primary" @click="syncCurrent" :disabled="!selectedPkg || syncing">
          🔄 同步当前
        </button>
        <button class="btn btn-success" @click="syncAll" :disabled="syncing">⚡ 全部同步</button>
      </div>
    </header>

    <div class="content">
      <!-- 左侧：包列表 -->
      <section class="panel source-panel">
        <div class="panel-header">
          <h2>同步包</h2>
          <button class="btn btn-sm btn-outline" @click="showCreateDialog = true">+ 新增</button>
        </div>

        <div class="package-filter">
          <input
            v-model="searchQuery"
            class="input search-input"
            placeholder="搜索 文件/目录/Git 包..."
          />
        </div>

        <div class="package-list">
          <div
            v-for="ps in filteredPackages"
            :key="ps.pkg.name"
            class="package-item"
            :class="{ active: selectedPkg === ps.pkg.name }"
            @click="selectedPkg = ps.pkg.name"
          >
            <span class="pkg-icon">{{ pkgIcon(ps) }}</span>
            <div class="pkg-info">
              <span class="pkg-name">{{ ps.pkg.name }}</span>
              <div class="pkg-meta">
                <span v-if="ps.pkg.origin" class="git-badge" title="Git 上游">⛓</span>
                <span v-if="ps.hasUpdate" class="update-badge" title="有新版本">↑</span>
              </div>
            </div>
            <span class="pkg-status-badge" :class="pkgStatusClass(ps)">
              {{ pkgStatusIcon(ps) }}
            </span>
            <div class="pkg-actions">
              <button class="icon-btn danger" title="删除" @click.stop="deletePkg(ps.pkg.name)">
                🗑️
              </button>
            </div>
          </div>

          <div v-if="packages.length === 0" class="empty-state">
            <p>暂无同步包</p>
            <p class="hint">点击「+ 新增」创建你的第一个同步包</p>
          </div>
          <div v-else-if="filteredPackages.length === 0" class="empty-state">
            <p>未找到匹配的包</p>
          </div>
        </div>

        <!-- 新增包弹窗 -->
        <div v-if="showCreateDialog" class="modal-overlay" @click.self="showCreateDialog = false">
          <div class="modal">
            <h3>新增同步包</h3>

            <!-- 模式切换 -->
            <div class="mode-tabs">
              <button
                class="mode-tab"
                :class="{ active: createMode === 'file' }"
                @click="createMode = 'file'"
              >
                📄 文件包
              </button>
              <button
                class="mode-tab"
                :class="{ active: createMode === 'directory' }"
                @click="createMode = 'directory'"
              >
                📁 目录包
              </button>
              <button
                class="mode-tab"
                :class="{ active: createMode === 'git' }"
                @click="createMode = 'git'"
              >
                ⛓ Git 导入
              </button>
            </div>

            <div class="form-group">
              <label>包名称</label>
              <input
                v-model="newPkgName"
                class="input"
                placeholder="如 zshrc, brainstorming"
                @keyup.enter="createMode !== 'git' && createNewPackage()"
                autofocus
              />
            </div>

            <template v-if="createMode === 'git'">
              <div class="form-group">
                <label>仓库 URL</label>
                <input
                  v-model="gitUrl"
                  class="input"
                  placeholder="https://github.com/user/repo.git"
                />
              </div>
              <div class="form-group">
                <label>子路径</label>
                <input v-model="gitSubPath" class="input" placeholder="skills/brainstorming" />
              </div>
              <div class="form-group">
                <label>分支</label>
                <input v-model="gitBranch" class="input" placeholder="main" />
              </div>
            </template>

            <div class="modal-actions">
              <button class="btn btn-sm btn-outline" @click="showCreateDialog = false">取消</button>
              <button class="btn btn-sm btn-primary" @click="createNewPackage">
                {{ createMode === "git" ? "导入" : "创建" }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：详情区 -->
      <section class="panel detail-panel">
        <template v-if="currentPkg">
          <!-- Tab 栏 -->
          <div class="tab-bar">
            <button
              class="tab-item"
              :class="{ active: activeTab === 'overview' }"
              @click="activeTab = 'overview'"
            >
              概览
            </button>
            <button
              class="tab-item"
              :class="{ active: activeTab === 'files' }"
              @click="activeTab = 'files'"
            >
              文件
            </button>
            <button
              class="tab-item"
              :class="{ active: activeTab === 'targets' }"
              @click="activeTab = 'targets'"
            >
              目标
            </button>
          </div>

          <!-- 概览 Tab -->
          <div v-if="activeTab === 'overview'" class="tab-content">
            <div class="info-section">
              <h3>包信息</h3>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">名称</span>
                  <span class="info-value">{{ currentPkg.name }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">类型</span>
                  <span class="info-value">{{
                    currentPkg.type === "file" ? "单文件" : "目录"
                  }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">来源</span>
                  <span class="info-value">{{ currentPkg.origin ? "Git 上游" : "本地" }}</span>
                </div>
              </div>
            </div>

            <!-- Git 上游信息 -->
            <div v-if="currentPkg.origin" class="info-section">
              <h3>上游信息</h3>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">仓库</span>
                  <span class="info-value mono">{{ currentPkg.origin.git }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">路径</span>
                  <span class="info-value mono">{{ currentPkg.origin.path }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">分支</span>
                  <span class="info-value">{{ currentPkg.origin.branch || "main" }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">当前版本</span>
                  <span class="info-value mono">{{
                    currentPkg.origin.version?.substring(0, 7)
                  }}</span>
                </div>
                <div v-if="currentPkgStatus?.hasUpdate" class="info-row">
                  <span class="info-label">最新版本</span>
                  <span class="info-value mono update-text">
                    {{ currentPkgStatus.latestVersion?.substring(0, 7) }}
                  </span>
                </div>
              </div>
              <div class="git-actions">
                <button class="btn btn-sm btn-primary" @click="doUpdate" :disabled="pulling">
                  {{ pulling ? "更新中..." : "🔄 更新" }}
                </button>
              </div>
            </div>

            <!-- 同步摘要 -->
            <div class="info-section">
              <h3>同步状态</h3>
              <div
                v-if="currentPkgStatus && currentPkgStatus.targetStatuses.length > 0"
                class="info-card"
              >
                <div v-for="ts in currentPkgStatus.targetStatuses" :key="ts.path" class="info-row">
                  <span class="info-label">
                    <span class="status-dot" :class="'status-' + ts.status"></span>
                    {{ ts.resolvedPath }}
                  </span>
                  <span class="info-value" :class="'status-text-' + ts.status">
                    {{ targetStatusLabel(ts.status) }}
                  </span>
                </div>
              </div>
              <div v-else class="empty-hint">暂无同步目标，请在「目标」tab 中添加</div>
            </div>
          </div>

          <!-- 文件 Tab -->
          <div v-if="activeTab === 'files'" class="tab-content tab-content-files">
            <!-- 单文件包：内嵌 Monaco 编辑器 -->
            <div v-if="currentPkg.type === 'file'" class="inline-editor-section">
              <div class="inline-editor-toolbar">
                <span class="editor-label">📄 {{ currentPkg.name }}</span>
                <div class="editor-toolbar-right">
                  <span v-if="fileSaved" class="save-toast">✓ 已保存</span>
                  <button class="btn btn-sm btn-primary" @click="saveFileContent">💾 保存</button>
                </div>
              </div>
              <div class="inline-editor-body">
                <MonacoEditor v-model="fileContent" language="plaintext" :read-only="false" />
              </div>
            </div>

            <!-- 目录包：目录导航 -->
            <div v-else class="dir-files-section">
              <!-- 头部：标题 + 操作按钮 -->
              <div class="dir-files-header">
                <h3>文件管理</h3>
                <div v-if="!isReadOnly" class="dir-files-actions">
                  <button class="btn btn-sm btn-outline" @click="showNewFileDialog = true">
                    + 新建文件
                  </button>
                  <button class="btn btn-sm btn-outline" @click="showNewDirDialog = true">
                    📁 新建目录
                  </button>
                </div>
                <span v-else class="readonly-badge">🔒 只读（Git 来源）</span>
              </div>

              <!-- 面包屑导航 -->
              <div class="breadcrumb">
                <span
                  class="breadcrumb-item"
                  :class="{ clickable: currentPath !== '' }"
                  @click="goToRoot"
                >
                  📁 根
                </span>
                <template v-for="(seg, i) in breadcrumbs" :key="i">
                  <span class="breadcrumb-sep">/</span>
                  <span
                    class="breadcrumb-item"
                    :class="{ clickable: i < breadcrumbs.length - 1 }"
                    @click="i < breadcrumbs.length - 1 && goToBreadcrumb(i)"
                  >
                    {{ seg }}
                  </span>
                </template>
              </div>

              <!-- 条目列表 -->
              <div class="file-tree">
                <div
                  v-for="entry in dirEntries"
                  :key="entry.name"
                  class="file-tree-item"
                  @click="entry.type === 'directory' ? enterDir(entry.name) : undefined"
                >
                  <!-- 目录条目 -->
                  <template v-if="entry.type === 'directory'">
                    <span class="file-tree-icon">📁</span>
                    <span class="file-tree-name dir-name">{{ entry.name }}</span>
                    <span class="dir-arrow">→</span>
                  </template>

                  <!-- 文件条目 -->
                  <template v-else>
                    <span class="file-tree-icon">📄</span>
                    <span class="file-tree-name">{{ entry.name }}</span>
                    <div class="file-tree-actions">
                      <button
                        class="icon-btn"
                        :title="isReadOnly ? '查看' : '编辑'"
                        @click.stop="openEditor(currentPkg.name, fullPath(entry.name), isReadOnly)"
                      >
                        {{ isReadOnly ? "👁" : "✏️" }}
                      </button>
                      <button
                        v-if="!isReadOnly"
                        class="icon-btn danger"
                        title="删除"
                        @click.stop="deleteFile(entry.name)"
                      >
                        🗑️
                      </button>
                    </div>
                  </template>
                </div>

                <div v-if="dirEntries.length === 0" class="empty-hint">
                  {{
                    isReadOnly
                      ? "目录为空"
                      : "目录为空，点击「+ 新建文件」或「📁 新建目录」添加内容"
                  }}
                </div>
              </div>

              <!-- 新建文件弹窗 -->
              <div
                v-if="showNewFileDialog"
                class="modal-overlay"
                @click.self="showNewFileDialog = false"
              >
                <div class="modal">
                  <h3>新建文件</h3>
                  <div class="form-group">
                    <label>文件名</label>
                    <input
                      v-model="newFilePath"
                      class="input"
                      placeholder="如 SKILL.md 或 run.sh"
                      @keyup.enter="createNewFile"
                      autofocus
                    />
                  </div>
                  <p v-if="currentPath" class="form-hint">将创建在: {{ currentPath }}/</p>
                  <div class="modal-actions">
                    <button class="btn btn-sm btn-outline" @click="showNewFileDialog = false">
                      取消
                    </button>
                    <button class="btn btn-sm btn-primary" @click="createNewFile">创建</button>
                  </div>
                </div>
              </div>

              <!-- 新建目录弹窗 -->
              <div
                v-if="showNewDirDialog"
                class="modal-overlay"
                @click.self="showNewDirDialog = false"
              >
                <div class="modal">
                  <h3>新建目录</h3>
                  <div class="form-group">
                    <label>目录名</label>
                    <input
                      v-model="newDirPath"
                      class="input"
                      placeholder="如 scripts 或 resources"
                      @keyup.enter="createNewDir"
                      autofocus
                    />
                  </div>
                  <p v-if="currentPath" class="form-hint">将创建在: {{ currentPath }}/</p>
                  <div class="modal-actions">
                    <button class="btn btn-sm btn-outline" @click="showNewDirDialog = false">
                      取消
                    </button>
                    <button class="btn btn-sm btn-primary" @click="createNewDir">创建</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 目标 Tab -->
          <div v-if="activeTab === 'targets'" class="tab-content">
            <div class="targets-header">
              <h3>同步目标</h3>
              <button class="btn btn-sm btn-outline" @click="showAddTarget = true">
                + 新增目标
              </button>
            </div>

            <div class="target-list">
              <div
                v-for="ts in currentPkgStatus?.targetStatuses || []"
                :key="ts.path"
                class="target-item"
              >
                <div class="target-info">
                  <div class="target-path">
                    <span class="status-badge" :class="'status-' + ts.status">
                      {{ targetStatusIcon(ts.status) }}
                    </span>
                    <span class="target-pattern">{{ ts.path }}</span>
                  </div>
                  <div class="target-meta">
                    <span class="resolved-path">→ {{ ts.resolvedPath }}</span>
                    <span
                      v-if="currentPkg.type === 'file'"
                      class="template-badge"
                      :class="{ enabled: ts.template }"
                    >
                      {{ ts.template ? "模板" : "直接复制" }}
                    </span>
                    <span class="status-label" :class="'status-' + ts.status">
                      {{ targetStatusLabel(ts.status) }}
                    </span>
                  </div>
                </div>
                <div class="target-actions">
                  <button
                    class="icon-btn danger"
                    title="取消同步"
                    @click="removeTargetItem(ts.path)"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div
                v-if="!currentPkgStatus || currentPkgStatus.targetStatuses.length === 0"
                class="empty-state"
              >
                <p>暂无同步目标</p>
                <p class="hint">点击「+ 新增目标」添加同步目标路径</p>
              </div>
            </div>

            <!-- 新增目标弹窗 -->
            <div v-if="showAddTarget" class="modal-overlay" @click.self="showAddTarget = false">
              <div class="modal">
                <h3>新增同步目标</h3>
                <input
                  v-model="newTargetPath"
                  class="input"
                  placeholder="目标路径（如 {{home}}/.zshrc）"
                  @keyup.enter="addNewTarget"
                  autofocus
                />
                <div class="modal-actions">
                  <button class="btn btn-sm btn-outline" @click="showAddTarget = false">
                    取消
                  </button>
                  <button class="btn btn-sm btn-primary" @click="addNewTarget">添加</button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 未选中状态 -->
        <div v-else class="empty-state detail-empty">
          <p>请选择一个同步包</p>
          <p class="hint">或点击「+ 新增」创建新的同步包</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #11111b;
}

/* 头部 */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: linear-gradient(135deg, #1e1e2e 0%, #181825 100%);
  border-bottom: 1px solid #313244;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: #cdd6f4;
  margin: 0;
}

.app-subtitle {
  font-size: 12px;
  color: #6c7086;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-toast {
  font-size: 12px;
  color: #a6e3a1;
  padding: 4px 12px;
  background: rgba(166, 227, 161, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(166, 227, 161, 0.2);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 内容区 */
.content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 面板 */
.panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #313244;
}

.panel-header h2 {
  font-size: 13px;
  font-weight: 600;
  color: #a6adc8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

/* 左侧包列表 */
.source-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
  border-right: 1px solid #313244;
}

.package-filter {
  padding: 8px 12px;
  border-bottom: 1px solid #313244;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  background: #181825;
  border: 1px solid #313244;
  border-radius: 4px;
  color: #cdd6f4;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #89b4fa;
}

.package-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.package-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;
  color: #bac2de;
}

.package-item:hover {
  background: #313244;
}

.package-item.active {
  background: #45475a;
  color: #cdd6f4;
}

.pkg-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.pkg-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pkg-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pkg-meta {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.git-badge {
  font-size: 10px;
  color: #89b4fa;
}

.update-badge {
  font-size: 10px;
  color: #89b4fa;
  font-weight: bold;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.pkg-status-badge {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-synced {
  color: #a6e3a1;
  background: rgba(166, 227, 161, 0.15);
}

.status-outdated {
  color: #f38ba8;
  background: rgba(243, 139, 168, 0.15);
}

.status-missing {
  color: #fab387;
  background: rgba(250, 179, 135, 0.15);
}

.pkg-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s;
}

.package-item:hover .pkg-actions {
  opacity: 1;
}

/* 右侧详情 */
.detail-panel {
  flex: 1;
  background: #181825;
  position: relative;
}

/* Tab 栏 */
.tab-bar {
  display: flex;
  border-bottom: 1px solid #313244;
  background: #1e1e2e;
}

.tab-item {
  padding: 10px 20px;
  font-size: 13px;
  color: #6c7086;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.12s;
  position: relative;
}

.tab-item:hover {
  color: #bac2de;
}

.tab-item.active {
  color: #89b4fa;
}

.tab-item.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #89b4fa;
  border-radius: 2px 2px 0 0;
}

/* Tab 内容 */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

/* 信息区域 */
.info-section {
  margin-bottom: 20px;
}

.info-section h3 {
  font-size: 12px;
  font-weight: 600;
  color: #a6adc8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px;
}

.info-card {
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  overflow: hidden;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #313244;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 12px;
  color: #6c7086;
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-value {
  font-size: 12px;
  color: #cdd6f4;
}

.info-value.mono {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 11px;
}

.update-text {
  color: #89b4fa;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.status-synced {
  background: #a6e3a1;
}
.status-dot.status-outdated {
  background: #f38ba8;
}
.status-dot.status-missing {
  background: #fab387;
}

.status-text-synced {
  color: #a6e3a1;
}
.status-text-outdated {
  color: #f38ba8;
}
.status-text-missing {
  color: #fab387;
}

/* Git 操作按钮 */
.git-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

/* 文件区域 */
.tab-content-files {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 内嵌编辑器（单文件包） */
.inline-editor-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.inline-editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #1e1e2e;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
}

.editor-label {
  font-size: 13px;
  color: #cdd6f4;
  font-weight: 500;
}

.editor-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-editor-body {
  flex: 1;
  overflow: hidden;
}

/* 目录包文件管理 */
.dir-files-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 20px;
}

.dir-files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.dir-files-actions {
  display: flex;
  gap: 6px;
}

.readonly-badge {
  font-size: 11px;
  color: #6c7086;
  padding: 3px 8px;
  background: #313244;
  border-radius: 4px;
}

.dir-files-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: #a6adc8;
  margin: 0;
}

/* 面包屑导航 */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6c7086;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
}

.breadcrumb-item {
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.12s;
}

.breadcrumb-item.clickable {
  cursor: pointer;
  color: #89b4fa;
}

.breadcrumb-item.clickable:hover {
  background: rgba(137, 180, 250, 0.1);
}

.breadcrumb-sep {
  color: #45475a;
}

/* 目录条目 */
.dir-name {
  font-weight: 500;
  color: #89b4fa;
}

.dir-arrow {
  color: #45475a;
  font-size: 11px;
  margin-left: auto;
}

.file-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
}

.file-tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;
  color: #bac2de;
}

.file-tree-item:hover {
  background: #313244;
}

.file-tree-item.active {
  background: #45475a;
}

.file-tree-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.file-tree-name {
  flex: 1;
  font-size: 12px;
  font-family: "JetBrains Mono", "Fira Code", monospace;
}

.file-tree-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s;
}

.file-tree-item:hover .file-tree-actions {
  opacity: 1;
}

.form-hint {
  font-size: 11px;
  color: #585b70;
  margin: 4px 0 0;
}

/* 目标区域 */
.targets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.targets-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: #a6adc8;
  margin: 0;
}

.target-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.target-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  transition: border-color 0.12s;
}

.target-item:hover {
  border-color: #45475a;
}

.target-info {
  flex: 1;
  min-width: 0;
}

.target-path {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.target-pattern {
  font-size: 13px;
  color: #cdd6f4;
  font-family: "JetBrains Mono", "Fira Code", monospace;
}

.target-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.resolved-path {
  font-size: 11px;
  color: #6c7086;
  font-family: "JetBrains Mono", "Fira Code", monospace;
}

.template-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #45475a;
  color: #6c7086;
}

.template-badge.enabled {
  background: rgba(137, 180, 250, 0.15);
  color: #89b4fa;
}

.status-badge {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-label {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
}

.status-label.status-synced {
  background: rgba(166, 227, 161, 0.1);
}
.status-label.status-outdated {
  background: rgba(243, 139, 168, 0.1);
}
.status-label.status-missing {
  background: rgba(250, 179, 135, 0.1);
}

.target-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 12px;
}

/* 按钮 */
.btn {
  padding: 6px 14px;
  font-size: 12px;
  border: 1px solid #45475a;
  border-radius: 6px;
  background: #181825;
  color: #bac2de;
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  background: #313244;
  color: #cdd6f4;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 11px;
}

.btn-primary {
  border-color: #89b4fa;
  color: #89b4fa;
}

.btn-primary:hover:not(:disabled) {
  background: rgba(137, 180, 250, 0.15);
}

.btn-success {
  border-color: #a6e3a1;
  color: #a6e3a1;
}

.btn-success:hover:not(:disabled) {
  background: rgba(166, 227, 161, 0.15);
}

.btn-outline {
  border-color: #585b70;
  color: #a6adc8;
}

.btn-outline:hover:not(:disabled) {
  border-color: #89b4fa;
  color: #89b4fa;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.12s;
}

.icon-btn:hover {
  background: #45475a;
}

.icon-btn.danger:hover {
  background: rgba(243, 139, 168, 0.2);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6c7086;
  text-align: center;
}

.detail-empty {
  height: 100%;
}

.empty-state p {
  margin: 2px 0;
  font-size: 13px;
}

.empty-state .hint,
.empty-hint {
  font-size: 11px;
  color: #585b70;
  margin-top: 8px;
}

.empty-hint {
  padding: 20px;
  text-align: center;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}

.modal {
  background: #1e1e2e;
  border: 1px solid #45475a;
  border-radius: 12px;
  padding: 20px;
  width: 440px;
  max-width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal h3 {
  margin: 0 0 16px;
  font-size: 15px;
  color: #cdd6f4;
}

/* 模式切换 */
.mode-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: #11111b;
  border-radius: 6px;
  padding: 3px;
}

.mode-tab {
  flex: 1;
  padding: 6px 8px;
  font-size: 11px;
  border: none;
  background: transparent;
  color: #6c7086;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s;
}

.mode-tab:hover {
  color: #bac2de;
}

.mode-tab.active {
  background: #313244;
  color: #cdd6f4;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 11px;
  color: #a6adc8;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  background: #181825;
  border: 1px solid #45475a;
  border-radius: 6px;
  color: #cdd6f4;
  outline: none;
  transition: border-color 0.12s;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  box-sizing: border-box;
}

.input:focus {
  border-color: #89b4fa;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
