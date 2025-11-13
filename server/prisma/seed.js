import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const items = [
  { ta: "நான் பள்ளிக்குச் செல்கிறேன்", en: "I am going to school" },
  { ta: "அவள் புத்தகம் படிக்கிறாள்", en: "She is reading a book" },
  { ta: "நாம் ஒன்றாக விளையாடுகிறோம்", en: "We are playing together" },
  { ta: "அவர் வேலைக்கு போகிறார்", en: "He is going to work" },
  { ta: "அவர்கள் பாடல் பாடுகிறார்கள்", en: "They are singing a song" },
  { ta: "நான் பால் குடிக்கிறேன்", en: "I am drinking milk" },
  { ta: "அவள் சமையல் செய்கிறாள்", en: "She is cooking food" },
  { ta: "நாம் டீ குடிக்கிறோம்", en: "We are drinking tea" },
  { ta: "அவர் டிவி பார்க்கிறார்", en: "He is watching TV" },
  {
    ta: "அவர்கள் கிரிக்கெட் விளையாடுகிறார்கள்",
    en: "They are playing cricket",
  },
  { ta: "நான் கடைக்குப் போகிறேன்", en: "I am going to the shop" },
  { ta: "அவள் பாடல் கேட்கிறாள்", en: "She is listening to a song" },
  { ta: "நாம் பஸ்சில் பயணம் செய்கிறோம்", en: "We are traveling by bus" },
  { ta: "அவர் உணவு சாப்பிடுகிறார்", en: "He is eating food" },
  { ta: "அவர்கள் படம் பார்க்கிறார்கள்", en: "They are watching a movie" },
  { ta: "நான் குளிக்கிறேன்", en: "I am taking a bath" },
  { ta: "அவள் எழுதுகிறாள்", en: "She is writing" },
  { ta: "நாம் வேலை செய்கிறோம்", en: "We are working" },
  { ta: "அவர் பத்திரிகை படிக்கிறார்", en: "He is reading a newspaper" },
  { ta: "அவர்கள் பேசுகிறார்கள்", en: "They are talking" },
  { ta: "நான் ஓடுகிறேன்", en: "I am running" },
  { ta: "அவள் சிரிக்கிறாள்", en: "She is smiling" },
  { ta: "நாம் நடக்கிறோம்", en: "We are walking" },
  { ta: "அவர் தூங்குகிறார்", en: "He is sleeping" },
  { ta: "அவர்கள் ஆடுகிறார்கள்", en: "They are dancing" },
  { ta: "நான் புத்தகம் படிக்கிறேன்", en: "I am reading a book" },
  { ta: "அவள் காய்கறி வாங்குகிறாள்", en: "She is buying vegetables" },
  { ta: "நாம் பாடுகிறோம்", en: "We are singing" },
  { ta: "அவர் காரை ஓட்டுகிறார்", en: "He is driving a car" },
  { ta: "அவர்கள் கேள்வி கேட்கிறார்கள்", en: "They are asking a question" },
  { ta: "நான் நண்பனுடன் பேசுகிறேன்", en: "I am talking with my friend" },
  { ta: "அவள் கதவை திறக்கிறாள்", en: "She is opening the door" },
  { ta: "நாம் அறையை சுத்தம் செய்கிறோம்", en: "We are cleaning the room" },
  { ta: "அவர் மழையில் நடக்கிறார்", en: "He is walking in the rain" },
  { ta: "அவர்கள் சாப்பாடு சமைக்கிறார்கள்", en: "They are cooking food" },
  { ta: "நான் பாடம் படிக்கிறேன்", en: "I am studying a lesson" },
  { ta: "அவள் பஸ் காத்திருக்கிறாள்", en: "She is waiting for the bus" },
  {
    ta: "நாம் தோட்டத்தில் வேலை செய்கிறோம்",
    en: "We are working in the garden",
  },
  { ta: "அவர் தண்ணீர் குடிக்கிறார்", en: "He is drinking water" },
  {
    ta: "அவர்கள் விளையாட்டை பார்க்கிறார்கள்",
    en: "They are watching the game",
  },
  { ta: "நான் பிஸியாக இருக்கிறேன்", en: "I am busy" },
  { ta: "அவள் அழகாக இருக்கிறாள்", en: "She is beautiful" },
  { ta: "நாம் மகிழ்ச்சியாக இருக்கிறோம்", en: "We are happy" },
  { ta: "அவர் சோர்வாக இருக்கிறார்", en: "He is tired" },
  { ta: "அவர்கள் சத்தமாக பேசுகிறார்கள்", en: "They are speaking loudly" },
  { ta: "நான் வீட்டில் இருக்கிறேன்", en: "I am at home" },
  { ta: "அவள் பள்ளியில் இருக்கிறாள்", en: "She is at school" },
  { ta: "நாம் பூங்காவில் இருக்கிறோம்", en: "We are in the park" },
  { ta: "அவர் அலுவலகத்தில் இருக்கிறார்", en: "He is in the office" },
  { ta: "அவர்கள் கடற்கரையில் இருக்கிறார்கள்", en: "They are at the beach" },
  // …add more
];

async function main() {
  for (const q of items) {
    await prisma.typingQuestion.upsert({
      where: { ta: q.ta },
      update: {},
      create: { ta: q.ta, en: q.en, level: "beginner" },
    });
  }
  console.log("Seeded typing questions.");
}

main().finally(() => prisma.$disconnect());
