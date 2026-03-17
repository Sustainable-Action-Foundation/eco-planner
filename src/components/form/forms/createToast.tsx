import { IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";

export function showToast(toastRef: React.RefObject<HTMLDivElement | null>) {
  const toast = toastRef.current;
  if (!toast) return;

  toast.style.opacity = "1";
  toast.style.transform = "translateX(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-60px)";
  }, 3000);
};


export default function CreateToast({ toastRef }: { toastRef: React.RefObject<HTMLDivElement | null> }) {

  const totalTime = 3000;
  const stepTime = 50;
  const [timer, setTimer] = useState<number>(totalTime);
  useEffect(() => {
    console.log(timer);
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prevTimer) => prevTimer - stepTime);
    }, stepTime);
    return () => clearInterval(interval);
  }, [timer]);

  return (
    <div ref={toastRef} className="toast-content padding-75 flex align-items-center justify-content-center rounded opacity-1"/* opacity-0 */ >
      <div className="toast-header padding-inline-75 padding-block-25">
        <div className="toast-icon-wrapper padding-25">
          <IconCheck aria-hidden="true" className="toast-icon" width={30} height={30} strokeWidth={3} color="white" />
        </div>
      </div>
      <div className="toast-body padding-75 padding-left-50">
        <h3>Success</h3>
        <p className="font-size">The action was created successfully</p>
      </div>
      <progress value={timer} max={totalTime}></progress>
    </div>
  )
}