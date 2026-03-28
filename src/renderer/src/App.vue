<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PackagesView from './views/PackagesView.vue'
import EditorView from './views/EditorView.vue'
import SettingsView from './views/SettingsView.vue'
import InfoView from './views/InfoView.vue'

// hash 路由
const route = ref({ page: 'main', params: [] as string[], readOnly: false })

function parseHash(): void {
  const hash = window.location.hash.replace('#', '')
  if (hash.startsWith('/editor/')) {
    // /editor/pkgName 或 /editor/pkgName/filePath?readonly
    const [pathPart, query] = hash.replace('/editor/', '').split('?')
    const parts = pathPart.split('/').map(decodeURIComponent)
    route.value = { page: 'editor', params: parts, readOnly: query === 'readonly' }
  } else {
    route.value = { page: 'main', params: [], readOnly: false }
  }
}

const currentPage = computed(() => route.value.page)

// 主窗口中的导航
const activeNav = ref<'packages' | 'settings' | 'info'>('packages')

onMounted(() => {
  parseHash()
  window.addEventListener('hashchange', parseHash)
})
</script>

<template>
  <!-- 子窗口：编辑器 -->
  <EditorView
    v-if="currentPage === 'editor'"
    :pkg-name="route.params[0]"
    :file-path="route.params[1]"
    :read-only="route.readOnly"
  />

  <!-- 主窗口：导航栏 + 内容 -->
  <div v-else class="app-shell">
    <nav class="nav-bar">
      <div class="nav-top">
        <div class="nav-brand">⚡</div>
        <button
          class="nav-item"
          :class="{ active: activeNav === 'packages' }"
          @click="activeNav = 'packages'"
          title="同步包"
        >
          📦
        </button>
        <button
          class="nav-item"
          :class="{ active: activeNav === 'settings' }"
          @click="activeNav = 'settings'"
          title="设置"
        >
          ⚙️
        </button>
        <button
          class="nav-item"
          :class="{ active: activeNav === 'info' }"
          @click="activeNav = 'info'"
          title="信息"
        >
          ℹ️
        </button>
      </div>
    </nav>
    <main class="main-content">
      <PackagesView v-if="activeNav === 'packages'" />
      <SettingsView v-else-if="activeNav === 'settings'" />
      <InfoView v-else-if="activeNav === 'info'" />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  background: #11111b;
}

/* 导航栏 */
.nav-bar {
  width: 52px;
  flex-shrink: 0;
  background: #11111b;
  border-right: 1px solid #313244;
  display: flex;
  flex-direction: column;
}

.nav-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}

.nav-brand {
  font-size: 20px;
  padding: 8px 0 12px;
  border-bottom: 1px solid #313244;
  width: 100%;
  text-align: center;
  margin-bottom: 4px;
}

.nav-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.12s ease;
  position: relative;
}

.nav-item:hover {
  background: #313244;
}

.nav-item.active {
  background: #45475a;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: #89b4fa;
  border-radius: 0 2px 2px 0;
}

/* 主内容 */
.main-content {
  flex: 1;
  overflow: hidden;
}
</style>
