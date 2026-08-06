import React, { useId } from 'react';

/* ── Shared tokens ─────────────────────────────────────────────────────────── */

const labelClass =
  'block text-[11px] font-medium text-muted-foreground mb-1.5 select-none';

const fieldBase =
  'flex w-full rounded-md bg-background text-[13px] text-foreground ' +
  'placeholder:text-muted-foreground/40 border border-border ' +
  'hover:border-muted-foreground/40 ' +
  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-surface ' +
  'transition-colors duration-[120ms]';

const fieldError =
  'border-destructive hover:border-destructive ' +
  'focus:border-destructive focus:ring-destructive/25';

const messageBase = 'text-[11px] mt-1.5 m-0 leading-snug';

/* ── Input ─────────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    const msgId = `${inputId}-msg`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelClass}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={`${fieldBase} h-9 px-3 py-2 ${error ? fieldError : ''} ${className}`}
          {...props}
        />
        {error && (
          <p id={msgId} role="alert" className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
        {hint && !error && (
          <p id={msgId} className={`${messageBase} text-muted-foreground`}>{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

/* ── Textarea ──────────────────────────────────────────────────────────────── */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    const msgId = `${inputId}-msg`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelClass}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={`${fieldBase} min-h-22.5 px-3 py-2.5 resize-y ${error ? fieldError : ''} ${className}`}
          {...props}
        />
        {error && (
          <p id={msgId} role="alert" className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
        {hint && !error && (
          <p id={msgId} className={`${messageBase} text-muted-foreground`}>{hint}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

/* ── Select ────────────────────────────────────────────────────────────────── */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    const msgId = `${inputId}-msg`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelClass}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? msgId : undefined}
            className={`${fieldBase} h-9 pl-3 pr-8 py-2 appearance-none cursor-pointer ${error ? fieldError : ''} ${className}`}
            {...props}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p id={msgId} role="alert" className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

/* ── Checkbox ──────────────────────────────────────────────────────────────── */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className="flex items-center gap-2 select-none cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          className={`h-4 w-4 rounded-sm border-border text-primary focus:ring-1 focus:ring-primary/30 focus:ring-offset-background bg-background transition-colors cursor-pointer ${className}`}
          {...props}
        />
        <label htmlFor={inputId} className="text-[13px] text-foreground cursor-pointer leading-none">
          {label}
        </label>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

/* ── CurrencyInput ─────────────────────────────────────────────────────────── */

export const CurrencyInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, min = '0', step = 'any', ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    const msgId = `${inputId}-msg`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelClass}>
            {label}
          </label>
        )}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground font-medium select-none pointer-events-none">
            ₹
          </span>
          <input
            ref={ref}
            id={inputId}
            type="number"
            inputMode="decimal"
            min={min}
            step={step}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error || hint ? msgId : undefined}
            className={`${fieldBase} h-9 pl-7 pr-3 py-2 ${error ? fieldError : ''} ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p id={msgId} role="alert" className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
        {hint && !error && (
          <p id={msgId} className={`${messageBase} text-muted-foreground`}>{hint}</p>
        )}
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

