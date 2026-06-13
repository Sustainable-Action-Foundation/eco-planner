import type { Toast, ToastType } from "@/components/generic/toast/types.ts";
import { createContext } from "react";

export type ToastContextType = {
  messages: Array<Toast>;
  addToast: (text: string, type: ToastType, hasTimeout?: boolean) => void;
  removeToast: (id: number) => void;
  clearToasts: () => void;
};

export const ToastContext = createContext<ToastContextType | null>(null);
