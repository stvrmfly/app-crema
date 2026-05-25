// Single button primitive. Variants and sizes are the only "design system" knobs
// you should reach for; if you need an icon-only button or a one-off tweak, you can
// still pass `className` and it will compose with the variant/size classes.

const base = 'btn-press rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed';

const variants = {
  // Filled CTAs use bg-divider as the disabled bg (matches existing convention).
  primary: 'bg-accent hover:bg-accent-hover disabled:bg-divider text-white',
  // Highest-emphasis call-to-action (Submit Order, Create product, Export).
  // Use sparingly — only one CTA per view.
  cta:     'bg-cta hover:bg-cta-hover disabled:bg-divider text-white',
  success: 'bg-success hover:bg-success-hover disabled:bg-divider text-white',
  danger:  'bg-danger hover:bg-danger-hover disabled:bg-divider text-white',
  // Bordered "secondary" actions (toggles, cancels, Back).
  secondary: 'border border-divider text-ink-secondary hover:bg-elevated disabled:opacity-40',
  // Text-only buttons (Skip tour, low-emphasis links inside dialogs).
  ghost: 'text-ink-tertiary hover:text-ink-secondary disabled:opacity-40',
};

const sizes = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  lg: 'px-4 py-2.5',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const cls = [
    base,
    variants[variant] ?? variants.primary,
    sizes[size] ?? sizes.md,
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
