// client/src/components/quiz/ConfettiBlast.jsx
const EMOJIS = ["🎉", "✨", "🎊", "⭐", "💫", "🌟"];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function ConfettiBlast() {
  const pieces = Array.from({ length: 40 });

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
      {pieces.map((_, i) => {
        const left = randomBetween(0, 100);
        const duration = randomBetween(0.8, 1.6);
        const delay = randomBetween(0, 0.4);
        const size = randomBetween(1.2, 2.4);
        const emoji = EMOJIS[i % EMOJIS.length];

        return (
          <span
            key={i}
            className="absolute animate-bounce"
            style={{
              left: `${left}%`,
              top: `${randomBetween(5, 60)}%`,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
              fontSize: `${size}rem`,
            }}
          >
            {emoji}
          </span>
        );
      })}
    </div>
  );
}

export default ConfettiBlast;
