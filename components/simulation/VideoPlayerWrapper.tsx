'use client'

import dynamic from 'next/dynamic'
import type { VideoPlayerProps } from '@/lib/types'

// Plyr accesses `document` at module evaluation time.
// `ssr: false` must live inside a Client Component — not a Server Component.
const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false })

export default function VideoPlayerWrapper({ src, className }: VideoPlayerProps) {
  return <VideoPlayer src={src} className={className} />
}
