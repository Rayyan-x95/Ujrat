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
          className={`${fieldBase} h-9 px-3 py-2 ${error ? fieldError : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
        {hint && !error && (
          <p className={`${messageBase} text-muted-foreground`}>{hint}</p>
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
          className={`${fieldBase} min-h-22.5 px-3 py-2.5 resize-y ${error ? fieldError : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
        {hint && !error && (
          <p className={`${messageBase} text-muted-foreground`}>{hint}</p>
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
          <p className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
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

/* ── Radio ─────────────────────────────────────────────────────────────────── */

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className="flex items-center gap-2 select-none cursor-pointer">
        <input
          ref={ref}
          type="radio"
          id={inputId}
          className={`h-4 w-4 border-border text-primary focus:ring-1 focus:ring-primary/30 focus:ring-offset-background bg-background transition-colors cursor-pointer ${className}`}
          {...props}
        />
        <label htmlFor={inputId} className="text-[13px] text-foreground cursor-pointer leading-none">
          {label}
        </label>
      </div>
    );
  }
);
Radio.displayName = 'Radio';

/* ── Switch ────────────────────────────────────────────────────────────────── */

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  checked?: boolean;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, checked, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className={`flex items-center gap-3 select-none cursor-pointer ${className}`}>
        <label
          htmlFor={inputId}
          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-1 focus-within:ring-offset-background"
          style={{ backgroundColor: checked ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
        >
          <input ref={ref} type="checkbox" id={inputId} checked={checked} className="sr-only peer" {...props} />
          <span
            className={`pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-120 ${
              checked ? 'translate-x-4' : ''
            }`}
          />
        </label>
        <label htmlFor={inputId} className="text-[13px] text-foreground cursor-pointer">
          {label}
        </label>
      </div>
    );
  }
);
Switch.displayName = 'Switch';

/* ── CurrencyInput ─────────────────────────────────────────────────────────── */

export const CurrencyInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
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
            className={`${fieldBase} h-9 pl-7 pr-3 py-2 ${error ? fieldError : ''} ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
        {hint && !error && (
          <p className={`${messageBase} text-muted-foreground`}>{hint}</p>
        )}
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

/* ── PhoneInput ────────────────────────────────────────────────────────────── */

export const PhoneInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelClass}>
            {label}
          </label>
        )}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground font-medium select-none pointer-events-none">
            +91
          </span>
          <input
            ref={ref}
            id={inputId}
            type="tel"
            className={`${fieldBase} h-9 pl-10 pr-3 py-2 ${error ? fieldError : ''} ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className={`${messageBase} text-destructive font-medium animate-fade-in`}>{error}</p>
        )}
        {hint && !error && (
          <p className={`${messageBase} text-muted-foreground`}>{hint}</p>
        )}
      </div>
    );
  }
);
PhoneInput.displayName = 'PhoneInput';

/* ── OTPInput ──────────────────────────────────────────────────────────────── */

export const OTPInput: React.FC<{
  label?: string;
  onChange?: (code: string) => void;
}> = ({ label, onChange }) => {
  const [digits, setDigits] = React.useState<string[]>(Array(6).fill(''));
  const inputsRef = React.useRef<(HTMLInputElement | null)[]>([]);
  const defaultId = useId();

  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleaned.slice(-1);
    setDigits(newDigits);
    onChange?.(newDigits.join(''));
    if (cleaned && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div>
      {label && (
        <label htmlFor={`${defaultId}-otp-0`} className={`${labelClass} text-center block`}>
          {label}
        </label>
      )}
      <div className="flex gap-2 justify-center">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={el => { inputsRef.current[idx] = el; }}
            id={`${defaultId}-otp-${idx}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleDigitChange(idx, e.target.value)}
            onKeyDown={e => handleKeyDown(idx, e)}
            className="w-10 h-11 text-center font-semibold text-base rounded-md border border-border bg-background hover:border-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-colors font-mono"
            aria-label={`OTP digit ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
