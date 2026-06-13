import { useContext } from "react";
import { ToastContext } from "./toastContext.internal";

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastContextProvider");
  }
  return context;
}
