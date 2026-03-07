export function MonkeyIcon({ size = 24, className, strokeWidth = 1.5 }: { size?: string | number; className?: string; strokeWidth?: string | number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="5.5" cy="11.5" r="2.5" />
      <circle cx="18.5" cy="11.5" r="2.5" />
      <circle cx="12" cy="11" r="6.5" />
      <ellipse cx="12" cy="14" rx="2.8" ry="2" />
      <circle cx="10.9" cy="13.8" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="13.1" cy="13.8" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10.2 16.5 Q12 17.6 13.8 16.5" />
    </svg>
  );
}
