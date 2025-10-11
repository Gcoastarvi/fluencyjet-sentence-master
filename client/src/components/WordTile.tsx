import { cn } from "@/lib/utils";

interface WordTileProps {
  word: string;
  tamilWord?: string;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function WordTile({
  word,
  tamilWord,
  isSelected = false,
  onClick,
  disabled = false,
  className,
}: WordTileProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={`word-tile-${word.toLowerCase()}`}
      className={cn(
        "rounded-2xl px-6 py-3 border-2 transition-all duration-200 min-h-12",
        "hover-elevate active-elevate-2",
        isSelected
          ? "bg-primary text-primary-foreground border-primary scale-105 ring-2 ring-primary/30"
          : "bg-card text-card-foreground border-card-border",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-medium text-base">{word}</span>
        {tamilWord && (
          <span className="font-tamil text-sm text-muted-foreground">
            {tamilWord}
          </span>
        )}
      </div>
    </button>
  );
}
