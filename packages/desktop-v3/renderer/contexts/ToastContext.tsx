import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ToastContainer, toast } from 'react-toastify';

interface ToastContextType {
  log: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {

  const toastOptions = {
    position: 'bottom-right',
    className: 'p-0 w-[400px]',
    bodyClassName: 'p-4 text-sm text-white',
    progressClassName: 'bg-black-600/80',
    hideProgressBar: false,
    closeButton: true,
    autoClose: 5000,
    pauseOnHover: true,
    draggable: true,
    theme: 'dark',
  }

  const log = (message: string, title?: string) => {
    toast(message, toastOptions)
  }

  const warning = (message: string, title?: string) => {
    toast.warn(message, toastOptions)
  }

  const error = (message: string, title?: string) => {
    toast.error(message, toastOptions)
  }

  return (
    <ToastContext.Provider
      value={{
        log,
        warning,
        error
      }}
    >
      {children}
      
      <ToastContainer />

    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
