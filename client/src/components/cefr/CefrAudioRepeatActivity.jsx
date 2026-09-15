import { useEffect, useRef, useState } from "react";

import {
  isCefrAudioAssetReady,
  resolveCefrAudioAssetUrl,
} from "@/utils/cefrMedia";

const STEPS = {
  LISTEN: "listen",
  REPEAT: "repeat",
  RECORD: "record",
  COMPARE: "compare",
};

export default function CefrAudioRepeatActivity({
  item,
  activityTitle = "Say It",
  assetStatus = "PLACEHOLDER",
  result = null,
  submitting = false,
  onSubmit,
}) {
  const audioAssetKey = item?.payload?.audioAssetKey || "";
  const modelText = item?.payload?.modelText || "";
  const personalization = item?.payload?.personalization || "";

  const assetReady =
    assetStatus === "READY" ||
    isCefrAudioAssetReady(audioAssetKey);

  const audioUrl = assetReady
    ? resolveCefrAudioAssetUrl(audioAssetKey)
    : null;

  const completed =
    result?.evaluationCode === "SELF_ATTESTED_COMPLETE";

  const audioReady = Boolean(audioUrl);

  const [voiceStep, setVoiceStep] = useState(STEPS.LISTEN);
  const [hasListened, setHasListened] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [micError, setMicError] = useState("");

  const modelAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordedAudioUrlRef = useRef("");

  function cleanupRecordingStream() {
    try {
      const stream = recordingStreamRef.current;

      if (stream && typeof stream.getTracks === "function") {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      }
    } catch {}

    recordingStreamRef.current = null;
  }

  function revokeRecordingUrl() {
    const url = recordedAudioUrlRef.current;

    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }

    recordedAudioUrlRef.current = "";
  }

  function stopActiveRecorder() {
    try {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch {}

    cleanupRecordingStream();
  }

  function resetVoicePractice() {
    stopActiveRecorder();
    revokeRecordingUrl();

    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];

    setIsRecording(false);
    setRecordedAudioUrl("");
    setMicError("");
    setHasListened(false);
    setVoiceStep(STEPS.LISTEN);

    try {
      if (modelAudioRef.current) {
        modelAudioRef.current.pause();
        modelAudioRef.current.currentTime = 0;
      }
    } catch {}
  }

  useEffect(() => {
    resetVoicePractice();

    return () => {
      stopActiveRecorder();
      revokeRecordingUrl();
    };
    // Reset the local practice state whenever the learner moves to a new item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  async function playModelAudio() {
    if (!audioReady || !modelAudioRef.current) return;

    try {
      setMicError("");

      modelAudioRef.current.currentTime = 0;
      await modelAudioRef.current.play();

      setHasListened(true);

      if (voiceStep === STEPS.LISTEN) {
        setVoiceStep(STEPS.REPEAT);
      }
    } catch {
      setMicError(
        "Could not play the model audio. Please try again.",
      );
    }
  }

  function handleRepeatDone() {
    if (!hasListened) return;

    setVoiceStep(STEPS.RECORD);
  }

  async function startVoiceRecording() {
    try {
      setMicError("");

      if (!navigator?.mediaDevices?.getUserMedia) {
        setMicError(
          "Microphone recording is not supported in this browser.",
        );
        return;
      }

      try {
        modelAudioRef.current?.pause();
      } catch {}

      revokeRecordingUrl();
      setRecordedAudioUrl("");
      recordingChunksRef.current = [];

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      recordingStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        try {
          const mimeType =
            recorder.mimeType ||
            recordingChunksRef.current[0]?.type ||
            "audio/webm";

          const blob = new Blob(
            recordingChunksRef.current,
            { type: mimeType },
          );

          const url = URL.createObjectURL(blob);

          recordedAudioUrlRef.current = url;
          setRecordedAudioUrl(url);
          setVoiceStep(STEPS.COMPARE);
        } catch {
          setMicError(
            "Could not prepare your recording. Please try again.",
          );
        } finally {
          cleanupRecordingStream();
          setIsRecording(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error(
        "[CefrAudioRepeat] microphone error",
        error,
      );

      cleanupRecordingStream();
      setIsRecording(false);

      if (
        error?.name === "NotAllowedError" ||
        error?.name === "PermissionDeniedError"
      ) {
        setMicError(
          "Microphone permission was denied. Please allow microphone access and try again.",
        );
      } else {
        setMicError(
          "Could not start recording. Please check your microphone and try again.",
        );
      }
    }
  }

  function stopVoiceRecording() {
    try {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch {
      setIsRecording(false);
      cleanupRecordingStream();
    }
  }

  function playMyRecording() {
    if (!recordedAudioUrl) return;

    try {
      const audio = new Audio(recordedAudioUrl);

      audio.play().catch(() => {
        setMicError(
          "Could not play your recording. Please try again.",
        );
      });
    } catch {
      setMicError(
        "Could not play your recording. Please try again.",
      );
    }
  }

  function tryRecordingAgain() {
    revokeRecordingUrl();
    setRecordedAudioUrl("");
    setMicError("");
    setVoiceStep(STEPS.RECORD);
  }

  return (
    <div className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
        {activityTitle}
      </p>

      <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
        {item?.prompt?.text || "Listen and repeat aloud."}
      </h2>

      {modelText && (
        <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-center">
          <p className="text-xl font-black text-indigo-950 sm:text-2xl">
            {modelText}
          </p>
        </div>
      )}

      {personalization && (
        <p className="mt-3 text-center text-sm font-semibold text-slate-500">
          {personalization}
        </p>
      )}

      {!audioReady ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-7 text-center">
          <div className="text-3xl">🎙️</div>

          <p className="mt-2 font-black text-slate-800">
            Audio is being prepared
          </p>

          <p className="mt-1 text-sm font-medium text-slate-500">
            This speaking practice will be available when its audio is ready.
          </p>
        </div>
      ) : (
        <>
          <audio
            ref={modelAudioRef}
            src={audioUrl}
            preload="metadata"
          />

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-black text-slate-800">
              Listen → Repeat → Record → Compare
            </div>

            <p className="mt-1 text-xs font-medium text-slate-500">
              Goal: say the sentence clearly and confidently.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                className={`rounded-3xl border p-5 shadow-sm transition ${
                  voiceStep === STEPS.LISTEN
                    ? "border-slate-900 bg-white"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Step 1
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Listen
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Listen to the model voice.
                </p>

                <button
                  type="button"
                  disabled={completed}
                  onClick={playModelAudio}
                  className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ▶ Listen
                </button>
              </div>

              <div
                className={`rounded-3xl border p-5 shadow-sm transition ${
                  voiceStep === STEPS.REPEAT
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Step 2
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Repeat
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Repeat the sentence aloud.
                </p>

                <button
                  type="button"
                  disabled={
                    completed ||
                    !hasListened ||
                    voiceStep === STEPS.LISTEN
                  }
                  onClick={handleRepeatDone}
                  className="mt-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-black text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  I Repeated It ✅
                </button>
              </div>

              <div
                className={`rounded-3xl border p-5 shadow-sm transition ${
                  voiceStep === STEPS.RECORD
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Step 3
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Record
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Record your voice clearly.
                </p>

                {!isRecording ? (
                  <button
                    type="button"
                    disabled={
                      completed ||
                      voiceStep !== STEPS.RECORD
                    }
                    onClick={startVoiceRecording}
                    className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    🎙 Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-3 font-black text-white"
                  >
                    ■ Stop Recording
                  </button>
                )}
              </div>

              <div
                className={`rounded-3xl border p-5 shadow-sm transition ${
                  voiceStep === STEPS.COMPARE
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Step 4
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Compare
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Compare your voice with the model.
                </p>

                <button
                  type="button"
                  disabled={!recordedAudioUrl}
                  onClick={playMyRecording}
                  className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ▶ My Voice
                </button>
              </div>
            </div>

            {micError && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                {micError}
              </div>
            )}

            {recordedAudioUrl && !completed && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-black text-emerald-900">
                  Recording ready ✅
                </p>

                <p className="mt-1 text-sm text-emerald-800">
                  Listen to both versions and try again if needed.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={playModelAudio}
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                  >
                    ▶ Model
                  </button>

                  <button
                    type="button"
                    onClick={playMyRecording}
                    className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                  >
                    ▶ My Voice
                  </button>

                  <button
                    type="button"
                    onClick={tryRecordingAgain}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                  >
                    🔁 Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {completed && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="font-extrabold text-emerald-800">
            Speaking practice recorded ✓
          </p>
        </div>
      )}

      {audioReady &&
        voiceStep === STEPS.COMPARE &&
        recordedAudioUrl &&
        !completed && (
          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              onSubmit?.({
                completed: true,
              })
            }
            className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting
              ? "Saving..."
              : "I spoke it well ✅"}
          </button>
        )}
    </div>
  );
}
