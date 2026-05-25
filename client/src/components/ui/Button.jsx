import { forwardRef } from 'react';

const variants = {
  primary: 'bg-teal text-white hover:bg-teal-dark active:bg-teal-dark focus-visible:ring-teal',
  outline: 'border border-teal text-teal hover:bg-teal hover:text-white focus-visible:ring-teal',
  ghost:   'text-teal hover:bg-teal/10 focus-visible:ring-teal',
  danger:  'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  copper:  'border border-copper text-copper hover:bg-copper hover:text-white focus-visible:ring-copper',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base',
};

const Button = forwardRef(({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-montserrat font-semibold tracking-wide',
        'rounded-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
