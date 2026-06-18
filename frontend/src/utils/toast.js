import { toast } from 'react-toastify';
import { errorMessage } from '../api/client';

const DEFAULT_SUCCESS_MESSAGE = 'Operation completed successfully';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong';

function getToastId(type, message) {
  return `${type}:${message}`;
}

export function showSuccessToast(message = DEFAULT_SUCCESS_MESSAGE) {
  toast.success(message, {
    toastId: getToastId('success', message),
  });
}

export function showErrorToast(error, fallback = DEFAULT_ERROR_MESSAGE) {
  const message = typeof error === 'string' ? error || fallback : errorMessage(error, fallback);

  toast.error(message, {
    toastId: getToastId('error', message),
  });

  return message;
}
