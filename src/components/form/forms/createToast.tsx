import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconCircleCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import { ReactNode, useEffect, useRef, useState } from "react";
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
      accent: "rgb(45, 122, 45)",
      darker: "rgba(170, 242, 170, 0.75)",
      background: "rgb(227, 255, 227)",
      extends: "none",
    },
    error: {
      normal: "rgb(255, 72, 72)",
      accent: "rgb(197, 48, 48)",
      darker: "rgba(248, 131, 131, 0.25)",
      background: "rgb(249, 237, 237)",
      extends: "rgb(243, 227, 227)",
    },
    warning: {
      normal: "rgb(252, 193, 16)",
      accent: "rgb(184, 134, 11)",
      darker: "rgba(237, 219, 147, 0.75)",
      background: "rgb(255, 250, 230)",
      extends: "none",
    },
  };

  const ariaRole = type === "error" ? "alert" : "status";

  const color = colorMap[type];

  const messageRef = useRef<HTMLParagraphElement>(null);
  const [errorLong, setErrorLong] = useState(false);

  useEffect(() => {
    const element = messageRef.current;
    if (!element) return;

    const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
    const isTwoLine = element.scrollHeight > Math.ceil(lineHeight);
    const isMultiLine = element.scrollHeight > Math.ceil(lineHeight) * 2;

    if (isTwoLine) {
      if (type !== "error") {
        throw new Error("Toast message is too long for a success or warning toast.");
      }
      if (isMultiLine) {
        setErrorLong(true);
      }
    }
  }, [type]);

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
        <IconCircleCheck aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.accent} />
      </div>;
      case "warning": return <div>
        <IconInfoCircle aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.accent} />
      </div>;
      case "error": return <div>
        <IconAlertTriangle aria-hidden="true" className="display-block round" width={24} height={24} strokeWidth={3} color={color.accent} />
      </div>;
    }
  }

  return (
    <dialog
      className="toast flex flex-direction-column rounded position-relative padding-0 width-100 rounded"
      role={ariaRole}
      style={{ backgroundColor: color.background, borderLeft: `4px solid ${color.accent}` }}
    >
      <header className="flex align-items-center padding-inline-100 padding-top-75 padding-bottom-25 gap-50" >
        <div className="padding-50 round grid" style={{ backgroundColor: color.darker }}>
          {getIcon()}
        </div>
        <h3 className="margin-0 font-weight-600">{type.charAt(0).toUpperCase() + type.slice(1)}!</h3>
        <button onClick={() => removeMessage(id)} className="round padding-25 transparent margin-left-auto grid" aria-label="Close toast">
          <IconX aria-hidden="true" width={22} height={22} strokeWidth={3} color={color.accent} />
        </button>
      </header>
      <p
        ref={messageRef}
        className={`toast-body margin-0 margin-bottom-75 ${type === "error" && errorLong ? (isOpen ? "open" : "closed") : ""}`} style={{ paddingInline: "1.25rem" }} >
        {children}
      </p>
      {type === 'error' && errorLong &&
        <button className={`margin-0 padding-25 width-100 ${type === "error" && errorLong === true ? "cursor-pointer" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)} style={{ backgroundColor: color.extends }}>
          <span className="flex align-items-flex-end font-weight-600" >
            {isOpen ?
              <IconArrowUp className="margin-left-25 margin-right-50" width={16} height={16} /> :
              <IconArrowDown className="margin-top-auto margin-left-25 margin-right-50" width={16} height={16} style={{ marginTop: "auto" }} />}
            {isOpen ? 'Show less' : 'Show more'}
          </span>
        </button>
      }
      <progress className={`${hasTimeout ? "" : "none"}`} value={hasTimeout ? timer : 0} max={totalTime} aria-hidden="true" style={{ '--progress-color': color.accent, '--progress-background-color': color.background } as React.CSSProperties} />
    </dialog>

  )
}