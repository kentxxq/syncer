<script setup lang="ts">
import { ref, onMounted } from 'vue'

const systemVars = ref<Record<string, string>>({})
const userVars = ref<Record<string, string>>({})
const appVersion = ref('')

onMounted(async () => {
  try {
    systemVars.value = await window.api.getSystemVariables()
    const config = await window.api.loadConfig()
    userVars.value = config.variables
    appVersion.value = await window.api.getAppVersion()
  } catch (e) {
    console.error('加载信息失败:', e)
  }
})

function varLabel(key: string): string {
  return `\{\{${key}\}\}`
}
</script>

<template>
  <div class="info-view">
    <h1 class="page-title">ℹ️ 应用信息</h1>

    <!-- 版本信息 -->
    <section class="info-section">
      <h2>关于</h2>
      <div class="info-card">
        <div class="info-row">
          <span class="info-key">应用名称</span>
          <span class="info-value">Syncer</span>
        </div>
        <div class="info-row">
          <span class="info-key">版本号</span>
          <span class="info-value version-badge">v{{ appVersion }}</span>
        </div>
        <div class="info-row">
          <span class="info-key">引擎</span>
          <span class="info-value">Electron + Vue 3</span>
        </div>
      </div>
    </section>

    <!-- 系统变量 -->
    <section class="info-section">
      <h2>
        系统变量
        <span class="badge">只读 · 模板中可用</span>
      </h2>
      <div class="info-card">
        <div v-for="(value, key) in systemVars" :key="key" class="info-row mono">
          <span class="info-key" v-text="varLabel(String(key))"></span>
          <span class="info-value">{{ value }}</span>
        </div>
      </div>
    </section>

    <!-- 用户变量 -->
    <section class="info-section">
      <h2>
        用户变量
        <span class="badge">定义在 syncer.yaml</span>
      </h2>
      <div class="info-card">
        <div v-for="(value, key) in userVars" :key="key" class="info-row mono">
          <span class="info-key" v-text="varLabel(String(key))"></span>
          <span class="info-value">{{ value }}</span>
        </div>
        <div v-if="Object.keys(userVars).length === 0" class="empty-hint">
          在 syncer.yaml 的 variables 中定义自定义变量
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.info-view {
  padding: 24px 32px;
  overflow-y: auto;
  height: 100%;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #cdd6f4;
  margin: 0 0 24px;
}

.info-section {
  margin-bottom: 24px;
}

.info-section h2 {
  font-size: 13px;
  font-weight: 600;
  color: #a6adc8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  font-size: 10px;
  padding: 2px 8px;
  background: #45475a;
  border-radius: 4px;
  color: #6c7086;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.info-card {
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  overflow: hidden;
}

.info-row {
  display: flex;
  padding: 10px 16px;
  border-bottom: 1px solid #313244;
  font-size: 13px;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.info-key {
  color: #89b4fa;
  width: 160px;
  flex-shrink: 0;
}

.info-value {
  color: #a6e3a1;
  word-break: break-all;
}

.version-badge {
  background: rgba(137, 180, 250, 0.15);
  color: #89b4fa;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.empty-hint {
  padding: 16px;
  text-align: center;
  color: #6c7086;
  font-size: 12px;
}
</style>
