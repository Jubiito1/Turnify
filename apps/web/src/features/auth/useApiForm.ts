import { useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from '../../lib/api';

/**
 * Maps API errors onto a react-hook-form instance: backend VALIDATION_ERROR details become field
 * errors, anything else becomes a form-level message. Backend validation stays authoritative.
 */
export function useApiFormError<T extends FieldValues>(setError: UseFormSetError<T>) {
  const [formError, setFormError] = useState<string | null>(null);

  function handleError(error: unknown) {
    if (error instanceof ApiError) {
      const fields = error.fieldErrors;
      const entries = Object.entries(fields);
      if (entries.length) {
        entries.forEach(([path, message]) => setError(path as Path<T>, { message }));
        setFormError(null);
        return;
      }
    }
    setFormError(errorMessage(error));
  }

  return { formError, setFormError, handleError };
}
