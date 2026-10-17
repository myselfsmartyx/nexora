import { useId } from 'react'

// Nexora brand mark (ribbon N + orbit + star). Inline SVG: no network request, crisp at any size.
// variant="tile"  → mark on the navy app-icon tile. Looks identical in dark and light mode.
// variant="mark"  → bare mark on a transparent background (star adapts to the theme).
const BODY = (id) => (
  <>
    <defs>
      <linearGradient id={`${id}rib`} x1="400" y1="380" x2="880" y2="860" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#52D6F4" /><stop offset=".38" stopColor="#3B82F6" /><stop offset=".72" stopColor="#7C5CF5" /><stop offset="1" stopColor="#C084FC" />
      </linearGradient>
      <linearGradient id={`${id}front`} x1="390" y1="440" x2="510" y2="640" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#3FA2FF" /><stop offset="1" stopColor="#2D6BF0" />
      </linearGradient>
      <linearGradient id={`${id}tri`} x1="390" y1="640" x2="440" y2="860" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#2E6EF2" /><stop offset="1" stopColor="#45D0F7" />
      </linearGradient>
      <linearGradient id={`${id}right`} x1="790" y1="458" x2="790" y2="815" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#C770F7" /><stop offset=".5" stopColor="#6B3FE0" /><stop offset="1" stopColor="#33229E" />
      </linearGradient>
      <linearGradient id={`${id}ol`} x1="262" y1="640" x2="500" y2="800" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#4FD2F6" />
      </linearGradient>
      <linearGradient id={`${id}or`} x1="930" y1="410" x2="850" y2="660" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#C084FC" /><stop offset="1" stopColor="#4F6CF5" />
      </linearGradient>
      <linearGradient id={`${id}pl`} x1="835" y1="345" x2="900" y2="420" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#6CCBF5" /><stop offset="1" stopColor="#8B5CF6" />
      </linearGradient>
      <radialGradient id={`${id}halo`} cx="600" cy="630" r="95" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#7FB4FF" stopOpacity=".75" /><stop offset=".45" stopColor="#3B6BF5" stopOpacity=".3" /><stop offset="1" stopColor="#3B6BF5" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path d="M392 598C320 640 262 700 262 745C262 795 320 822 392 818L392 805C330 806 292 785 292 745C292 705 335 650 392 615Z" fill={`url(#${id}ol)`} />
    <path d="M392 818C440 818 480 805 506 790L499 785C470 799 430 806 392 806Z" fill="#2F5FE0" />
    <path d="M660 440C700 415 750 398 795 388L798 401C755 411 710 426 668 446Z" fill="#3F7BF3" />
    <path d="M925 406C985 425 1005 480 995 520C975 590 920 625 850 665L850 640C915 600 960 550 968 505C975 455 955 425 925 406Z" fill={`url(#${id}or)`} />
    <circle className="nx-planet" cx="865" cy="380" r="48" fill={`url(#${id}pl)`} />
    <path d="M845 458L845 812L735 812L735 640C735 565 780 492 845 458Z" fill={`url(#${id}right)`} />
    <path d="M390 600L482 735L390 860Z" fill={`url(#${id}tri)`} />
    <path fillRule="evenodd" fill={`url(#${id}rib)`} d="M390 500C390 425 455 368 535 368C575 368 603 388 630 414L862 672C895 708 890 770 850 828C812 880 760 910 712 908C662 905 625 880 596 848L400 640C393 632 390 622 390 604ZM510 462L845 800C851 810 850 822 840 830C812 850 740 852 690 830L525 658C515 648 510 646 510 636Z" />
    <path d="M390 640L390 495C390 455 412 432 442 432C472 432 496 448 510 462L510 640L510 652L390 636Z" fill={`url(#${id}front)`} />
    <circle className="nx-halo" cx="600" cy="630" r="95" fill={`url(#${id}halo)`} />
    <path className="nx-star" d="M600 562C604 600 620 622 672 630C620 638 604 660 600 700C596 660 580 638 528 630C580 622 596 600 600 562Z" style={{ fill: 'var(--nx-star, #fff)' }} />
  </>
)

export default function Logo({ size = 40, variant = 'tile', animated = false, className = '', title = 'Nexora' }) {
  const id = 'nx' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const tile = variant === 'tile'
  return (
    <svg
      width={size}
      height={size}
      viewBox={tile ? '0 0 1024 1024' : '236 232 790 790'}
      role="img"
      aria-label={title}
      className={`nx-logo ${animated ? 'nx-logo-anim' : ''} ${tile ? '' : 'nx-logo-bare'} ${className}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {tile && (
        <>
          <defs>
            <radialGradient id={`${id}bg`} cx="50%" cy="46%" r="70%">
              <stop offset="0" stopColor="#0E1D6B" /><stop offset=".6" stopColor="#08103F" /><stop offset="1" stopColor="#04061C" />
            </radialGradient>
          </defs>
          <rect width="1024" height="1024" rx="230" fill={`url(#${id}bg)`} />
        </>
      )}
      {tile ? <g transform="translate(512 512) scale(1.12) translate(-631 -622)">{BODY(id)}</g> : BODY(id)}
    </svg>
  )
}

// Full-screen loading screen. Uses only transform/opacity animations (GPU-friendly, no layout work).
export function LogoLoader({ size = 96, label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-bg" role="status" aria-live="polite" aria-label={label || 'Loading Nexora'}>
      <Logo size={size} animated />
      {label && <p className="text-body-small text-ink-secondary mt-md">{label}</p>}
    </div>
  )
}
