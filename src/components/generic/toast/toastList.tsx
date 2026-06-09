"use client";

import { useToastContext } from "@/components/generic/toast/toastContext";
import Toast from "./toast";
import styles from './toast.module.css';
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export default function ToastList() {

  const { t } = useTranslation("components");
  const { messages, clearToasts } = useToastContext();
  
  return (
    <aside className={`${styles["toast-list"]} flex flex-direction-column position-fixed pointer-events-none`} data-testid="toast-list">
      {messages.length > 0 ?
        <button onClick={clearToasts} className="flex gap-25 align-items-center margin-left-auto pointer-events-initial" type="button">
          {t("components:toasts.clear_toasts")}
          <div className="round padding-25 grid">
            <IconX width={16} height={16} aria-hidden="true" />
          </div>  
        </button>
      : null }
      <ul className={`flex flex-direction-column-reverse justify-content-flex-end flex-grow-100 list-style-none`} aria-live="polite">
        {messages.map((message) => (
          <li key={message.id}>
            <Toast id={message.id} type={message.type} hasTimeout={message.hasTimeout}>
              {message.text}
            </Toast>
          </li>
        ))}
      </ul>
    </aside>
  );
}