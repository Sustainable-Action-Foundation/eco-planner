import { IconAlertTriangleFilled, IconCheck, IconInfoCircleFilled, IconX } from "@tabler/icons-react";
import { ReactNode, useEffect, useState } from "react";
import { useToastContext } from "@/context/context";

export default function CreateToast({ children, id, type, hasTimeout = true }: { children?: ReactNode; id: number; type: 'success' | 'error' | 'warning'; hasTimeout?: boolean }) {

  const totalTime = 3000;
  const stepTime = 15;
  const [timer, setTimer] = useState<number>(totalTime);

  const { removeMessage } = useToastContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const colorMap = {
    success: "rgb(56, 156, 61)",
    error: "rgb(255, 82, 81)",
    warning: "rgb(252, 193, 16)",
  }

  const ariaRole = type === "error" ? "alert" : "status";

  const openAble = type === "error" ? (isOpen ? "open" : "closed") : "";

  if (typeof children === "string" && children.length > 45 && type !== "error") {
    throw new Error("Toast message is too long for a success or warning toast. Consider shortening the message if it is the correct type.");
  }

  useEffect(() => {
    if (!hasTimeout) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        const next = prev - stepTime;
        if (next <= 0) {
          clearInterval(interval);
          removeMessage(id);
          return 0;
        }
        return next;
      });
    }, stepTime);
    return () => clearInterval(interval);
  }, [id, removeMessage, hasTimeout]);

  function getIcon() {
    switch (type) {
      case "success": return <div className="round" style={{ backgroundColor: "rgb(242, 242, 242)" }}>
        {/* Very small margin so the check appears inside of the circle */}
        <IconCheck aria-hidden="true" className="display-block round" width={20} height={20} strokeWidth={3} color={colorMap[type]} style={{ margin: "3px" }} />
      </div>;
      case "warning": return <div>
        <IconInfoCircleFilled aria-hidden="true" className="display-block round" width={26} height={26} strokeWidth={3} color="white" />
      </div>;
      case "error": return <div>
        <IconAlertTriangleFilled aria-hidden="true" className="display-block round" width={26} height={26} strokeWidth={3} color="white" />
      </div>;
    }
  }

  return (
    <dialog
      className={`toast flex flex-direction-column rounded position-relative padding-0 width-100 rounded ${type === 'error' ? 'cursor-pointer' : ''}`}
      role={ariaRole}
      style={{ backgroundColor: colorMap[type], border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", overflow: "hidden" }}
      onClick={() => setIsOpen((prev) => !prev)}
    >
      <header className="flex align-items-center padding-100 padding-bottom-25 gap-50" >
        {getIcon()}
        <h3 className="margin-0">{type.charAt(0).toUpperCase() + type.slice(1)}!</h3>
        <button onClick={() => removeMessage(id)} className="round padding-25 transparent margin-left-auto" aria-label="Close toast">
          <IconX aria-hidden="true" width={24} height={24} strokeWidth={3} color="rgb(242, 242, 242)" />
        </button>
      </header>
      <p className={`toast-body ${type === 'error' ? 'toast-body-error' : ''}  ${openAble}`}>{children}</p>
      <progress value={hasTimeout ? timer : 0} max={totalTime} aria-hidden="true" style={{ marginTop: "1rem", '--progress-color': colorMap[type] } as React.CSSProperties} />
    </dialog>
  )
}