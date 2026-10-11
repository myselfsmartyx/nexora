import { useEffect, useState } from 'react'

// "Now", kept fresh: it refreshes just after local midnight and whenever the tab
// becomes visible again, so a page left open overnight never shows yesterday's dates.
export function useToday() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer
    const arm = () => {
      const d = new Date()
      const next = new Date(d)
      next.setHours(24, 0, 5, 0)
      timer = setTimeout(() => { setNow(Date.now()); arm() }, next.getTime() - d.getTime())
    }
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    arm()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return now
}
