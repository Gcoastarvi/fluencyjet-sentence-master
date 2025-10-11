import { useState } from "react";
import WordTile from "../WordTile";

export default function WordTileExample() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-4 p-6">
      <WordTile
        word="happy"
        tamilWord="மகிழ்ச்சி"
        isSelected={selected === "happy"}
        onClick={() => setSelected("happy")}
      />
      <WordTile
        word="learning"
        tamilWord="கற்றல்"
        isSelected={selected === "learning"}
        onClick={() => setSelected("learning")}
      />
      <WordTile
        word="English"
        isSelected={selected === "english"}
        onClick={() => setSelected("english")}
      />
    </div>
  );
}
