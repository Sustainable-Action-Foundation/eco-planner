export type ToastType = 'success' | 'error' | 'warning';

export type Toast = {
  id: number;
  text: string;
  type: ToastType;
  hasTimeout: boolean;
};