import React, { useId } from 'react';

const labelClass = 'block text-label mb-1.5 font-semibold text-muted-foreground tracking-wider select-none';
const fieldBase =
  'flex w-full rounded-md bg-background text-body text-foreground placeholder:text-muted-foreground/50 border border-border hover:border-muted-foreground/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-40 transition-all duration-150 shadow-sm';

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
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={`${fieldBase} h-9.5 px-3 py-2 ${
            error ? 'border-destructive ring-2 ring-destructive/20 focus:ring-destructive/20 focus:border-destructive' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-destructive mt-1.5 font-medium m-0 animate-fade-in">{error}</p>}
        {hint && !error && <p className="text-[11px] text-muted-foreground mt-1.5 m-0">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

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
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <textarea
          ref={ref}
          id={inputId}
          className={`${fieldBase} min-h-[100px] px-3 py-2.5 resize-y ${
            error ? 'border-destructive ring-2 ring-destructive/20 focus:ring-destructive/20 focus:border-destructive' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-destructive mt-1.5 font-medium m-0 animate-fade-in">{error}</p>}
        {hint && !error && <p className="text-[11px] text-muted-foreground mt-1.5 m-0">{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

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
      <div className="w-full relative">
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={`${fieldBase} h-9.5 pl-3 pr-8 py-2 appearance-none cursor-pointer ${
              error ? 'border-destructive ring-2 ring-destructive/20 focus:ring-destructive/20 focus:border-destructive' : ''
            } ${className}`}
            {...props}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <p className="text-[11px] text-destructive mt-1.5 font-medium m-0 animate-fade-in">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className="flex items-center gap-2.5 select-none cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          className={`h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background bg-background transition-colors cursor-pointer ${className}`}
          {...props}
        />
        <label htmlFor={inputId} className="text-body text-foreground/80 cursor-pointer">
          {label}
        </label>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className="flex items-center gap-2.5 select-none cursor-pointer">
        <input
          ref={ref}
          type="radio"
          id={inputId}
          className={`h-4 w-4 border-border text-primary focus:ring-primary focus:ring-offset-background bg-background transition-colors cursor-pointer ${className}`}
          {...props}
        />
        <label htmlFor={inputId} className="text-body text-foreground/80 cursor-pointer">
          {label}
        </label>
      </div>
    );
  }
);
Radio.displayName = 'Radio';

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
        <label htmlFor={inputId} className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-secondary transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 focus-within:ring-offset-background">
          <input ref={ref} type="checkbox" id={inputId} checked={checked} className="sr-only peer" {...props} />
          <span className={`pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform duration-150 peer-checked:translate-x-4 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
        </label>
        <label htmlFor={inputId} className="text-body text-foreground/80 cursor-pointer">
          {label}
        </label>
      </div>
    );
  }
);
Switch.displayName = 'Switch';

export const CurrencyInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-small text-muted-foreground font-semibold">₹</span>
          <input
            ref={ref}
            id={inputId}
            type="number"
            className={`${fieldBase} h-9.5 pl-7 pr-3 py-2 ${
              error ? 'border-destructive ring-2 ring-destructive/20 focus:ring-destructive/20 focus:border-destructive' : ''
            } ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-[11px] text-destructive mt-1.5 font-medium m-0 animate-fade-in">{error}</p>}
        {hint && !error && <p className="text-[11px] text-muted-foreground mt-1.5 m-0">{hint}</p>}
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export const PhoneInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-small text-muted-foreground font-semibold">+91</span>
          <input
            ref={ref}
            id={inputId}
            type="tel"
            className={`${fieldBase} h-9.5 pl-11 pr-3 py-2 ${
              error ? 'border-destructive ring-2 ring-destructive/20 focus:ring-destructive/20 focus:border-destructive' : ''
            } ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-[11px] text-destructive mt-1.5 font-medium m-0 animate-fade-in">{error}</p>}
        {hint && !error && <p className="text-[11px] text-muted-foreground mt-1.5 m-0">{hint}</p>}
      </div>
    );
  }
);
PhoneInput.displayName = 'PhoneInput';

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
            className="w-10 h-11 text-center font-semibold text-base rounded-md border border-border bg-background hover:border-muted-foreground/30 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm font-mono"
            aria-label={`OTP digit ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
