type LogoMarkProps = {
  className?: string
  iconClassName?: string
}

export function LogoMark({ className = '', iconClassName = '' }: LogoMarkProps) {
  return (
    <div className={className.trim()}>
      <svg viewBox="0 0 17 17" fill="none" className={iconClassName.trim()}>
        <rect x="2" y="2" width="5" height="5" rx="1" fill="white" opacity="0.9" />
        <rect x="10" y="2" width="5" height="5" rx="1" fill="white" opacity="0.6" />
        <rect x="2" y="10" width="5" height="5" rx="1" fill="white" opacity="0.6" />
        <path
          d="M10 12.5h5M12.5 10v5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>
    </div>
  )
}
