'use client'

import { useEffect, useRef } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

type Props = {
  src: string | null
  className?: string
}

export default function VideoPlayer({ src, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current || !src) return

    const player = new Plyr(videoRef.current, {
      autoplay: false,
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
    })

    return () => {
      player.destroy()
    }
  }, [src])

  if (!src) return null

  return (
    <div className={className}>
      <video ref={videoRef} controls playsInline>
        <source src={src} type="video/mp4" />
      </video>
    </div>
  )
}
