export type ToastType = 'success' | 'error' | 'warning';

export type Toast = {
  id: number;
  text: string;
  type: ToastType;
  hasTimeout: boolean;
};

export type ToastContextType = {
  messages: Array<Toast>;
  addToast: (text: string, type: ToastType, hasTimeout?: boolean) => void;
  removeToast: (id: number) => void;
  clearToasts: () => void;
};