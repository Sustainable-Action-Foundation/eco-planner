"use client"
import { useToastContext } from "@/context/context";

export default function ToastList() {
  const { messages } = useToastContext();
  return (
    <div className="position-fixed flex flex-direction-column-reverse" style={{ top: "0", right: "0", zIndex: "calc(infinity * 1)" }}>
      {messages.map((message, index) => (
        <p key={index}>{message}</p>
      ))}
    </div>
  )
}