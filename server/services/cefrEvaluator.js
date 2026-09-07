function result(isCorrect, evaluationCode, score) {
  return {
    ok: true,
    isCorrect,
    evaluationCode,
    score,
  };
}

function failure(evaluationCode) {
  return {
    ok: false,
    isCorrect: null,
    evaluationCode,
    score: null,
  };
}

function normalizeText(value, normalization = {}) {
  let text = String(value);

  const trim = normalization.trim !== false;
  const collapseWhitespace = normalization.collapseWhitespace === true;
  const caseSensitive = normalization.caseSensitive !== false;

  if (trim) {
    text = text.trim();
  }

  if (collapseWhitespace) {
    text = text.replace(/\s+/g, " ");
  }

  if (!caseSensitive) {
    text = text.toLocaleLowerCase();
  }

  return text;
}

function evaluateTokenSequence(answerKey, submittedAnswer) {
  if (
    !Array.isArray(answerKey?.tokens) ||
    answerKey.tokens.some((token) => typeof token !== "string")
  ) {
    return failure("EVALUATOR_CONFIG_ERROR");
  }

  if (
    !Array.isArray(submittedAnswer?.tokens) ||
    submittedAnswer.tokens.some((token) => typeof token !== "string")
  ) {
    return failure("INVALID_SUBMISSION");
  }

  const isCorrect =
    answerKey.tokens.length === submittedAnswer.tokens.length &&
    answerKey.tokens.every(
      (token, index) => token === submittedAnswer.tokens[index],
    );

  return result(
    isCorrect,
    isCorrect ? "CORRECT" : "INCORRECT",
    isCorrect ? 1 : 0,
  );
}

function evaluateText(answerKey, submittedAnswer) {
  if (
    !Array.isArray(answerKey?.acceptedAnswers) ||
    answerKey.acceptedAnswers.length === 0 ||
    answerKey.acceptedAnswers.some((answer) => typeof answer !== "string")
  ) {
    return failure("EVALUATOR_CONFIG_ERROR");
  }

  if (typeof submittedAnswer?.text !== "string") {
    return failure("INVALID_SUBMISSION");
  }

  const normalization =
    answerKey.normalization && typeof answerKey.normalization === "object"
      ? answerKey.normalization
      : {};

  const submitted = normalizeText(submittedAnswer.text, normalization);

  const isCorrect = answerKey.acceptedAnswers.some(
    (accepted) => normalizeText(accepted, normalization) === submitted,
  );

  return result(
    isCorrect,
    isCorrect ? "CORRECT" : "INCORRECT",
    isCorrect ? 1 : 0,
  );
}

function evaluateSingleChoice(answerKey, submittedAnswer) {
  if (
    typeof answerKey?.correctOptionId !== "string" ||
    !answerKey.correctOptionId
  ) {
    return failure("EVALUATOR_CONFIG_ERROR");
  }

  if (
    typeof submittedAnswer?.optionId !== "string" ||
    !submittedAnswer.optionId
  ) {
    return failure("INVALID_SUBMISSION");
  }

  const isCorrect =
    submittedAnswer.optionId === answerKey.correctOptionId;

  return result(
    isCorrect,
    isCorrect ? "CORRECT" : "INCORRECT",
    isCorrect ? 1 : 0,
  );
}

function evaluateSelfAttested(submittedAnswer) {
  if (submittedAnswer?.completed !== true) {
    return failure("INVALID_SUBMISSION");
  }

  return result(
    null,
    "SELF_ATTESTED_COMPLETE",
    null,
  );
}

export function evaluateCefrSubmission({
  evaluationMode,
  answerKey,
  submittedAnswer,
}) {
  if (evaluationMode === "SELF_ATTESTED") {
    return evaluateSelfAttested(submittedAnswer);
  }

  if (evaluationMode !== "AUTO") {
    return failure("EVALUATOR_CONFIG_ERROR");
  }

  if (!answerKey || typeof answerKey !== "object") {
    return failure("EVALUATOR_CONFIG_ERROR");
  }

  switch (answerKey.type) {
    case "TOKEN_SEQUENCE":
      return evaluateTokenSequence(answerKey, submittedAnswer);

    case "TEXT":
      return evaluateText(answerKey, submittedAnswer);

    case "SINGLE_CHOICE":
      return evaluateSingleChoice(answerKey, submittedAnswer);

    default:
      return failure("EVALUATOR_CONFIG_ERROR");
  }
}
