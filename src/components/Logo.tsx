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
        <path d="M12 2.75 2.75 8.75h18.5L12 2.75Z" fill="currentColor" opacity=".12" />
        <path
          d="M12 2.75 2.75 8.75h18.5L12 2.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.25 8.75v2.75h15.5V8.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.75 11.5v6.75M9.917 11.5v6.75M14.083 11.5v6.75M18.25 11.5v6.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M4.25 18.25h15.5M2.75 21.25h18.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {wordmarkText ? (
        <span className={`truncate font-semibold ${wordmarkClassName}`}>{wordmarkText}</span>
      ) : null}
    </span>
  );
}
