import { IconCheck } from "@tabler/icons-react";
import { ReactNode, useEffect, useState } from "react";

export default function CreateToast({ children }: { children?: ReactNode; positioned?: boolean }) {

  const totalTime = 3000;
  const stepTime = 25;
  const [timer, setTimer] = useState<number>(totalTime);

  useEffect(() => {
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
  }, []);

  return (
    <div className="toast-wrapper flex flex-direction-column rounded">
      <div className="padding-50 flex align-items-center justify-content-center rounded">
        <div className="toast-header padding-inline-75 padding-block-25">
          <div className="toast-icon-wrapper padding-25 circular" style={{ background: "rgb(0, 235, 0)" }}>
            <IconCheck aria-hidden="true" className="toast-icon display-block" width={30} height={30} strokeWidth={3} color="white" />
          </div>
        </div>
        <div className="padding-75 padding-left-50">
          <h3 className="margin-0">Success</h3>
          <p className="margin-0">{children}</p>
        </div>
      </div>
      <progress value={timer} max={totalTime} className="height-0" />
    </div>
  )
}