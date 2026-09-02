export type LogoProps = {
  /** The square mark size in CSS pixels. */
  size?: number;
  className?: string;
  /** `true` uses the default BetterDemocracy wordmark; a string supplies a custom one. */
  wordmark?: boolean | string;
  /** Extra classes for the wordmark text (font, size, tracking). */
  wordmarkClassName?: string;
  title?: string;
};

export function Logo({
  size = 32,
  className = "",
  wordmark = false,
  wordmarkClassName = "font-serif text-lg",
  title = "BetterDemocracy logo",
}: LogoProps) {
  const wordmarkText = wordmark === true ? "BetterDemocracy" : wordmark || null;

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <svg
        role="img"
        aria-label={title}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        className="shrink-0"
      >
        <title>{title}</title>
        <path
          d="M3.75 10.5h16.5l1.25 10.75h-19L3.75 10.5Z"
          fill="currentColor"
          opacity=".12"
        />
        <path
          d="M3.75 10.5h4m8.5 0h4l1.25 10.75h-19L3.75 10.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="7.75"
          y="2.25"
          width="8.5"
          height="10.5"
          rx=".75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m10.15 7.15 1.35 1.3 2.7-2.8M7.25 15h9.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {wordmarkText ? (
        <span className={`truncate font-semibold ${wordmarkClassName}`}>{wordmarkText}</span>
      ) : null}
    </span>
  );
}
