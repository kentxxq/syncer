import { reactive } from "vue";

export interface ToastMessage {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
  duration: number;
}

const toasts = reactive<ToastMessage[]>([]);
let count = 0;

export function addToast(message: string, type: ToastMessage["type"] = "info", duration = 3500) {
  const id = ++count;
  toasts.push({ id, message, type, duration });
  return id;
}

export function removeToast(id: number) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
  }
}

export const toastState = {
  toasts,
  addToast,
  removeToast,
};

// 快捷方法
export const toast = {
  success: (msg: string, dur?: number) => addToast(msg, "success", dur),
  error: (msg: string, dur?: number) => addToast(msg, "error", dur),
  info: (msg: string, dur?: number) => addToast(msg, "info", dur),
  warning: (msg: string, dur?: number) => addToast(msg, "warning", dur),
};
