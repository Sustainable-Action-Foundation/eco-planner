import { IconCheck } from "@tabler/icons-react";
import { ReactNode, useEffect, useState } from "react";
import { useToastContext } from "@/context/context";

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
    <div className="toast-wrapper flex flex-direction-column rounded">
      <div className="flex padding-50 align-items-center justify-content-center rounded">
        <div className="padding-inline-75 padding-block-25">
          <div className="padding-25 circular" style={{ background: "rgb(0, 235, 0)" }}>
            <IconCheck aria-hidden="true" className="display-block" width={30} height={30} strokeWidth={3} color="white" />
          </div>
        </div>
        <div className="padding-75 padding-left-50">
          <h3 className="margin-0">Success</h3>
          <p className="margin-0">{children}</p>
        </div>
      </div>
      <progress value={timer} max={totalTime} className="" style={{
        display: "block",
        blockSize: "unset",
        inlineSize: "unset",
        verticalAlign: "unset",
        width: "100%",
        height: "10px",
        appearance: "none",
        accentColor: "rgb(0, 235, 0)",
      }} />
    </div>
  )
}