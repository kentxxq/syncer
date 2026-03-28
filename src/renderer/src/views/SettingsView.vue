<script setup lang="ts">
// MVP 设置页面 - 主题和语言切换占位
// 后续可扩展为 localStorage 或配置持久化
</script>

<template>
  <div class="settings-view">
    <h1 class="page-title">⚙️ 设置</h1>

    <section class="settings-section">
      <h2>外观</h2>
      <div class="setting-card">
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">主题</span>
            <span class="setting-desc">选择应用的显示主题</span>
          </div>
          <div class="setting-control">
            <span class="coming-soon">暗色（默认）</span>
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">语言</span>
            <span class="setting-desc">界面显示语言</span>
          </div>
          <div class="setting-control">
            <span class="coming-soon">中文（默认）</span>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h2>路径</h2>
      <div class="setting-card">
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">配置目录</span>
            <span class="setting-desc mono">~/.config/syncer/</span>
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">源文件目录</span>
            <span class="setting-desc mono">~/.config/syncer/files/</span>
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">配置文件</span>
            <span class="setting-desc mono">~/.config/syncer/syncer.yaml</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
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

.settings-section {
  margin-bottom: 24px;
}

.settings-section h2 {
  font-size: 13px;
  font-weight: 600;
  color: #a6adc8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px;
}

.setting-card {
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #313244;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-label {
  font-size: 13px;
  color: #cdd6f4;
  font-weight: 500;
}

.setting-desc {
  font-size: 11px;
  color: #6c7086;
}

.setting-desc.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #89b4fa;
}

.coming-soon {
  font-size: 12px;
  color: #6c7086;
  padding: 4px 10px;
  background: #45475a;
  border-radius: 4px;
}
</style>
