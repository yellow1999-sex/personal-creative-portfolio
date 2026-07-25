import { useEffect, useRef } from 'react'

export function BackgroundVideo({
  className,
  desktopSrc,
  mobileSrc,
  poster,
}: {
  className: string
  desktopSrc: string
  mobileSrc: string
  poster?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const syncPlayback = () => {
      if (document.hidden || reducedMotion.matches) {
        video.pause()
        return
      }
      void video.play().catch(() => {})
    }

    syncPlayback()
    document.addEventListener('visibilitychange', syncPlayback)
    reducedMotion.addEventListener('change', syncPlayback)
    return () => {
      document.removeEventListener('visibilitychange', syncPlayback)
      reducedMotion.removeEventListener('change', syncPlayback)
      video.pause()
    }
  }, [])

  return (
    <div className={className} aria-hidden="true">
      <video ref={videoRef} poster={poster} autoPlay muted loop playsInline preload="metadata">
        <source media="(max-width: 760px)" src={mobileSrc} type="video/mp4" />
        <source src={desktopSrc} type="video/mp4" />
      </video>
    </div>
  )
}
