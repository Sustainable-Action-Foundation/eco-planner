'use client'
import { createContext, useContext, ReactNode, useState } from "react";

type ToastContextType = {
 messages: Array<string>;
 addMessage: (text: string) => void;
}

const toasts = createContext<ToastContextType | undefined>(undefined)

export function ToastContext({children}: {children: React.ReactNode}) {
  const [messages, setMessages] = useState<Array<string>>([])
  const addMessage = (text: string) => {
    setMessages((previousMessages) => [...previousMessages, text]);
  };

  return (
    <toasts.Provider value={{messages, addMessage}}>
      {children}
    </toasts.Provider>
  )
}

export function useToastContext() {
  const context = useContext(toasts);
  if (!context) {
    throw new Error("useToastContext must be used inside a ToastContext provider");
  }
  console.log(toasts);
  return context;
}