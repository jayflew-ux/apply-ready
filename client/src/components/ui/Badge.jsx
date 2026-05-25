const variants = {
  teal:   'bg-teal/10 text-teal border-teal/20',
  copper: 'bg-copper/10 text-copper border-copper/20',
  gold:   'bg-gold/20 text-amber-800 border-gold/30',
  new:    'bg-gold text-amber-900 border-gold font-semibold',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  gray:   'bg-gray-100 text-gray-600 border-gray-200',
};

export default function Badge({ variant = 'teal', children, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 text-xs font-montserrat font-medium rounded-sm border',
        variants[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
