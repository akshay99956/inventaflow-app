import { toast as sonnerToast, ExternalToast } from "sonner";
import { playSuccess, playError, playWarning, playNotification, playDelete } from "./soundUtils";

type ToastMessage = string | React.ReactNode;

function success(message: ToastMessage, options?: ExternalToast) {
  playSuccess();
  return sonnerToast.success(message, options);
}

function error(message: ToastMessage, options?: ExternalToast) {
  playError();
  return sonnerToast.error(message, options);
}

function warning(message: ToastMessage, options?: ExternalToast) {
  playWarning();
  return sonnerToast.warning(message, options);
}

function info(message: ToastMessage, options?: ExternalToast) {
  playNotification();
  return sonnerToast.info(message, options);
}

function deleted(message: ToastMessage, options?: ExternalToast) {
  playDelete();
  return sonnerToast.success(message, options);
}

// Default toast with notification sound
function base(message: ToastMessage, options?: ExternalToast) {
  playNotification();
  return sonnerToast(message, options);
}

export const toastWithSound = Object.assign(base, {
  success,
  error,
  warning,
  info,
  deleted,
  // Pass through other sonner methods
  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
  loading: sonnerToast.loading,
  message: sonnerToast.message,
  custom: sonnerToast.custom,
});
