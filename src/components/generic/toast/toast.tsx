import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconCircleCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import styles from './toast.module.css';
import { useEffect, useState } from "react";
import { useToastContext } from "@/context/context";
import { useTranslation } from "node_modules/react-i18next";

export default function CreateToast({ children, id, type, hasTimeout = true }: { children?: ReactNode; id: number; type: 'success' | 'error' | 'warning'; hasTimeout?: boolean }) {

  const { t } = useTranslation(["components"]);

  const totalTime = 3000;
  const stepTime = 25;
  const [timer, setTimer] = useState<number>(totalTime);

  const { removeMessage } = useToastContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [closeToast, setCloseToast] = useState<boolean>(false);

  const colorMap = {
    success: {
      normal: "rgb(56, 156, 61)",
      accent: "rgb(45, 122, 45)",
      darker: "rgba(170, 242, 170, 0.75)",
      background: "rgba(227, 255, 227, 0.95)",
      extends: "none",
    },
    warning: {
      normal: "rgb(252, 193, 16)",
      accent: "rgb(184, 134, 11)",
      darker: "rgba(237, 219, 147, 0.75)",
      background: "rgba(255, 250, 230, 0.95)",
      extends: "none",
    },
    error: {
      normal: "rgb(255, 72, 72)",
      accent: "rgb(197, 48, 48)",
      darker: "rgba(248, 131, 131, 0.25)",
      background: "rgba(249, 237, 237, 0.95)",
      extends: "rgb(243, 227, 227)",
    },

  };

  const color = colorMap[type];

  const maxLengthMessage = 35;

  if (typeof children === "string" && type !== "error" && children.length > maxLengthMessage) {
    throw new Error("Toast message is too long for a success or warning toast.");
  }

  const errorLong = typeof children === "string" && type === "error" && children.length > maxLengthMessage;

  useEffect(() => {
    if (!hasTimeout) return;

    if (timer <= 0) {
      setCloseToast(true);
      setTimeout(() => removeMessage(id), 200);
      // This timeout should be less than the duration of the closing animation 
      // to make sure the removal of the toast is before the animation is finished
    }

    const interval = setInterval(() => {
      setTimer((prev) => {
        const next = prev - stepTime;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, stepTime);

    return () => clearInterval(interval);
  }, [timer, hasTimeout, id, removeMessage]);

  return (
    <dialog
      className={styles.toast + " flex flex-direction-column rounded position-relative padding-0 width-100 rounded" + (closeToast ? " " + styles.toastClosing : "")}
      role={type === "error" ? "alert" : "status"}
      style={{ backgroundColor: color.background, borderLeft: `4px solid ${color.accent}` }}
    >
      <header className="flex align-items-center padding-inline-100 padding-top-75 padding-bottom-25 gap-50" >
        <div className="padding-50 round grid" style={{ backgroundColor: color.darker }}>
          {type === "success"
            ? <IconCircleCheck aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.accent} />
            : type === "warning"
              ? <IconInfoCircle aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.accent} />
              : <IconAlertTriangle aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.accent} />
          }
        </div>
        <span className="margin-0 font-weight-600" style={{ fontSize: "1.2rem" }}>{
          type === "success"
            ? t("components:toasts.success")
            : type === "warning"
              ? t("components:toasts.warning")
              : t("components:toasts.error")
        }</span>
        <button onClick={() => removeMessage(id)} className="round padding-25 transparent margin-left-auto grid" aria-label="Close toast">
          <IconX aria-hidden="true" width={22} height={22} strokeWidth={3} color={color.accent} />
        </button>
      </header>
      <p
        className={`margin-0 margin-bottom-75 ${type === "error" && errorLong ? (isOpen ? styles.toastOpen : styles.toastClosed) : ""}`} style={{ paddingInline: "1.25rem" }} >
        {children}
      </p>
      {type === 'error' && errorLong &&
        <button className={"margin-0 padding-25 width-100 cursor-pointer"}
          onClick={() => setIsOpen((prev) => !prev)} style={{ backgroundColor: color.extends }}>
          <span className="flex align-items-flex-end font-weight-600" >
            <IconArrowUp className="margin-left-25 margin-right-50" width={16} height={16} style={{ transform: `${isOpen ? '' : 'rotate(180deg)'}` }} />
            {isOpen ? 'Show less' : 'Show more'}
          </span>
        </button>
      }
      <progress className={`${hasTimeout ? "" : "none"}`} value={hasTimeout ? timer : 0} max={totalTime} aria-hidden="true" style={{ '--progress-color': color.accent, '--progress-background-color': color.background } as React.CSSProperties} />
    </dialog>
  );
}