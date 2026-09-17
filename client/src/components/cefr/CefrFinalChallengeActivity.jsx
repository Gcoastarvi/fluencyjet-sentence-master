import { useEffect, useMemo, useRef, useState } from "react";

function normalizeCues(payload) {
  const rawCues = Array.isArray(payload?.cues)
    ? payload.cues
    : [];

  const answerStarters = Array.isArray(payload?.answerStarters)
    ? payload.answerStarters
    : [];

  return rawCues.map((cue, index) => {
    if (
      cue &&
      typeof cue === "object" &&
      !Array.isArray(cue)
    ) {
      return {
        key: cue.key || `cue-${index + 1}`,
        label:
          cue.label ||
          cue.title ||
          `Cue ${index + 1}`,
        answerStarter:
          cue.answerStarter || "",
        optional: cue.optional === true,
      };
    }

    return {
      key: `cue-${index + 1}`,
      label: String(cue || `Cue ${index + 1}`),
      answerStarter:
        typeof answerStarters[index] === "string"
          ? answerStarters[index]
          : "",
      optional: false,
    };
  });
}

export default function CefrFinalChallengeActivity({
  item,
  activityTitle = "Your Turn",
  result = null,
  submitting = false,
  onSubmit,
}) {
  const payload = item?.payload || {};
  const prompt = item?.prompt || {};

  const cues = useMemo(
    () => normalizeCues(payload),
    [payload],
  );

  const completionOptions =
    Array.isArray(payload?.completionOptions) &&
    payload.completionOptions.length > 0
      ? payload.completionOptions
      : [
          {
            id: "yes",
            label: "Yes",
          },
          {
            id: "needed-help",
            label: "I needed help",
          },
        ];

  const completionQuestion =
    payload?.completionQuestion ||
    "Were you able to complete the speaking challenge?";

  const completed =
    result?.evaluationCode ===
    "SELF_ATTESTED_COMPLETE";

  const [isRecording, setIsRecording] =
    useState(false);

  const [
    recordedAudioUrl,
    setRecordedAudioUrl,
  ] = useState("");

  const [
    selectedCompletion,
    setSelectedCompletion,
  ] = useState("");

  const [micError, setMicError] = useState("");

  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordedAudioUrlRef = useRef("");

  function cleanupRecordingStream() {
    try {
      const stream = recordingStreamRef.current;

      if (
        stream &&
        typeof stream.getTracks === "function"
      ) {
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
      if (
        mediaRecorderRef.current?.state ===
        "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {}

    cleanupRecordingStream();
  }

  function resetRecording() {
    stopActiveRecorder();
    revokeRecordingUrl();

    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];

    setIsRecording(false);
    setRecordedAudioUrl("");
    setMicError("");
  }

  useEffect(() => {
    resetRecording();
    setSelectedCompletion("");

    return () => {
      stopActiveRecorder();
      revokeRecordingUrl();
    };
    // Reset browser-local evidence when the item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  async function startRecording() {
    try {
      setMicError("");

      if (
        !navigator?.mediaDevices?.getUserMedia
      ) {
        setMicError(
          "Microphone recording is not supported in this browser.",
        );
        return;
      }

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
        if (
          event.data &&
          event.data.size > 0
        ) {
          recordingChunksRef.current.push(
            event.data,
          );
        }
      };

      recorder.onstop = () => {
        try {
          const mimeType =
            recorder.mimeType ||
            recordingChunksRef.current[0]
              ?.type ||
            "audio/webm";

          const blob = new Blob(
            recordingChunksRef.current,
            {
              type: mimeType,
            },
          );

          const url =
            URL.createObjectURL(blob);

          recordedAudioUrlRef.current = url;
          setRecordedAudioUrl(url);
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
        "[CefrFinalChallenge] microphone error",
        error,
      );

      cleanupRecordingStream();
      setIsRecording(false);

      if (
        error?.name === "NotAllowedError" ||
        error?.name ===
          "PermissionDeniedError"
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

  function stopRecording() {
    try {
      if (
        mediaRecorderRef.current?.state ===
        "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {
      setIsRecording(false);
      cleanupRecordingStream();
    }
  }

  function playRecording() {
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

  function handleSubmit() {
    if (
      !recordedAudioUrl ||
      !selectedCompletion ||
      submitting ||
      completed
    ) {
      return;
    }

    onSubmit?.({
      completed: true,
      neededHelp:
        selectedCompletion === "needed-help",
    });
  }

  return (
    <div className="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
        {activityTitle}
      </p>

      <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
        {prompt?.title ||
          "Complete the speaking challenge."}
      </h2>

      {prompt?.instruction && (
        <p className="mt-2 text-sm font-semibold text-slate-600">
          {prompt.instruction}
        </p>
      )}

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Speak about
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cues.map((cue) => (
            <div
              key={cue.key}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-slate-950">
                  {cue.label}
                </p>

                {cue.optional && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Optional
                  </span>
                )}
              </div>

              {cue.answerStarter && (
                <p className="mt-2 text-sm font-semibold text-indigo-700">
                  {cue.answerStarter}
                </p>
              )}
            </div>
          ))}
        </div>

        {Array.isArray(payload?.hints) &&
          payload.hints.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">
                Need a little help?
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {payload.hints.map((hint, index) => (
                  <span
                    key={`${hint}-${index}`}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-900"
                  >
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          )}

        {payload?.optionalSpellingCheckpoint
          ?.instruction && (
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-indigo-600">
              Optional spelling checkpoint
            </p>

            <p className="mt-2 font-bold text-indigo-950">
              {
                payload
                  .optionalSpellingCheckpoint
                  .instruction
              }
            </p>
          </div>
        )}
      </div>

      {!completed && (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Record your answer
          </p>

          <p className="mt-2 text-sm font-medium text-slate-600">
            Speak naturally from memory. Your recording
            stays only in this browser.
          </p>

          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white transition hover:bg-emerald-700"
            >
              🎙 Start Recording
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="mt-4 w-full rounded-2xl bg-rose-600 px-5 py-4 font-black text-white transition hover:bg-rose-700"
            >
              ■ Stop Recording
            </button>
          )}

          {micError && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              {micError}
            </div>
          )}

          {recordedAudioUrl && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-black text-emerald-900">
                Recording ready ✅
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={playRecording}
                  className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                >
                  ▶ My Voice
                </button>

                <button
                  type="button"
                  onClick={resetRecording}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                >
                  🔁 Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!completed && recordedAudioUrl && (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-black text-slate-950">
            {completionQuestion}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {completionOptions.map((option) => {
              const selected =
                selectedCompletion === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setSelectedCompletion(
                      option.id,
                    )
                  }
                  className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                    selected
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-indigo-200"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {selectedCompletion === "needed-help" && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                That's okay. Complete the challenge and we'll remember that you needed some help with this skill.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={
              !selectedCompletion ||
              submitting
            }
            onClick={handleSubmit}
            className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting
              ? "Saving..."
              : "Complete Challenge"}
          </button>
        </div>
      )}

      {completed && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <p className="font-black text-emerald-900">
            Speaking challenge completed ✓
          </p>
        </div>
      )}
    </div>
  );
}
