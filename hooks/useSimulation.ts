"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StepResponse } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  uploadSimulationFile,
  validateSimulationFile,
  UploadValidationError,
} from "@/lib/storage/uploadSimulationFile";

const STORAGE_KEY = "sim-product-strategy"; // legacy key — kept for unauthenticated users

export interface EvidenceFile {
  name: string;
  size: number;
  filePath: string;
}

interface TaskEvidence {
  files: EvidenceFile[];
  urls: string[];
}

interface UseSimulationReturn {
  currentStep: number;
  responses: Record<number, StepResponse>;
  saveStatus: "idle" | "saving" | "saved";
  lastSaved: Date | null;
  evidenceByTask: Record<number, TaskEvidence>;
  evidenceUploading: boolean;
  evidenceUploadError: string | null;
  transcriptOpen: boolean;
  briefExpanded: boolean;
  muted: boolean;
  sessionId: string | null;
  userId: string | null;
  uploadingTaskId: number | null;
  fileUploadError: string | null;
  setTranscriptOpen: (open: boolean) => void;
  setBriefExpanded: (expanded: boolean) => void;
  setMuted: (muted: boolean) => void;
  updateResponse: (patch: Partial<StepResponse>) => void;
  handleFileSelect: (file: File, taskId: number) => Promise<void>;
  handleEvidenceFileSelect: (file: File, taskId: number) => Promise<void>;
  handleEvidenceFileRemove: (filePath: string, taskId: number) => Promise<void>;
  handleEvidenceUrlAdd: (url: string, taskId: number) => Promise<void>;
  handleEvidenceUrlRemove: (url: string, taskId: number) => Promise<void>;
  goNext: () => void;
  goPrev: () => void;
  saveToStorage: () => void;
  markSubmitted: () => Promise<void>;
  lastSavedText: () => string;
}

export function useSimulation(
  simulationSlug: string,
  discipline = "Product Management"
): UseSimulationReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<number, StepResponse>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [evidenceByTask, setEvidenceByTask] = useState<Record<number, TaskEvidence>>({});
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceUploadError, setEvidenceUploadError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  // Stable refs so async callbacks always see latest values without stale closures
  const userIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const responsesRef = useRef<Record<number, StepResponse>>({});
  const currentStepRef = useRef(0);
  const simulationSlugRef = useRef(simulationSlug);
  const disciplineRef = useRef(discipline);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents the DB-load from triggering an unnecessary auto-save on mount
  const userEditedRef = useRef(false);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { simulationSlugRef.current = simulationSlug; }, [simulationSlug]);
  useEffect(() => { disciplineRef.current = discipline; }, [discipline]);

  // ── INIT: load state on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        // Unauthenticated: restore from localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const data = JSON.parse(saved);
            if (typeof data.currentStep === "number") setCurrentStep(data.currentStep);
            if (data.responses) setResponses(data.responses);
          }
        } catch { /* ignore */ }
        return;
      }

      // Set userId via both state and ref so the ref is available immediately
      userIdRef.current = user.id;
      if (!cancelled) setUserId(user.id);

      // Find an existing in_progress session
      const { data: session } = await supabase
        .from("simulation_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_slug", simulationSlug)
        .eq("status", "in_progress")
        .maybeSingle();

      if (cancelled) return;

      if (session) {
        sessionIdRef.current = session.id;
        if (!cancelled) setSessionId(session.id);

        const [{ data: dbResponses }, { data: dbAttachments }] = await Promise.all([
          supabase
            .from("simulation_responses")
            .select("task_number, response_text, rationale_text, link_urls, file_urls")
            .eq("session_id", session.id)
            .order("task_number"),
          supabase
            .from("simulation_session_attachments")
            .select("task_id, type, file_path, url, original_filename, size_bytes, is_evidence")
            .eq("session_id", session.id),
        ]);

        if (cancelled) return;

        // Separate primary submission files from supporting evidence
        const fileByTask = new Map<number, { name: string; size: number; filePath: string }>();
        const evidenceMap: Record<number, TaskEvidence> = {};

        for (const att of dbAttachments ?? []) {
          if (att.is_evidence) {
            if (!evidenceMap[att.task_id]) evidenceMap[att.task_id] = { files: [], urls: [] };
            if (att.type === "file" && att.file_path && att.original_filename) {
              evidenceMap[att.task_id].files.push({
                name: att.original_filename,
                size: att.size_bytes ?? 0,
                filePath: att.file_path,
              });
            } else if (att.type === "url" && att.url) {
              evidenceMap[att.task_id].urls.push(att.url);
            }
          } else {
            if (att.type === "file" && att.file_path && att.original_filename) {
              fileByTask.set(att.task_id, {
                name: att.original_filename,
                size: att.size_bytes ?? 0,
                filePath: att.file_path,
              });
            }
          }
        }

        if (Object.keys(evidenceMap).length > 0) {
          setEvidenceByTask(evidenceMap);
        }

        if (dbResponses?.length) {
          const loaded: Record<number, StepResponse> = {};
          for (const r of dbResponses) {
            // task_number is 1-indexed; currentStep is 0-indexed
            loaded[r.task_number - 1] = {
              text: r.response_text ?? undefined,
              rationale: r.rationale_text ?? undefined,
              url: r.link_urls?.[0] ?? undefined,
              file: fileByTask.get(r.task_number) ?? null,
            };
          }
          responsesRef.current = loaded;
          setResponses(loaded);
        }
      }
      // No existing session — it will be created on first save
    }

    init().catch(console.error);
    return () => { cancelled = true; };
  }, [simulationSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPABASE SAVE ─────────────────────────────────────────────
  const saveToSupabase = useCallback(async (stepOverride?: number) => {
    const uid = userIdRef.current;
    const slug = simulationSlugRef.current;
    const disc = disciplineRef.current;
    const step = stepOverride ?? currentStepRef.current;
    const allResponses = responsesRef.current;

    if (!uid) return;

    setSaveStatus("saving");
    const supabase = createClient();

    try {
      let sid = sessionIdRef.current;

      // Create session on first save if it doesn't exist yet
      if (!sid) {
        const { data: newSession, error } = await supabase
          .from("simulation_sessions")
          .upsert(
            {
              user_id: uid,
              simulation_slug: slug,
              discipline: disc,
              status: "in_progress",
            },
            { onConflict: "user_id,simulation_slug" }
          )
          .select("id")
          .single();

        if (error) throw error;
        sid = newSession.id;
        sessionIdRef.current = sid;
        setSessionId(sid);
      }

      // Upsert the current step's response
      const stepResp = allResponses[step];
      if (stepResp && (stepResp.text || stepResp.url || stepResp.file || stepResp.rationale)) {
        const taskNumber = step + 1;
        const payload = {
          response_text: stepResp.text ?? null,
          rationale_text: stepResp.rationale ?? null,
          link_urls: stepResp.url ? [stepResp.url] : null,
          file_urls: stepResp.file?.filePath ? [stepResp.file.filePath] : null,
        };

        await supabase
          .from("simulation_responses")
          .upsert(
            {
              ...payload,
              session_id: sid,
              user_id: uid,
              task_number: taskNumber,
            },
            { onConflict: "session_id,task_number" }
          );
      }

      setLastSaved(new Date());
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
      return;
    }

    setTimeout(() => setSaveStatus("idle"), 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MARK SUBMITTED ────────────────────────────────────────────
  const markSubmitted = useCallback(async () => {
    const uid = userIdRef.current;
    const allResponses = responsesRef.current;

    if (!uid) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            currentStep: currentStepRef.current,
            responses: allResponses,
          })
        );
      } catch { /* ignore */ }
      return;
    }

    const supabase = createClient();
    let sid = sessionIdRef.current;

    if (!sid) {
      const { data: newSession } = await supabase
        .from("simulation_sessions")
        .upsert(
          {
            user_id: uid,
            simulation_slug: simulationSlugRef.current,
            discipline: disciplineRef.current,
            status: "in_progress",
          },
          { onConflict: "user_id,simulation_slug" }
        )
        .select("id")
        .single();

      if (!newSession) return;
      sid = newSession.id;
      sessionIdRef.current = sid;
      setSessionId(sid);
    }

    // Persist all responses with content
    for (const [stepStr, stepResp] of Object.entries(allResponses)) {
      if (!stepResp?.text && !stepResp?.url && !stepResp?.file && !stepResp?.rationale) continue;
      const taskNumber = parseInt(stepStr) + 1;
      const payload = {
        response_text: stepResp.text ?? null,
        rationale_text: stepResp.rationale ?? null,
        link_urls: stepResp.url ? [stepResp.url] : null,
        file_urls: stepResp.file?.filePath ? [stepResp.file.filePath] : null,
      };

      await supabase
        .from("simulation_responses")
        .upsert(
          {
            ...payload,
            session_id: sid,
            user_id: uid,
            task_number: taskNumber,
          },
          { onConflict: "session_id,task_number" }
        );

      // Persist ResponseForm URL to the attachments table (primary submission, not evidence)
      if (stepResp.url) {
        await supabase
          .from("simulation_session_attachments")
          .delete()
          .eq("session_id", sid)
          .eq("task_id", taskNumber)
          .eq("type", "url")
          .eq("is_evidence", false);

        await supabase.from("simulation_session_attachments").insert({
          session_id: sid,
          task_id: taskNumber,
          type: "url",
          url: stepResp.url,
          is_evidence: false,
        });
      }
    }

    await supabase
      .from("simulation_sessions")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", sid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── LOCALSTORAGE SAVE (unauthenticated fallback) ───────────────
  const saveToLocalStorage = useCallback(() => {
    setSaveStatus("saving");
    setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            currentStep: currentStepRef.current,
            responses: responsesRef.current,
          })
        );
        setLastSaved(new Date());
        setSaveStatus("saved");
      } catch { /* ignore */ }
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
  }, []);

  // ── PUBLIC saveToStorage ───────────────────────────────────────
  const saveToStorage = useCallback(() => {
    if (userIdRef.current) {
      void saveToSupabase();
    } else {
      saveToLocalStorage();
    }
  }, [saveToSupabase, saveToLocalStorage]);

  // ── DEBOUNCED AUTO-SAVE (authenticated, 500ms after typing stops) ──
  useEffect(() => {
    if (!userEditedRef.current || !userIdRef.current) return;

    // Capture the step NOW (at typing time), not when the timer fires —
    // otherwise navigating away before 500ms causes the wrong task to be saved.
    const capturedStep = currentStepRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveToSupabase(capturedStep);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [responses, saveToSupabase]);

  // ── 30-SECOND AUTO-SAVE INTERVAL (unauthenticated only) ───────
  useEffect(() => {
    if (userIdRef.current) return;
    const interval = setInterval(saveToLocalStorage, 30000);
    return () => clearInterval(interval);
  }, [saveToLocalStorage]);

  // ── RESPONSE MANAGEMENT ────────────────────────────────────────
  const updateResponse = useCallback(
    (patch: Partial<StepResponse>) => {
      userEditedRef.current = true;
      setResponses((prev) => ({
        ...prev,
        [currentStep]: { ...prev[currentStep], ...patch },
      }));
    },
    [currentStep]
  );

  // ── PRIMARY SUBMISSION FILE UPLOAD (ResponseForm) ──────────────
  const handleFileSelect = useCallback(async (file: File, taskId: number) => {
    setFileUploadError(null);

    try {
      validateSimulationFile(file);
    } catch (err) {
      setFileUploadError(err instanceof UploadValidationError ? err.message : "Invalid file.");
      return;
    }

    const uid = userIdRef.current;
    let sid = sessionIdRef.current;

    const stepIndex = taskId - 1;
    setResponses((prev) => ({
      ...prev,
      [stepIndex]: { ...prev[stepIndex], file: { name: file.name, size: file.size } },
    }));

    setUploadingTaskId(taskId);

    try {
      if (!sid && uid) {
        const supabase = createClient();
        const { data: newSession, error } = await supabase
          .from("simulation_sessions")
          .upsert(
            {
              user_id: uid,
              simulation_slug: simulationSlugRef.current,
              discipline: disciplineRef.current,
              status: "in_progress",
            },
            { onConflict: "user_id,simulation_slug" }
          )
          .select("id")
          .single();
        if (error) throw error;
        sid = newSession.id;
        sessionIdRef.current = sid;
        setSessionId(sid);
      }

      if (!uid || !sid) return;

      const filePath = await uploadSimulationFile(file, uid, sid, taskId);

      userEditedRef.current = true;
      setResponses((prev) => ({
        ...prev,
        [stepIndex]: {
          ...prev[stepIndex],
          file: { name: file.name, size: file.size, filePath },
        },
      }));

      // Replace the primary submission file record (DELETE + INSERT to avoid upsert on partial index)
      const supabase = createClient();
      await supabase
        .from("simulation_session_attachments")
        .delete()
        .eq("session_id", sid)
        .eq("task_id", taskId)
        .eq("type", "file")
        .eq("is_evidence", false);

      await supabase.from("simulation_session_attachments").insert({
        session_id: sid,
        task_id: taskId,
        type: "file",
        file_path: filePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        is_evidence: false,
      });
    } catch (err) {
      setFileUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setResponses((prev) => ({
        ...prev,
        [stepIndex]: { ...prev[stepIndex], file: null },
      }));
    } finally {
      setUploadingTaskId(null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPPORTING EVIDENCE: file upload ──────────────────────────
  const handleEvidenceFileSelect = useCallback(async (file: File, taskId: number) => {
    setEvidenceUploadError(null);

    try {
      validateSimulationFile(file);
    } catch (err) {
      setEvidenceUploadError(err instanceof UploadValidationError ? err.message : "Invalid file.");
      return;
    }

    const uid = userIdRef.current;
    let sid = sessionIdRef.current;

    setEvidenceUploading(true);

    try {
      if (!sid && uid) {
        const supabase = createClient();
        const { data: newSession, error } = await supabase
          .from("simulation_sessions")
          .upsert(
            {
              user_id: uid,
              simulation_slug: simulationSlugRef.current,
              discipline: disciplineRef.current,
              status: "in_progress",
            },
            { onConflict: "user_id,simulation_slug" }
          )
          .select("id")
          .single();
        if (error) throw error;
        sid = newSession.id;
        sessionIdRef.current = sid;
        setSessionId(sid);
      }

      if (!uid || !sid) {
        // Unauthenticated: just update local state with a fake path
        setEvidenceByTask((prev) => ({
          ...prev,
          [taskId]: {
            files: [...(prev[taskId]?.files ?? []), { name: file.name, size: file.size, filePath: "" }],
            urls: prev[taskId]?.urls ?? [],
          },
        }));
        return;
      }

      // Upload to the simulation-submissions bucket under an evidence sub-path
      const filePath = await uploadSimulationFile(file, uid, sid, taskId);

      const supabase = createClient();
      await supabase.from("simulation_session_attachments").insert({
        session_id: sid,
        task_id: taskId,
        type: "file",
        file_path: filePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        is_evidence: true,
      });

      setEvidenceByTask((prev) => ({
        ...prev,
        [taskId]: {
          files: [...(prev[taskId]?.files ?? []), { name: file.name, size: file.size, filePath }],
          urls: prev[taskId]?.urls ?? [],
        },
      }));
    } catch (err) {
      setEvidenceUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setEvidenceUploading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPPORTING EVIDENCE: remove file ──────────────────────────
  const handleEvidenceFileRemove = useCallback(async (filePath: string, taskId: number) => {
    const sid = sessionIdRef.current;
    const uid = userIdRef.current;

    if (sid) {
      const supabase = createClient();
      await Promise.all([
        supabase
          .from("simulation_session_attachments")
          .delete()
          .eq("session_id", sid)
          .eq("task_id", taskId)
          .eq("file_path", filePath)
          .eq("is_evidence", true),
        uid && filePath
          ? supabase.storage.from("simulation-submissions").remove([filePath])
          : Promise.resolve(),
      ]);
    }

    setEvidenceByTask((prev) => ({
      ...prev,
      [taskId]: {
        files: (prev[taskId]?.files ?? []).filter((f) => f.filePath !== filePath),
        urls: prev[taskId]?.urls ?? [],
      },
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPPORTING EVIDENCE: add URL ──────────────────────────────
  const handleEvidenceUrlAdd = useCallback(async (url: string, taskId: number) => {
    const uid = userIdRef.current;
    let sid = sessionIdRef.current;

    if (uid) {
      if (!sid) {
        const supabase = createClient();
        const { data: newSession, error } = await supabase
          .from("simulation_sessions")
          .upsert(
            {
              user_id: uid,
              simulation_slug: simulationSlugRef.current,
              discipline: disciplineRef.current,
              status: "in_progress",
            },
            { onConflict: "user_id,simulation_slug" }
          )
          .select("id")
          .single();
        if (!error && newSession) {
          sid = newSession.id;
          sessionIdRef.current = sid;
          setSessionId(sid);
        }
      }

      if (sid) {
        const supabase = createClient();
        await supabase.from("simulation_session_attachments").insert({
          session_id: sid,
          task_id: taskId,
          type: "url",
          url,
          is_evidence: true,
        });
      }
    }

    setEvidenceByTask((prev) => ({
      ...prev,
      [taskId]: {
        files: prev[taskId]?.files ?? [],
        urls: [...(prev[taskId]?.urls ?? []), url],
      },
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPPORTING EVIDENCE: remove URL ───────────────────────────
  const handleEvidenceUrlRemove = useCallback(async (url: string, taskId: number) => {
    const sid = sessionIdRef.current;

    if (sid) {
      const supabase = createClient();
      await supabase
        .from("simulation_session_attachments")
        .delete()
        .eq("session_id", sid)
        .eq("task_id", taskId)
        .eq("type", "url")
        .eq("url", url)
        .eq("is_evidence", true);
    }

    setEvidenceByTask((prev) => ({
      ...prev,
      [taskId]: {
        files: prev[taskId]?.files ?? [],
        urls: (prev[taskId]?.urls ?? []).filter((u) => u !== url),
      },
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function goNext() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveToStorage();
    if (currentStep < 4) setCurrentStep((s) => s + 1);
  }

  function goPrev() {
    if (currentStep > 0) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      saveToStorage();
      setCurrentStep((s) => s - 1);
    }
  }

  function lastSavedText(): string {
    if (!lastSaved) return "Not yet saved";
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 120) return "1 min ago";
    return `${Math.floor(diff / 60)} mins ago`;
  }

  return {
    currentStep,
    responses,
    saveStatus,
    lastSaved,
    evidenceByTask,
    evidenceUploading,
    evidenceUploadError,
    transcriptOpen,
    briefExpanded,
    muted,
    sessionId,
    userId,
    uploadingTaskId,
    fileUploadError,
    setTranscriptOpen,
    setBriefExpanded,
    setMuted,
    updateResponse,
    handleFileSelect,
    handleEvidenceFileSelect,
    handleEvidenceFileRemove,
    handleEvidenceUrlAdd,
    handleEvidenceUrlRemove,
    goNext,
    goPrev,
    saveToStorage,
    markSubmitted,
    lastSavedText,
  };
}
