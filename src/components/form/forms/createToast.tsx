import { IconAlertTriangleFilled, IconCheck, IconInfoCircleFilled, IconX } from "@tabler/icons-react";
import { ReactNode, useEffect, useState } from "react";
import { useToastContext } from "@/context/context";

export default function CreateToast({ children, id, type }: { children?: ReactNode; id: number; type: 'success' | 'error' | 'warning' }) {

  const totalTime = 3000;
  const stepTime = 15;
  const [timer, setTimer] = useState<number>(totalTime);

  const colorMap = {
    success: "rgb(56, 156, 61)",
    error: "rgb(255, 82, 81)",
    warning: "rgb(255, 193, 7)",
  }

  const ariaRole = type === "error" ? "alert" : "status";

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

  const { removeMessage } = useToastContext();

  useEffect(() => {
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
  }, []);

  return (
    <dialog
      className="toast flex flex-direction-column rounded position-relative padding-0 width-100"
      role={ariaRole}
      style={{ backgroundColor: colorMap[type], border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
    >
      <header className="flex align-items-center padding-100 gap-50" >
        {getIcon()}
        <p className="margin-0 color-purewhite">{children}</p>
        <button onClick={() => removeMessage(id)} className="round padding-25 transparent" aria-label="Close toast">
          <IconX aria-hidden="true" width={20} height={20} strokeWidth={3} color="rgb(242, 242, 242)" />
        </button>
      </header>
      <progress value={timer} max={totalTime} aria-hidden="true" style={{ '--progress-color': colorMap[type] } as React.CSSProperties} />
    </dialog>
  )
}