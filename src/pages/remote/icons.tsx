// リモコン画面のアイコン(Phosphor 相当を最小限のインライン SVG で再現)
type IconProps = { className?: string }
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const IconPlus = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconCaretDoubleRight = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps} strokeWidth={2.4}>
    <path d="M5 5l7 7-7 7M13 5l7 7-7 7" />
  </svg>
)
export const IconUserMinus = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <circle cx="10" cy="8" r="4" />
    <path d="M2.5 20c1.4-3.3 4.2-5 7.5-5s6.1 1.7 7.5 5" />
    <path d="M17 11h6" />
  </svg>
)
export const IconRewind = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M11 5v14l-9-7zM22 5v14l-9-7z" />
  </svg>
)
export const IconFastForward = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M13 5v14l9-7zM2 5v14l9-7z" />
  </svg>
)
export const IconPlay = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M7 4v16l13-8z" />
  </svg>
)
export const IconPause = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
)
export const IconSliders = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <path d="M3 7h10M17.5 7H21M3 17h4M11.5 17H21" />
    <circle cx="15" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </svg>
)
export const IconHistory = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
    <path d="M3.5 3.5v5h5" />
    <path d="M12 7.5V12l3.5 2" />
  </svg>
)
export const IconCheckSquare = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 12.5l3 3 5.5-6.5" />
  </svg>
)
export const IconFlag = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <path d="M5 21V4" />
    <path d="M5 4c4.5-2.2 9 2.2 14 0v10c-5 2.2-9.5-2.2-14 0" />
  </svg>
)
export const IconRows = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <rect x="3.5" y="4.5" width="17" height="6" rx="1.5" />
    <rect x="3.5" y="13.5" width="17" height="6" rx="1.5" />
  </svg>
)
