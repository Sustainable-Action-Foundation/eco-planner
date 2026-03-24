'use client'
import { createContext, useContext, useState, useRef } from "react";

type Toast = { id: number; text: string, type: 'success' | 'error' | 'warning' };
type ToastContextType = {
  messages: Array<Toast>;
  addMessage: (text: string, type: 'success' | 'error' | 'warning') => void;
  removeMessage: (id: number) => void;
}

const toasts = createContext<ToastContextType | undefined>(undefined)

export function ToastContext({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Array<Toast>>([]);
  const nextId = useRef(0);

  const addMessage = (text: string, type: 'success' | 'error' | 'warning') => {
    setMessages((prevMessages) => [...prevMessages, { id: nextId.current++, text, type }]);
  };

  const removeMessage = (id: number) => {
    setMessages((prevMessages) => prevMessages.filter((toast) => toast.id !== id));
  };

  return (
    <toasts.Provider value={{ messages, addMessage, removeMessage }}>
      {children}
    </toasts.Provider>
  )
}

export function useToastContext() {
  const context = useContext(toasts);
  if (!context) {
    throw new Error("useToastContext must be used inside a ToastContext provider");
  }
  return context;
}