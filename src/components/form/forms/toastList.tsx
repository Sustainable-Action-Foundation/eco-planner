"use client"
import { useToastContext } from "@/context/context";
import CreateToast from "./createToast";

export default function ToastList() {
  const { messages } = useToastContext();
  return (
    <output className="toast-container position-fixed flex flex-direction-column-reverse gap-50" style={{ top: "24px", right: "16px", zIndex: "calc(infinity * 1)" }} aria-live="polite">
      {messages.map((message) => (
        <CreateToast key={message.id} id={message.id} type={message.type}>
          {message.text}
        </CreateToast>
      ))}
    </output>
  )
}