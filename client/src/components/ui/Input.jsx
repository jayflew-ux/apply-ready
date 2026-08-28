import { forwardRef } from 'react';

const Input = forwardRef(({ label, hint, error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-sm font-montserrat font-semibold text-ink/80 tracking-wide">
        {label}
      </label>
    )}
    <input
      ref={ref}
      className={[
        'w-full px-3 py-2.5 bg-white border rounded-sm font-lora text-sm text-ink',
        'placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal',
        'disabled:opacity-50 disabled:bg-gray-50',
        error ? 'border-red-400' : 'border-[#e3ddd2]',
        className,
      ].join(' ')}
      {...props}
    />
    {error && <p className="text-xs text-red-600 font-lora">{error}</p>}
    {hint && !error && <p className="text-xs text-ink/50 font-lora">{hint}</p>}
  </div>
));

Input.displayName = 'Input';

export function Textarea({ label, hint, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-montserrat font-semibold text-ink/80 tracking-wide">
          {label}
        </label>
      )}
      <textarea
        className={[
          'w-full px-3 py-2.5 bg-white border rounded-sm font-lora text-sm text-ink',
          'placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal',
          'resize-y min-h-[120px]',
          error ? 'border-red-400' : 'border-[#e3ddd2]',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-600 font-lora">{error}</p>}
      {hint && !error && <p className="text-xs text-ink/50 font-lora">{hint}</p>}
    </div>
  );
}

export default Input;
