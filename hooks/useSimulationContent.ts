"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Prompt } from "@/types";

interface SimMeta {
  title: string;
  company: string;
  industry: string;
  role: string;
}

interface UseSimulationContentReturn {
  loading: boolean;
  notFound: boolean;
  sim: SimMeta | null;
  briefShort: string;
  briefFull: string;
  transcript: string;
  prompts: Prompt[];
  timeRemaining: number[];
  discipline: string | null;
  status: string | null;
  videoUrl: string | null;
  simulationUuid: string | null;
  simulationType: string | null;
}

export function useSimulationContent(slug: string): UseSimulationContentReturn {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sim, setSim] = useState<SimMeta | null>(null);
  const [briefShort, setBriefShort] = useState("");
  const [briefFull, setBriefFull] = useState("");
  const [transcript, setTranscript] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number[]>([]);
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [simulationUuid, setSimulationUuid] = useState<string | null>(null);
  const [simulationType, setSimulationType] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    async function load() {
      const supabase = createClient();

      const { data: simRow, error: simError } = await supabase
        .from("simulations")
        .select(
          "id, slug, title, company, industry, sim_role, brief_short, brief_full, video_transcript, video_url, discipline, difficulty, time, status, simulation_type"
        )
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (cancelled) return;

      if (simError || !simRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: promptRows } = await supabase
        .from("simulation_prompts")
        .select(
          "id, display_order, type, title, question, min_words, time_remaining_minutes, guidance"
        )
        .eq("simulation_id", simRow.id)
        .order("display_order", { ascending: true });

      if (cancelled) return;

      const rows = promptRows ?? [];

      const mappedPrompts: Prompt[] = rows.map((row) => ({
        id: row.display_order,
        type: row.type as Prompt["type"],
        title: row.title,
        question: row.question,
        guidance: row.guidance ?? [],
        minWords: row.min_words,
      }));

      const mappedTimeRemaining: number[] = rows.map(
        (row) => row.time_remaining_minutes
      );

      setSim({
        title: simRow.title,
        company: simRow.company,
        industry: simRow.industry,
        role: simRow.sim_role,
      });
      setBriefShort(simRow.brief_short ?? "");
      setBriefFull(simRow.brief_full ?? "");
      setTranscript(simRow.video_transcript ?? "");
      setPrompts(mappedPrompts);
      setTimeRemaining(mappedTimeRemaining);
      setDiscipline(simRow.discipline ?? null);
      setStatus(simRow.status ?? null);
      setVideoUrl(simRow.video_url ?? null);
      setSimulationUuid(simRow.id ?? null);
      setSimulationType((simRow as { simulation_type?: string }).simulation_type ?? null);
      setLoading(false);
    }

    load().catch(() => {
      if (cancelled) return;
      setNotFound(true);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return {
    loading,
    notFound,
    sim,
    briefShort,
    briefFull,
    transcript,
    prompts,
    timeRemaining,
    discipline,
    status,
    videoUrl,
    simulationUuid,
    simulationType,
  };
}
