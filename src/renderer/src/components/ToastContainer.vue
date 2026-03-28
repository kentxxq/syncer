<script setup lang="ts">
import { toastState } from "../utils/toast";
import Toast from "./Toast.vue";
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast-list">
      <Toast
        v-for="t in toastState.toasts"
        :key="t.id"
        :message="t.message"
        :type="t.type"
        :duration="t.duration"
        @close="toastState.removeToast(t.id)"
      />
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 10000;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.75rem;
  pointer-events: none;
}

.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 列表移动动画 */
.toast-list-move {
  transition: transform 0.3s;
}
</style>
