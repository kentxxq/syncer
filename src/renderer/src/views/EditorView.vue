<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MonacoEditor from '../components/MonacoEditor.vue'

const props = defineProps<{
  pkgName: string
  filePath?: string
  readOnly?: boolean
}>()

const content = ref('')
const saved = ref(false)

const displayTitle = computed(() => {
  const prefix = props.readOnly ? '👁 查看' : '✏️ 编辑'
  return props.filePath
    ? `${prefix} - ${props.pkgName}/${props.filePath}`
    : `${prefix} - ${props.pkgName}`
})

onMounted(async () => {
  try {
    content.value = await window.api.readPackageFile(props.pkgName, props.filePath)
  } catch (e) {
    console.error('读取文件失败:', e)
  }
})

async function save(): Promise<void> {
  try {
    await window.api.writePackageFile(props.pkgName, content.value, props.filePath)
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 2000)
  } catch (e) {
    console.error('保存失败:', e)
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (!props.readOnly) save()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="editor-layout">
    <div class="editor-toolbar">
      <span class="editor-title">{{ displayTitle }}</span>
      <div class="toolbar-right">
        <template v-if="!readOnly">
          <span v-if="saved" class="save-toast">✓ 已保存</span>
          <button class="btn btn-primary" @click="save">💾 保存</button>
        </template>
        <span v-else class="readonly-badge">🔒 只读</span>
      </div>
    </div>
    <div class="editor-body">
      <MonacoEditor v-model="content" language="plaintext" :read-only="readOnly || false" />
    </div>
  </div>
</template>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #11111b;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #1e1e2e;
  border-bottom: 1px solid #313244;
}

.editor-title {
  font-size: 13px;
  color: #cdd6f4;
  font-weight: 500;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-toast {
  font-size: 12px;
  color: #a6e3a1;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.readonly-badge {
  font-size: 11px;
  color: #6c7086;
  padding: 3px 8px;
  background: #313244;
  border-radius: 4px;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

.btn {
  padding: 5px 12px;
  font-size: 12px;
  border: 1px solid #89b4fa;
  border-radius: 6px;
  background: transparent;
  color: #89b4fa;
  cursor: pointer;
  transition: all 0.12s;
}

.btn:hover {
  background: rgba(137, 180, 250, 0.15);
}
</style>
