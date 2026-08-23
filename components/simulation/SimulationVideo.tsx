"use client";

import MuxPlayer from "@mux/mux-player-react/lazy";

interface SimulationVideoProps {
  /** simulations.video_provider — "mux" plays the Mux-hosted briefing */
  videoProvider: string | null;
  /** simulations.video_id — the Mux playback ID when videoProvider is "mux" */
  videoId: string | null;
  /** simulations.video_url — direct file URL, used when there is no Mux video */
  videoUrl: string | null;
  muted: boolean;
  company?: string;
  title?: string;
}

export function SimulationVideo({
  videoProvider,
  videoId,
  videoUrl,
  muted,
  company,
  title,
}: SimulationVideoProps) {
  if (videoProvider === "mux" && videoId) {
    return (
      <MuxPlayer
        playbackId={videoId}
        streamType="on-demand"
        /* --color-teal is declared on :root in app/globals.css and inherits into the player */
        accentColor="var(--color-teal)"
        muted={muted}
        metadata={{ video_title: title }}
        className="w-full aspect-video bg-[#001a2e]"
      />
    );
  }

  if (videoUrl) {
    return (
      <video
        controls
        muted={muted}
        className="w-full bg-[#001a2e] aspect-video"
        src={videoUrl}
      />
    );
  }

  /* Placeholder shown when the simulation has no video set */
  return (
    <div className="relative w-full flex items-center justify-center bg-[#001a2e] aspect-video">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-white/[0.08] border-2 border-white/20">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
        <p className="text-sm text-white/60">Video briefing · {company}</p>
      </div>
    </div>
  );
}
