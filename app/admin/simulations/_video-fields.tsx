'use client'

import React, { useState } from 'react'
import { Input, Label } from '@/components/ui'
import { cn } from '@/lib/cn'

export type VideoProvider = 'mux' | 'native' | null

// Stored values must match the DB check constraint on simulations.video_provider.
const PROVIDER_OPTIONS: { label: string; value: '' | 'mux' | 'native' }[] = [
  { label: 'None', value: '' },
  { label: 'Mux', value: 'mux' },
  { label: 'Self-hosted URL', value: 'native' },
]

// Shared by the metadata editor and the new-simulation form. The thumbnail is
// the validation: a correct public playback ID renders a frame; an asset ID,
// a typo or a signed-playback asset renders nothing.
export function VideoProviderFields({
  provider,
  videoId,
  onProviderChange,
  videoIdInputProps,
  error,
}: {
  provider: VideoProvider | undefined
  videoId: string | null | undefined
  onProviderChange: (value: VideoProvider) => void
  videoIdInputProps: React.InputHTMLAttributes<HTMLInputElement>
  error?: string
}) {
  const trimmedId = (videoId ?? '').trim()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="video_provider">Video provider</Label>
        <select
          id="video_provider"
          value={provider ?? ''}
          onChange={e => onProviderChange((e.target.value || null) as VideoProvider)}
          className={cn(
            'bg-white text-[#003359] rounded-md px-3 py-2 border border-slate-300 text-sm',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-white'
          )}
        >
          {PROVIDER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {provider === 'native' && (
          <p className="text-[#003359]/60 text-xs">Plays the Video URL field.</p>
        )}
      </div>

      {provider === 'mux' && (
        <div className="flex flex-col gap-2">
          <Input
            id="video_id"
            label="Playback ID"
            placeholder="Paste the Playback ID from the Mux asset page"
            autoComplete="off"
            spellCheck={false}
            error={error}
            {...videoIdInputProps}
          />
          <MuxThumbnail playbackId={trimmedId} />
        </div>
      )}
    </div>
  )
}

function MuxThumbnail({ playbackId }: { playbackId: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="w-full max-w-xs aspect-video rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
        {playbackId ? (
          // key forces a fresh <img> per ID so a previous failure doesn't stick
          <ThumbnailImage key={playbackId} playbackId={playbackId} />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Thumbnail appears here
          </div>
        )}
      </div>
      <p className="text-[#003359]/60 text-xs">
        A frame of the video should appear above. If it doesn&apos;t, the ID is wrong. Check you
        copied the Playback ID, not the Asset ID.
      </p>
    </div>
  )
}

function ThumbnailImage({ playbackId }: { playbackId: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="h-full flex items-center justify-center px-3 text-center text-xs text-red-600">
        No frame found for this ID
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.png`}
      alt="Mux video thumbnail"
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}
