import { IconCheck, IconX } from "@tabler/icons-react";
import { ReactNode, useEffect, useState } from "react";
import { useToastContext } from "@/context/context";

export default function CreateToast({ children, id, type }: { children?: ReactNode; id: number; type: 'success' | 'error' | 'warning' }) {

  const totalTime = 3000;
  const stepTime = 15;
  const [timer, setTimer] = useState<number>(totalTime);

  const colorMap = {
    success: "rgba(56, 156, 61, 0.9)",
    error: "rgba(255, 82, 81, 0.9)",
    warning: "rgba(255, 193, 7, 0.9)"
  }

  const ariaRole = type === "error" ? "alert" : "status";

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
    <dialog className="toast flex flex-direction-column rounded position-relative padding-0" role={ariaRole} style={{ backgroundColor: colorMap[type], border: "none" }}>
      <header className="flex align-items-center padding-100 gap-50" >
        {/* Very small padding so the check appears inside of the circle */}
        <div className="round" style={{ backgroundColor: "rgba(254, 254, 254, 0.9)" }}>
          <IconCheck aria-hidden="true" className="display-block round" width={16} height={16} strokeWidth={3} color="rgba(76, 176, 81, 1)" style={{ margin: "3px" }} />
        </div>
        <p className="margin-0 color-purewhite">{children}</p>
        <button onClick={() => removeMessage(id)} className="round padding-25 transparent" aria-label="Close toast">
          <IconX aria-hidden="true" width={20} height={20} strokeWidth={3} color="rgba(242, 242, 242, 1)" />
        </button>
      </header>
      <progress value={timer} max={totalTime} aria-hidden="true" style={{ '--progress-color': colorMap[type] } as React.CSSProperties} />
    </dialog>
  )
}