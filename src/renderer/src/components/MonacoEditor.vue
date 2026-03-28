<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import * as monaco from "monaco-editor";

const props = defineProps<{
  /** 编辑器内容 */
  modelValue: string;
  /** 语言模式 */
  language?: string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 主题 */
  theme?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const editorContainer = ref<HTMLDivElement>();
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

onMounted(() => {
  if (!editorContainer.value) return;

  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language || "plaintext",
    theme: props.theme || "vs-dark",
    readOnly: props.readOnly || false,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
    padding: { top: 8 },
  });

  // 内容变化时通知父组件
  editor.onDidChangeModelContent(() => {
    if (!props.readOnly) {
      const value = editor?.getValue() || "";
      emit("update:modelValue", value);
    }
  });
});

// 当外部 modelValue 变化时更新编辑器内容
watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && editor.getValue() !== newValue) {
      editor.setValue(newValue);
    }
  },
);

// 当 readOnly 变化时更新
watch(
  () => props.readOnly,
  (newValue) => {
    editor?.updateOptions({ readOnly: newValue || false });
  },
);
</script>

<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<style scoped>
.monaco-editor-container {
  width: 100%;
  height: 100%;
}
</style>
