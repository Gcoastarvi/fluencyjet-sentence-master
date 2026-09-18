const ACTIVITY_CONTRACTS = Object.freeze({
  MCQ: {
    evaluationMode: "AUTO",
    answerKeyType: "SINGLE_CHOICE",
  },
  LISTENING_MCQ: {
    evaluationMode: "AUTO",
    answerKeyType: "SINGLE_CHOICE",
  },
  REORDER: {
    evaluationMode: "AUTO",
    answerKeyType: "TOKEN_SEQUENCE",
  },
  TYPING: {
    evaluationMode: "AUTO",
    answerKeyType: "TEXT",
  },
  AUDIO_REPEAT: {
    evaluationMode: "SELF_ATTESTED",
  },
  GROUPED_FIELDS: {
    evaluationMode: "SELF_ATTESTED",
  },
  SPEAKING_PROMPT: {
    evaluationMode: "SELF_ATTESTED",
  },
  FINAL_CHALLENGE: {
    evaluationMode: "SELF_ATTESTED",
  },
});

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates];
}

function sameStringMultiset(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  const counts = new Map();

  for (const value of left) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  for (const value of right) {
    if (!counts.has(value)) {
      return false;
    }

    const next = counts.get(value) - 1;

    if (next === 0) {
      counts.delete(value);
    } else {
      counts.set(value, next);
    }
  }

  return counts.size === 0;
}

function validateOptions(item, path, errors) {
  const options = item?.payload?.options;

  if (!Array.isArray(options) || options.length < 2) {
    errors.push(`${path}: payload.options must contain at least 2 options`);
    return;
  }

  const optionIds = [];

  options.forEach((option, index) => {
    const optionPath = `${path}.payload.options[${index}]`;

    if (!isNonEmptyString(option?.id)) {
      errors.push(`${optionPath}.id must be a non-empty string`);
    } else {
      optionIds.push(option.id);
    }

    if (!isNonEmptyString(option?.label)) {
      errors.push(`${optionPath}.label must be a non-empty string`);
    }
  });

  for (const duplicate of duplicateValues(optionIds)) {
    errors.push(`${path}: duplicate option id "${duplicate}"`);
  }

  const correctOptionId = item?.answerKey?.correctOptionId;

  if (
    isNonEmptyString(correctOptionId) &&
    !optionIds.includes(correctOptionId)
  ) {
    errors.push(
      `${path}: answerKey.correctOptionId "${correctOptionId}" does not exist in payload.options`,
    );
  }
}

function validateAutoAnswerKey(activity, item, path, errors) {
  const contract = ACTIVITY_CONTRACTS[activity.activityType];

  if (!contract) {
    errors.push(
      `${path}: cannot validate AUTO answerKey for unsupported activity type "${activity.activityType}"`,
    );
    return;
  }

  const answerKey = item?.answerKey;

  if (!answerKey || typeof answerKey !== "object" || Array.isArray(answerKey)) {
    errors.push(`${path}: AUTO activity requires an answerKey object`);
    return;
  }

  if (answerKey.type !== contract.answerKeyType) {
    errors.push(
      `${path}: ${activity.activityType} requires answerKey.type "${contract.answerKeyType}"`,
    );
    return;
  }

  if (answerKey.type === "SINGLE_CHOICE") {
    if (
      activity.activityType === "LISTENING_MCQ" &&
      !isNonEmptyString(item?.payload?.audioAssetKey)
    ) {
      errors.push(
        `${path}: LISTENING_MCQ requires payload.audioAssetKey`,
      );
    }

    if (!isNonEmptyString(answerKey.correctOptionId)) {
      errors.push(
        `${path}: SINGLE_CHOICE requires answerKey.correctOptionId`,
      );
    }

    validateOptions(item, path, errors);
    return;
  }

  if (answerKey.type === "TOKEN_SEQUENCE") {
    const payloadTokens = item?.payload?.tokens;
    const answerTokens = answerKey.tokens;

    if (
      !Array.isArray(payloadTokens) ||
      payloadTokens.length === 0 ||
      payloadTokens.some((token) => !isNonEmptyString(token))
    ) {
      errors.push(
        `${path}: REORDER requires non-empty string payload.tokens`,
      );
    }

    if (
      !Array.isArray(answerTokens) ||
      answerTokens.length === 0 ||
      answerTokens.some((token) => !isNonEmptyString(token))
    ) {
      errors.push(
        `${path}: TOKEN_SEQUENCE requires non-empty string answerKey.tokens`,
      );
    }

    if (
      Array.isArray(payloadTokens) &&
      Array.isArray(answerTokens) &&
      !sameStringMultiset(payloadTokens, answerTokens)
    ) {
      errors.push(
        `${path}: payload.tokens and answerKey.tokens must contain the same tokens`,
      );
    }

    return;
  }

  if (answerKey.type === "TEXT") {
    const acceptedAnswers = answerKey.acceptedAnswers;

    if (
      !Array.isArray(acceptedAnswers) ||
      acceptedAnswers.length === 0 ||
      acceptedAnswers.some((answer) => !isNonEmptyString(answer))
    ) {
      errors.push(
        `${path}: TEXT requires at least one non-empty accepted answer`,
      );
    }
  }
}

function validateSelfAttestedPayload(activity, item, path, errors) {
  const payload = item?.payload ?? {};

  if (activity.activityType === "AUDIO_REPEAT") {
    if (!isNonEmptyString(payload.audioAssetKey)) {
      errors.push(`${path}: AUDIO_REPEAT requires payload.audioAssetKey`);
    }

    if (!isNonEmptyString(payload.modelText)) {
      errors.push(`${path}: AUDIO_REPEAT requires payload.modelText`);
    }

    return;
  }

  if (activity.activityType === "GROUPED_FIELDS") {
    const fields = Array.isArray(payload.fields) ? payload.fields : [];
    const sentencePrompts = Array.isArray(payload.sentencePrompts)
      ? payload.sentencePrompts
      : [];

    if (fields.length === 0 && sentencePrompts.length === 0) {
      errors.push(
        `${path}: GROUPED_FIELDS requires fields and/or sentencePrompts`,
      );
    }

    const fieldKeys = [];

    fields.forEach((field, index) => {
      const fieldPath = `${path}.payload.fields[${index}]`;

      if (!isNonEmptyString(field?.key)) {
        errors.push(`${fieldPath}.key must be a non-empty string`);
      } else {
        fieldKeys.push(field.key);
      }

      if (!isNonEmptyString(field?.label)) {
        errors.push(`${fieldPath}.label must be a non-empty string`);
      }
    });

    for (const duplicate of duplicateValues(fieldKeys)) {
      errors.push(`${path}: duplicate GROUPED_FIELDS field key "${duplicate}"`);
    }

    const sentenceKeys = [];

    sentencePrompts.forEach((prompt, index) => {
      const promptPath = `${path}.payload.sentencePrompts[${index}]`;

      if (!isNonEmptyString(prompt?.key)) {
        errors.push(`${promptPath}.key must be a non-empty string`);
      } else {
        sentenceKeys.push(prompt.key);
      }

    });

    for (const duplicate of duplicateValues(sentenceKeys)) {
      errors.push(
        `${path}: duplicate GROUPED_FIELDS sentence prompt key "${duplicate}"`,
      );
    }

    return;
  }

}

function validateItem(activity, item, itemIndex, path, errors) {
  const itemPath = `${path}.items[${itemIndex}]`;

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    errors.push(`${itemPath}: item must be an object`);
    return;
  }

  if (!isNonEmptyString(item.itemKey)) {
    errors.push(`${itemPath}.itemKey must be a non-empty string`);
  }

  if (!isPositiveInteger(item.orderIndex)) {
    errors.push(`${itemPath}.orderIndex must be a positive integer`);
  }

  if (
    !item.prompt ||
    typeof item.prompt !== "object" ||
    Array.isArray(item.prompt)
  ) {
    errors.push(`${itemPath}.prompt must be an object`);
  }

  if (activity.evaluationMode === "AUTO") {
    validateAutoAnswerKey(activity, item, itemPath, errors);
  } else if (activity.evaluationMode === "SELF_ATTESTED") {
    validateSelfAttestedPayload(activity, item, itemPath, errors);
  }
}

function validateActivity(activity, activityIndex, dayPath, errors) {
  const path = `${dayPath}.activities[${activityIndex}]`;

  if (!activity || typeof activity !== "object" || Array.isArray(activity)) {
    errors.push(`${path}: activity must be an object`);
    return;
  }

  if (!isNonEmptyString(activity.key)) {
    errors.push(`${path}.key must be a non-empty string`);
  }

  if (!isNonEmptyString(activity.title)) {
    errors.push(`${path}.title must be a non-empty string`);
  }

  if (!isPositiveInteger(activity.orderIndex)) {
    errors.push(`${path}.orderIndex must be a positive integer`);
  }

  const contract = ACTIVITY_CONTRACTS[activity.activityType];

  if (!contract) {
    errors.push(
      `${path}.activityType "${activity.activityType}" is unsupported`,
    );
  } else if (activity.evaluationMode !== contract.evaluationMode) {
    errors.push(
      `${path}: ${activity.activityType} requires evaluationMode "${contract.evaluationMode}"`,
    );
  }

  if (!Array.isArray(activity.items) || activity.items.length === 0) {
    errors.push(`${path}.items must contain at least one item`);
    return;
  }

  const itemKeys = activity.items
    .map((item) => item?.itemKey)
    .filter(isNonEmptyString);

  for (const duplicate of duplicateValues(itemKeys)) {
    errors.push(`${path}: duplicate itemKey "${duplicate}"`);
  }

  const itemOrderIndexes = activity.items
    .map((item) => item?.orderIndex)
    .filter(Number.isInteger);

  for (const duplicate of duplicateValues(itemOrderIndexes)) {
    errors.push(`${path}: duplicate item orderIndex "${duplicate}"`);
  }

  activity.items.forEach((item, itemIndex) => {
    validateItem(activity, item, itemIndex, path, errors);
  });
}

function validateDay(day, dayIndex, errors) {
  const path = `days[${dayIndex}]`;

  if (!day || typeof day !== "object" || Array.isArray(day)) {
    errors.push(`${path}: day must be an object`);
    return;
  }

  if (!isPositiveInteger(day.dayNumber)) {
    errors.push(`${path}.dayNumber must be a positive integer`);
  }

  if (!isNonEmptyString(day.title)) {
    errors.push(`${path}.title must be a non-empty string`);
  }

  if (!Array.isArray(day.activities) || day.activities.length === 0) {
    errors.push(`${path}.activities must contain at least one activity`);
    return;
  }

  const activityKeys = day.activities
    .map((activity) => activity?.key)
    .filter(isNonEmptyString);

  for (const duplicate of duplicateValues(activityKeys)) {
    errors.push(`${path}: duplicate activity key "${duplicate}"`);
  }

  const activityOrderIndexes = day.activities
    .map((activity) => activity?.orderIndex)
    .filter(Number.isInteger);

  for (const duplicate of duplicateValues(activityOrderIndexes)) {
    errors.push(`${path}: duplicate activity orderIndex "${duplicate}"`);
  }

  day.activities.forEach((activity, activityIndex) => {
    validateActivity(activity, activityIndex, path, errors);
  });
}

export function validateCefrCurriculum({ days } = {}) {
  const errors = [];

  if (!Array.isArray(days) || days.length === 0) {
    return {
      ok: false,
      errors: ["days must contain at least one learning day"],
    };
  }

  const dayNumbers = days
    .map((day) => day?.dayNumber)
    .filter(Number.isInteger);

  for (const duplicate of duplicateValues(dayNumbers)) {
    errors.push(`duplicate dayNumber "${duplicate}"`);
  }

  days.forEach((day, dayIndex) => {
    validateDay(day, dayIndex, errors);
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function assertValidCefrCurriculum(input) {
  const result = validateCefrCurriculum(input);

  if (!result.ok) {
    throw new Error(
      `Invalid CEFR curriculum:\n${result.errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }

  return true;
}

export { ACTIVITY_CONTRACTS };
