import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import WordTile from "./WordTile";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizQuestionProps {
  tamilSentence: string;
  correctAnswer: string[];
  words: string[];
  onCorrect: () => void;
  onWrong: () => void;
  questionNumber: number;
  totalQuestions: number;
}

export default function QuizQuestion({
  tamilSentence,
  correctAnswer,
  words,
  onCorrect,
  onWrong,
  questionNumber,
  totalQuestions,
}: QuizQuestionProps) {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState<"correct" | "wrong" | null>(null);

  const handleWordClick = (word: string) => {
    if (showFeedback) return;
    
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter((w) => w !== word));
    } else {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleCheck = () => {
    const isCorrect = 
      selectedWords.length === correctAnswer.length &&
      selectedWords.every((word, index) => word === correctAnswer[index]);

    if (isCorrect) {
      setShowFeedback("correct");
      setTimeout(() => {
        onCorrect();
        setSelectedWords([]);
        setShowFeedback(null);
      }, 1500);
    } else {
      setShowFeedback("wrong");
      setTimeout(() => {
        setShowFeedback(null);
      }, 1000);
    }
  };

  const handleClear = () => {
    setSelectedWords([]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8" data-testid="quiz-question">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Question {questionNumber} of {totalQuestions}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold font-tamil">
          {tamilSentence}
        </h2>
        <p className="text-muted-foreground">Translate to English</p>
      </div>

      <Card className="p-8 min-h-32 flex items-center justify-center">
        <div className="flex flex-wrap gap-3 justify-center">
          {selectedWords.length === 0 ? (
            <p className="text-muted-foreground">Select words to build the sentence</p>
          ) : (
            selectedWords.map((word, index) => (
              <span
                key={index}
                className="text-xl font-medium px-2 py-1 rounded bg-primary/10 text-primary"
                data-testid={`selected-word-${index}`}
              >
                {word}
              </span>
            ))
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3 justify-center">
        {words.map((word) => (
          <WordTile
            key={word}
            word={word}
            isSelected={selectedWords.includes(word)}
            onClick={() => handleWordClick(word)}
            disabled={showFeedback !== null}
          />
        ))}
      </div>

      <div className="flex gap-4 justify-center">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={selectedWords.length === 0 || showFeedback !== null}
          data-testid="button-clear"
        >
          Clear
        </Button>
        <Button
          onClick={handleCheck}
          disabled={selectedWords.length === 0 || showFeedback !== null}
          data-testid="button-check"
          className="min-w-32"
        >
          Check Answer
        </Button>
      </div>

      {showFeedback && (
        <div
          className={cn(
            "fixed inset-0 flex items-center justify-center bg-black/20 z-50 animate-in fade-in duration-200",
          )}
        >
          <Card className="p-8 flex flex-col items-center gap-4">
            {showFeedback === "correct" ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-chart-1" />
                <p className="text-2xl font-bold text-chart-1">Correct!</p>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-destructive" />
                <p className="text-2xl font-bold text-destructive">Try Again!</p>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
