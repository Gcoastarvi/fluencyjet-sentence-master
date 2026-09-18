import { useEffect, useMemo, useState } from "react";

function normalizeFields(payload) {
  if (!Array.isArray(payload?.fields)) {
    return [];
  }

  return payload.fields
    .filter(
      (field) =>
        field &&
        typeof field === "object" &&
        typeof field.key === "string" &&
        field.key.trim()
    )
    .map((field) => ({
      key: field.key.trim(),
      label:
        typeof field.label === "string" && field.label.trim()
          ? field.label.trim()
          : field.key.trim(),
      type:
        typeof field.type === "string" && field.type.trim()
          ? field.type.trim()
          : "TEXT",
      placeholder:
        typeof field.placeholder === "string" ? field.placeholder : "",
      optional: field.optional === true,
    }));
}

function normalizeSentencePrompts(payload) {
  if (!Array.isArray(payload?.sentencePrompts)) {
    return [];
  }

  return payload.sentencePrompts
    .filter(
      (prompt) =>
        prompt &&
        typeof prompt === "object" &&
        typeof prompt.key === "string" &&
        prompt.key.trim()
    )
    .map((prompt) => {
      const template =
        typeof prompt.template === "string" ? prompt.template.trim() : "";

      return {
        key: prompt.key.trim(),
        template,
        label:
          typeof prompt.label === "string" && prompt.label.trim()
            ? prompt.label.trim()
            : template || "Write your sentence",
        placeholder:
          typeof prompt.placeholder === "string" && prompt.placeholder.trim()
            ? prompt.placeholder.trim()
            : template,
        optional: prompt.optional === true,
      };
    });
}

function emptyValues(items) {
  return Object.fromEntries(items.map((item) => [item.key, ""]));
}

export default function CefrGroupedFieldsActivity({
  item,
  activityTitle = "Write It",
  result = null,
  submitting = false,
  onAnswerChange,
  onSubmit,
}) {
  const fields = useMemo(
    () => normalizeFields(item?.payload),
    [item?.payload]
  );

  const sentencePrompts = useMemo(
    () => normalizeSentencePrompts(item?.payload),
    [item?.payload]
  );

  const [profile, setProfile] = useState(() => emptyValues(fields));
  const [sentences, setSentences] = useState(() =>
    emptyValues(sentencePrompts)
  );

  const completed =
    result?.evaluationCode === "SELF_ATTESTED_COMPLETE";

  useEffect(() => {
    setProfile(emptyValues(fields));
    setSentences(emptyValues(sentencePrompts));
  }, [item?.id, fields, sentencePrompts]);

  const requiredFieldsComplete = fields
    .filter((field) => !field.optional)
    .every((field) => String(profile[field.key] ?? "").trim());

  const requiredSentencesComplete = sentencePrompts
    .filter((prompt) => !prompt.optional)
    .every((prompt) => String(sentences[prompt.key] ?? "").trim());

  const canSubmit =
    !submitting &&
    !completed &&
    requiredFieldsComplete &&
    requiredSentencesComplete;

  function updateProfile(key, value) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));

    onAnswerChange?.();
  }

  function updateSentence(key, value) {
    setSentences((current) => ({
      ...current,
      [key]: value,
    }));

    onAnswerChange?.();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const normalizedProfile = Object.fromEntries(
      fields.map((field) => [
        field.key,
        String(profile[field.key] ?? "").trim(),
      ])
    );

    const normalizedSentences = Object.fromEntries(
      sentencePrompts.map((prompt) => [
        prompt.key,
        String(sentences[prompt.key] ?? "").trim(),
      ])
    );

    await onSubmit?.({
      completed: true,
      profile: normalizedProfile,
      sentences: normalizedSentences,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-600">
          {activityTitle}
        </p>

        {item?.prompt?.title && (
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {item.prompt.title}
          </h2>
        )}

        {item?.prompt?.instruction && (
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {item.prompt.instruction}
          </p>
        )}
      </div>

      {fields.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Your information
          </h3>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-2 block text-sm font-extrabold text-slate-800">
                  {field.label}
                  {field.optional && (
                    <span className="ml-1 font-semibold text-slate-400">
                      (optional)
                    </span>
                  )}
                </span>

                <input
                  type="text"
                  value={profile[field.key] ?? ""}
                  placeholder={field.placeholder}
                  disabled={completed || submitting}
                  onChange={(event) =>
                    updateProfile(field.key, event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {sentencePrompts.length > 0 && (
        <section className="mt-7 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Write your sentences
          </h3>

          <div className="mt-3 space-y-4">
            {sentencePrompts.map((prompt) => (
              <label key={prompt.key} className="block">
                <span className="mb-2 block text-sm font-extrabold text-slate-800">
                  {prompt.label}
                  {prompt.optional && (
                    <span className="ml-1 font-semibold text-slate-400">
                      (optional)
                    </span>
                  )}
                </span>

                <input
                  type="text"
                  value={sentences[prompt.key] ?? ""}
                  placeholder={prompt.placeholder}
                  disabled={completed || submitting}
                  onChange={(event) =>
                    updateSentence(prompt.key, event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="mt-7">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-indigo-600 px-5 py-3.5 text-base font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
        >
          {submitting ? "Saving..." : "Complete Writing"}
        </button>

        {completed && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-black text-emerald-800">
              Writing activity completed ✓
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
