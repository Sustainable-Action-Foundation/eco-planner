"use client"
import { useToastContext } from "@/components/generic/toast/toastContext";
import Toast from "./toast";
import styles from './toast.module.css'

export default function ToastList() {
  const { messages } = useToastContext();
  return (
    <aside>
      <output className={`${styles["toast-list"]} position-fixed flex flex-direction-column-reverse gap-50`} aria-live="polite">
        {messages.map((message) => (
          <Toast key={message.id} id={message.id} type={message.type} hasTimeout={message.hasTimeout}>
            {message.text}
          </Toast>
        ))}
      </output>
    </aside>
  )
}