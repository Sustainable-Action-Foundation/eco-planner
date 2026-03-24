import { IconCheck, IconX } from "@tabler/icons-react";
import { ReactNode, useEffect, useState } from "react";
import { useToastContext } from "@/context/context";
import { BackgroundColor } from "@tiptap/extension-text-style";

export default function CreateToast({ children, id }: { children?: ReactNode; id: number }) {

  const totalTime = 3000;
  const stepTime = 25;
  const [timer, setTimer] = useState<number>(totalTime);

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
    <dialog className="toast flex flex-direction-column rounded position-relative padding-0" style={{ backgroundColor: "rgb(56, 156, 61)", border: "none" }}>
      <header className="flex align-items-center padding-100 gap-50" >
        {/* Very small padding so the check appears inside of the circle */}
        <div className="round" style={{ backgroundColor: "rgba(254, 254, 254, 0.9)" }}>
          <IconCheck aria-hidden="true" className="display-block round" width={16} height={16} strokeWidth={3} color="rgba(76, 176, 81, 1)" style={{ margin: "3px" }} />
        </div>
        <p className="margin-0 color-purewhite">{children}</p>
        <button onClick={() => removeMessage(id)} className="round padding-25 transparent" aria-label="Close toast">
          <IconX aria-hidden="true" width={20} height={20} strokeWidth={3} color="rgba(222, 222, 222, 1)" />
        </button>
      </header>
      <progress value={timer} max={totalTime} aria-hidden="true" />
    </dialog>
  )
}