import { clsx } from 'clsx';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const controlBase =
  'w-full rounded-xl border bg-white px-3.5 text-sm text-sand-900 placeholder:text-sand-400 transition-colors ' +
  'focus:outline-none focus:ring-3 focus:ring-pine-200 focus:border-pine-500 disabled:bg-sand-100 disabled:text-sand-500';

const controlState = (invalid: boolean) =>
  invalid
    ? 'border-red-400 focus:ring-red-100 focus:border-red-500'
    : 'border-sand-300 hover:border-sand-400';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired with aria attributes for screen readers. */
function FieldShell({ id, label, error, hint, required, children, className }: FieldShellProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-sand-800">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-sand-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

interface BaseProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
}

export const TextField = forwardRef<
  HTMLInputElement,
  BaseProps & InputHTMLAttributes<HTMLInputElement>
>(function TextField(
  { label, error, hint, containerClassName, className, id, required, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={clsx(controlBase, controlState(Boolean(error)), 'h-10', className)}
        {...props}
      />
    </FieldShell>
  );
});

export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextAreaField(
  { label, error, hint, containerClassName, className, id, required, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={clsx(controlBase, controlState(Boolean(error)), 'py-2.5', className)}
        {...props}
      />
    </FieldShell>
  );
});

export const SelectField = forwardRef<
  HTMLSelectElement,
  BaseProps & SelectHTMLAttributes<HTMLSelectElement>
>(function SelectField(
  { label, error, hint, containerClassName, className, id, required, children, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={clsx(controlBase, controlState(Boolean(error)), 'h-10 pr-8', className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

/** Accessible toggle built on a native checkbox (keyboard and screen reader friendly). */
export const SwitchField = forwardRef<HTMLInputElement, SwitchProps>(function SwitchField(
  { label, description, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className={clsx('flex cursor-pointer items-start gap-3', className)}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          {...props}
        />
        <span className="h-6 w-11 rounded-full bg-sand-300 transition-colors peer-checked:bg-pine-600 peer-focus-visible:ring-3 peer-focus-visible:ring-pine-200 peer-disabled:opacity-50" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-sand-900">{label}</span>
        {description && <span className="text-xs text-sand-500">{description}</span>}
      </span>
    </label>
  );
});
