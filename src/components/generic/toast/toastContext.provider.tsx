"use client";

import type { Toast, ToastType } from "@/components/generic/toast/types.ts";
import { useRef, useState } from "react";
import { ToastContext } from "./toastContext.internal";

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Array<Toast>>([]);
  const nextToastId = useRef(0);

  const addToast = (text: string, type: ToastType, hasTimeout: boolean = true) => {
    setMessages((prevMessages) => [...prevMessages, { id: nextToastId.current++, text, type, hasTimeout }]);
  };

  const removeToast = (id: number) => {
    setMessages((prevMessages) => prevMessages.filter((toast) => toast.id !== id));
  };

  const clearToasts = () => {
    setMessages([]);
  };

  return (
    <ToastContext.Provider value={{ messages, addToast, removeToast, clearToasts }}>
      {children}
    </ToastContext.Provider>
  );
}
