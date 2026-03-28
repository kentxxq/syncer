<script setup lang="ts">
import { ref, computed } from "vue";
import type { SkillInfo } from "../../../shared/types";

const emit = defineEmits<{
  close: [];
  imported: [];
}>();

// 向导步骤
const step = ref<1 | 2 | 3>(1);

// 步骤 1 状态
const repoUrl = ref("");
const repoBranch = ref("main");
const scanning = ref(false);
const scanError = ref("");

// 步骤 2 状态
const skills = ref<SkillInfo[]>([]);
const selectedSkills = ref<Set<string>>(new Set());

// 步骤 3 状态
const importing = ref(false);
const importProgress = ref("");
const importDone = ref(false);
const importError = ref("");

// 是否全选
const allSelected = computed(
  () => skills.value.length > 0 && selectedSkills.value.size === skills.value.length,
);

// ========== 步骤 1 ==========
async function doScan(): Promise<void> {
  const url = repoUrl.value.trim();
  if (!url) return;

  scanning.value = true;
  scanError.value = "";

  try {
    const result = await window.api.scanSkills(url, repoBranch.value || "main");
    if (result.length === 0) {
      scanError.value = "该仓库中未发现任何 SKILL.md 文件";
      return;
    }
    skills.value = result;
    // 默认全选
    selectedSkills.value = new Set(result.map((s) => s.path));
    step.value = 2;
  } catch (e: any) {
    scanError.value = e.message || "扫描失败";
  } finally {
    scanning.value = false;
  }
}

// ========== 步骤 2 ==========
function toggleSkill(skillPath: string): void {
  if (selectedSkills.value.has(skillPath)) {
    selectedSkills.value.delete(skillPath);
  } else {
    selectedSkills.value.add(skillPath);
  }
  // 触发响应式更新
  selectedSkills.value = new Set(selectedSkills.value);
}

function toggleAll(): void {
  if (allSelected.value) {
    selectedSkills.value = new Set();
  } else {
    selectedSkills.value = new Set(skills.value.map((s) => s.path));
  }
}

async function doImport(): Promise<void> {
  const selected = skills.value.filter((s) => selectedSkills.value.has(s.path));
  if (selected.length === 0) return;

  step.value = 3;
  importing.value = true;
  importError.value = "";
  importProgress.value = `正在导入 ${selected.length} 个 skills...`;

  try {
    await window.api.batchImportSkills(
      repoUrl.value.trim(),
      repoBranch.value || "main",
      selected.map((s) => ({ name: s.name, path: s.path })),
    );
    importDone.value = true;
    importProgress.value = `成功导入 ${selected.length} 个 skills`;
    emit("imported");
  } catch (e: any) {
    importError.value = e.message || "导入失败";
    importProgress.value = "";
  } finally {
    importing.value = false;
  }
}

function goBack(): void {
  if (step.value === 2) {
    step.value = 1;
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="skills-modal">
      <!-- 头部 -->
      <div class="skills-modal-header">
        <h3>🧩 导入 Skills</h3>
        <div class="step-indicator">
          <span class="step-dot" :class="{ active: step >= 1, done: step > 1 }">1</span>
          <span class="step-line" :class="{ active: step > 1 }"></span>
          <span class="step-dot" :class="{ active: step >= 2, done: step > 2 }">2</span>
          <span class="step-line" :class="{ active: step > 2 }"></span>
          <span class="step-dot" :class="{ active: step >= 3 }">3</span>
        </div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <!-- 步骤 1：输入仓库 URL -->
      <div v-if="step === 1" class="skills-modal-body">
        <p class="step-title">输入 Skills 仓库地址</p>
        <p class="step-desc">
          支持 GitHub/GitLab URL 或任意 Git 仓库地址，将自动扫描仓库中的 SKILL.md 文件。
        </p>

        <div class="form-group">
          <label>仓库 URL</label>
          <input
            v-model="repoUrl"
            class="input"
            placeholder="如 https://github.com/vercel-labs/agent-skills"
            @keyup.enter="doScan"
            autofocus
          />
        </div>
        <div class="form-group">
          <label>分支</label>
          <input v-model="repoBranch" class="input" placeholder="main" />
        </div>

        <p v-if="scanError" class="error-text">{{ scanError }}</p>

        <div class="modal-actions">
          <button class="btn btn-sm btn-outline" @click="emit('close')">取消</button>
          <button
            class="btn btn-sm btn-primary"
            :disabled="!repoUrl.trim() || scanning"
            @click="doScan"
          >
            {{ scanning ? "扫描中..." : "🔍 扫描 Skills" }}
          </button>
        </div>
      </div>

      <!-- 步骤 2：选择 Skills -->
      <div v-if="step === 2" class="skills-modal-body">
        <p class="step-title">选择要导入的 Skills</p>
        <p class="step-desc">
          共发现 {{ skills.length }} 个 skill，已选中 {{ selectedSkills.size }} 个。
        </p>

        <!-- 全选 -->
        <div class="select-all-row" @click="toggleAll">
          <span class="checkbox" :class="{ checked: allSelected }">
            {{ allSelected ? "☑" : "☐" }}
          </span>
          <span class="select-all-label">全选 / 全不选</span>
        </div>

        <!-- Skills 列表 -->
        <div class="skills-list">
          <div
            v-for="skill in skills"
            :key="skill.path"
            class="skill-item"
            @click="toggleSkill(skill.path)"
          >
            <span class="checkbox" :class="{ checked: selectedSkills.has(skill.path) }">
              {{ selectedSkills.has(skill.path) ? "☑" : "☐" }}
            </span>
            <div class="skill-info">
              <span class="skill-name">{{ skill.name }}</span>
              <span class="skill-desc">{{ skill.description }}</span>
              <span class="skill-path">{{ skill.path || "/" }}</span>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-sm btn-outline" @click="goBack">← 返回</button>
          <button
            class="btn btn-sm btn-primary"
            :disabled="selectedSkills.size === 0"
            @click="doImport"
          >
            导入 {{ selectedSkills.size }} 个 Skills
          </button>
        </div>
      </div>

      <!-- 步骤 3：导入进度 -->
      <div v-if="step === 3" class="skills-modal-body step3-body">
        <div v-if="importing" class="import-progress">
          <div class="spinner"></div>
          <p>{{ importProgress }}</p>
        </div>
        <div v-else-if="importDone" class="import-done">
          <span class="done-icon">✅</span>
          <p>{{ importProgress }}</p>
          <p class="step-desc">你可以在包列表中查看并为每个 skill 配置同步目标。</p>
        </div>
        <div v-else-if="importError" class="import-error">
          <span class="error-icon">❌</span>
          <p>{{ importError }}</p>
        </div>

        <div class="modal-actions">
          <button class="btn btn-sm btn-primary" @click="emit('close')">
            {{ importDone ? "完成" : "关闭" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skills-modal {
  background: #1e1e2e;
  border-radius: 12px;
  border: 1px solid #313244;
  width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.skills-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #313244;
}

.skills-modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #cdd6f4;
}

.step-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  background: #313244;
  color: #6c7086;
  transition: all 0.2s ease;
}

.step-dot.active {
  background: #89b4fa;
  color: #1e1e2e;
}

.step-dot.done {
  background: #a6e3a1;
  color: #1e1e2e;
}

.step-line {
  width: 24px;
  height: 2px;
  background: #313244;
  transition: background 0.2s ease;
}

.step-line.active {
  background: #a6e3a1;
}

.close-btn {
  background: none;
  border: none;
  color: #6c7086;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.close-btn:hover {
  background: #313244;
  color: #cdd6f4;
}

.skills-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  color: #cdd6f4;
  margin: 0 0 4px 0;
}

.step-desc {
  font-size: 12px;
  color: #6c7086;
  margin: 0 0 16px 0;
}

.error-text {
  color: #f38ba8;
  font-size: 12px;
  margin: 8px 0;
}

/* 全选行 */
.select-all-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #313244;
  cursor: pointer;
  user-select: none;
}

.select-all-row:hover {
  background: #181825;
}

.select-all-label {
  font-size: 12px;
  color: #a6adc8;
  font-weight: 500;
}

/* Skills 列表 */
.skills-list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid #313244;
  border-radius: 8px;
  margin-bottom: 16px;
}

.skill-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #232334;
  cursor: pointer;
  transition: background 0.12s ease;
  user-select: none;
}

.skill-item:last-child {
  border-bottom: none;
}

.skill-item:hover {
  background: #181825;
}

.checkbox {
  font-size: 16px;
  color: #6c7086;
  flex-shrink: 0;
  margin-top: 1px;
}

.checkbox.checked {
  color: #89b4fa;
}

.skill-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.skill-name {
  font-size: 13px;
  font-weight: 600;
  color: #cdd6f4;
}

.skill-desc {
  font-size: 11px;
  color: #a6adc8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-path {
  font-size: 10px;
  color: #585b70;
  font-family: monospace;
}

/* 步骤 3 */
.step3-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  text-align: center;
}

.import-progress,
.import-done,
.import-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #313244;
  border-top-color: #89b4fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.done-icon,
.error-icon {
  font-size: 32px;
}

/* 复用全局样式 */
.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #a6adc8;
  margin-bottom: 4px;
}

.input {
  width: 100%;
  padding: 8px 12px;
  background: #181825;
  border: 1px solid #313244;
  border-radius: 6px;
  color: #cdd6f4;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.input:focus {
  border-color: #89b4fa;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
}

.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.12s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
}

.btn-primary {
  background: #89b4fa;
  color: #1e1e2e;
}

.btn-primary:hover:not(:disabled) {
  background: #74c7ec;
}

.btn-outline {
  background: transparent;
  border: 1px solid #313244;
  color: #cdd6f4;
}

.btn-outline:hover {
  background: #313244;
}
</style>
