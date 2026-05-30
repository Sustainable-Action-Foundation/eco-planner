'use client';
import { createContext, useContext, useState, useRef } from "react";
import type { Toast, ToastContextType, ToastType } from '@/components/generic/toast/types.ts';

const toasts = createContext<ToastContextType | undefined>(undefined);

export function ToastContext({ children }: { children: React.ReactNode }) {
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
    <toasts.Provider value={{ messages, addToast, removeToast, clearToasts }}>
      {children}
    </toasts.Provider>
  );
}

export function useToastContext() {
  const context = useContext(toasts);
  if (!context) {
    throw new Error("useToastContext must be used inside a ToastContext provider");
  }
  return context;
}