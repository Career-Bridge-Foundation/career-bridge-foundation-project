'use client'

import dynamic from 'next/dynamic'

// Plyr accesses `document` at module evaluation time.
// `ssr: false` must live inside a Client Component — not a Server Component.
const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false })

type Props = {
  src: string | null
  className?: string
}

export default function VideoPlayerWrapper({ src, className }: Props) {
  return <VideoPlayer src={src} className={className} />
}
