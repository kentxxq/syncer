<script setup lang="ts">
import { ref, onMounted } from "vue";

interface ToastProps {
  message: string;
  type?: "info" | "success" | "error" | "warning";
  duration?: number;
}

const props = withDefaults(defineProps<ToastProps>(), {
  type: "info",
  duration: 3000,
});

const emit = defineEmits(["close"]);

const visible = ref(false);

onMounted(() => {
  // 延迟一帧显示，触发进入动画
  requestAnimationFrame(() => {
    visible.value = true;
  });

  if (props.duration > 0) {
    setTimeout(() => {
      close();
    }, props.duration);
  }
});

function close() {
  visible.value = false;
  // 等待动画结束
  setTimeout(() => {
    emit("close");
  }, 300);
}

const icons = {
  info: "ℹ️",
  success: "✅",
  error: "❌",
  warning: "⚠️",
};
</script>

<template>
  <div class="toast-item" :class="[type, { visible }]" @click="close">
    <span class="toast-icon">{{ icons[type] }}</span>
    <span class="toast-message">{{ message }}</span>
  </div>
</template>

<style scoped>
.toast-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 10px;
  background: #1e1e2e;
  border: 1px solid #313244;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  color: #cdd6f4;
  font-size: 13px;
  min-width: 200px;
  max-width: 400px;
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  
  /* 初始不可见状态 (右侧滑入) */
  opacity: 0;
  transform: translateX(40px) scale(0.95);
  transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.toast-item.visible {
  opacity: 1;
  transform: translateX(0) scale(1);
}

.toast-item.success {
  border-left: 3px solid #a6e3a1;
}

.toast-item.error {
  border-left: 3px solid #f38ba8;
}

.toast-item.warning {
  border-left: 3px solid #fab387;
}

.toast-item.info {
  border-left: 3px solid #89b4fa;
}

.toast-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
  word-break: break-word;
}
</style>
