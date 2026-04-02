import { IconAlertTriangle, IconAlertTriangleFilled, IconArrowDown, IconArrowUp, IconCheck, IconCircle, IconCircleCheck, IconInfoCircle, IconInfoCircleFilled, IconX } from "@tabler/icons-react";
import { ReactNode, useEffect, useState } from "react";
import { useToastContext } from "@/context/context";

export default function CreateToast({ children, id, type, hasTimeout = true }: { children?: ReactNode; id: number; type: 'success' | 'error' | 'warning'; hasTimeout?: boolean }) {

  const totalTime = 3000;
  const stepTime = 15;
  const [timer, setTimer] = useState<number>(totalTime);

  const { removeMessage } = useToastContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const colorMap = {
    success: {
      normal: "rgb(56, 156, 61)",
      secondary: "rgb(45, 122, 45)",
      darker: "rgba(170, 242, 170, 0.75)",
      background: "rgb(227, 255, 227)",
      extends: "none",
    },
    error: {
      normal: "rgb(255, 72, 72)",
      secondary: "rgb(197, 48, 48)",
      darker: "rgba(248, 131, 131, 0.25)",
      background: "rgb(249, 237, 237)",
      extends: "rgb(243, 227, 227)",
    },
    warning: {
      normal: "rgb(252, 193, 16)",
      secondary: "rgb(184, 134, 11)",
      darker: "rgba(237, 219, 147, 0.75)",
      background: "rgb(255, 250, 230)",
      extends: "none",
    },
  };

  const ariaRole = type === "error" ? "alert" : "color";

  const color = colorMap[type];

  let errorLong = false;

  if (typeof children === "string" && children.length > 45) {
    if (type !== "error") {
      throw new Error("Toast message is too long for a success or warning toast. Consider shortening the message if it is the correct type.");
    } else {
      errorLong = true;
    }
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
      case "success": return <div>
        <IconCircleCheck aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.secondary} />
      </div>;
      case "warning": return <div>
        <IconInfoCircle aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.secondary} />
      </div>;
      case "error": return <div>
        <IconAlertTriangle aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.secondary} />
      </div>;
    }
  }

  return (
    <dialog
      className="toast flex flex-direction-column rounded position-relative padding-0 width-100 rounded"
      role={ariaRole}
      style={{ backgroundColor: color.background, borderLeft: `3px solid ${color.secondary}` }}
    >
      <header className="flex align-items-center padding-inline-100 padding-top-75 padding-bottom-25 gap-50" >
        <div className="padding-50 round grid" style={{ backgroundColor: color.darker }}>
          {getIcon()}
        </div>
        <h3 className="margin-0 font-weight-600">{type.charAt(0).toUpperCase() + type.slice(1)}!</h3>
        <button onClick={() => removeMessage(id)} className="round padding-25 transparent margin-left-auto grid" aria-label="Close toast">
          <IconX aria-hidden="true" width={22} height={22} strokeWidth={3} color={color.secondary} />
        </button>
      </header>
      <p className={`toast-body margin-0 margin-bottom-75 padding-inline-100 ${type === "error" && errorLong ? (isOpen ? "open" : "closed") : ""}`}>
        {children}
      </p>
      {type === 'error' && errorLong &&
        <button className={`margin-0 padding-25 width-100 ${type === "error" && errorLong === true ? "cursor-pointer" : ""}`} onClick={() => setIsOpen((prev) => !prev)} style={{ backgroundColor: color.extends }}>
          <span className="flex align-items-flex-end font-weight-600" >
            {isOpen ? <IconArrowUp className="margin-left-25 margin-right-50" width={16} height={16} /> : <IconArrowDown className="margin-top-auto margin-left-25 margin-right-50" width={16} height={16} style={{ marginTop: "auto" }} />}
            {isOpen ? 'Show less' : 'Show more'}
          </span>
        </button>
      }
      <progress className={`${hasTimeout ? "" : "none"}`} value={hasTimeout ? timer : 0} max={totalTime} aria-hidden="true" style={{ '--progress-color': color.secondary, '--progress-background-color': color.background } as React.CSSProperties} />
    </dialog>
  )
}