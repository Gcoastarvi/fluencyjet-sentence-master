import { useState } from "react";
import QuizQuestion from "@/components/QuizQuestion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

const quizData = [
  {
    tamil: "நான் மகிழ்ச்சியாக இருக்கிறேன்",
    correct: ["I", "am", "happy"],
    words: ["happy", "I", "sad", "am", "not"],
  },
  {
    tamil: "அவள் பள்ளிக்கு செல்கிறாள்",
    correct: ["She", "goes", "to", "school"],
    words: ["She", "goes", "school", "to", "home", "from"],
  },
  {
    tamil: "நாங்கள் ஆங்கிலம் கற்கிறோம்",
    correct: ["We", "are", "learning", "English"],
    words: ["We", "are", "learning", "English", "Tamil", "not"],
  },
];

export default function FreeQuiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const handleCorrect = () => {
    setScore(score + 10);
    if (currentQuestion === quizData.length - 1) {
      setShowResults(true);
    } else {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleWrong = () => {
    console.log("Wrong answer");
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setScore(0);
    setShowResults(false);
  };

  if (showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-chart-2/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <Trophy className="w-16 h-16 mx-auto text-chart-3" />
          <h1 className="text-3xl font-bold">Great Job!</h1>
          <p className="text-xl">
            Your Score: <span className="font-bold text-primary">{score}</span> / {quizData.length * 10}
          </p>
          <p className="text-muted-foreground">
            Sign up to track your progress and unlock more lessons!
          </p>
          <div className="flex flex-col gap-3">
            <Button size="lg" data-testid="button-signup">
              Sign Up to Continue
            </Button>
            <Button variant="outline" size="lg" onClick={handleRestart} data-testid="button-restart">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-chart-2/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            FluencyJet Sentence Master
          </h1>
          <p className="text-muted-foreground">
            Build English sentences from Tamil prompts
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Score: {score} | Question {currentQuestion + 1} of {quizData.length}
          </p>
        </div>

        <QuizQuestion
          tamilSentence={quizData[currentQuestion].tamil}
          correctAnswer={quizData[currentQuestion].correct}
          words={quizData[currentQuestion].words}
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          questionNumber={currentQuestion + 1}
          totalQuestions={quizData.length}
        />
      </div>
    </div>
  );
}
