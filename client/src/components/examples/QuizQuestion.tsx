import { useState } from "react";
import QuizQuestion from "../QuizQuestion";

export default function QuizQuestionExample() {
  const [score, setScore] = useState(0);

  return (
    <div className="p-6">
      <div className="mb-4 text-center">
        <p className="text-sm text-muted-foreground">Score: {score}</p>
      </div>
      <QuizQuestion
        tamilSentence="நான் மகிழ்ச்சியாக இருக்கிறேன்"
        correctAnswer={["I", "am", "happy"]}
        words={["happy", "I", "sad", "am", "not"]}
        onCorrect={() => {
          console.log("Correct answer!");
          setScore(score + 10);
        }}
        onWrong={() => console.log("Wrong answer!")}
        questionNumber={1}
        totalQuestions={5}
      />
    </div>
  );
}
