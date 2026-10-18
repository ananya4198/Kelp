export default function KelpLogo({ className = '', size = 32 }) {
  return (
    <div className={`flex select-none items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="Kelp logo">
        <defs>
          <linearGradient id="kelp-grad" x1="0" y1="48" x2="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0d9488" />
            <stop offset="1" stopColor="#5eead4" />
          </linearGradient>
        </defs>

        {/* three kelp strands */}
        <path
          d="M24 46 C16 38 32 30 24 22 C16 14 30 8 24 2"
          stroke="url(#kelp-grad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M14 46 C9 40 19 34 13 27 C9 22 14 18 12 12"
          stroke="url(#kelp-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M34 46 C39 40 29 35 35 28 C39 23 34 19 37 14"
          stroke="url(#kelp-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* leaves */}
        <ellipse cx="29" cy="31" rx="5" ry="2.2" transform="rotate(-30 29 31)" fill="url(#kelp-grad)" />
        <ellipse cx="19" cy="21" rx="5" ry="2.2" transform="rotate(30 19 21)" fill="url(#kelp-grad)" />
        <ellipse cx="28" cy="12" rx="4.5" ry="2" transform="rotate(-30 28 12)" fill="url(#kelp-grad)" />
      </svg>
      <span className="text-xl font-bold tracking-tight text-white">Kelp</span>
    </div>
  )
}