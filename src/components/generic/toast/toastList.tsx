"use client"
import { useToastContext } from "@/components/generic/toast/toastContext";
import CreateToast from "./toast";
import styles from './toast.module.css'

export default function ToastList() {
  const { messages } = useToastContext();
  return (
    <aside>
      <output className={`${styles.toastCard} position-fixed flex flex-direction-column-reverse gap-50`} aria-live="polite">
        {messages.map((message) => (
          <CreateToast key={message.id} id={message.id} type={message.type} hasTimeout={message.hasTimeout}>
            {message.text}
          </CreateToast>
        ))}
      </output>
    </aside>
  )
}