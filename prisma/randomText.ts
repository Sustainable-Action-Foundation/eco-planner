import rawText from "./text.json" with { type: "json" };

// Filtering
const sourceText = rawText
  .filter(t => {
    // Counts
    const charCount = t.length;
    const digitCount = (t.match(/\d/g) || []).length;
    const nonCharCount = (t.match(/[^a-zA-Z\s]/g) || []).length;

    // Filter out texts with more than 10% digits
    if (digitCount / charCount > 0.1) return false;

    // Filter out texts with more than 20% non-character symbols
    if (nonCharCount / charCount > 0.2) return false;

    // Filter less than 3 characters
    if (charCount < 3) return false;

    return true;
  });

// Group by word count
const byWordCount: Record<number, string[]> = {};
for (const item of sourceText) {
  const wordCount = item.split(/\s+/).length;

  // Create length category if it doesn't exist
  if (!byWordCount[wordCount]) byWordCount[wordCount] = [];

  // Add the item to the corresponding length category
  byWordCount[wordCount].push(item);
}

// Extract all words from the text
const allWords: string[] = [];
for (const item of sourceText) {
  const words = item.split(/\s+/);
  for (const word of words) {
    if (word.length > 0) {
      allWords.push(word);
    }
  }
}

// API class
export class RandomTextSE {
  static fallbackString: string = "ORD";

  static sentence(wordCount: number = 7, fuzziness: number = 2): string {
    wordCount = parseInt(wordCount.toString(), 10);
    fuzziness = parseInt(fuzziness.toString(), 10);

    const fuzzyDown = new Array(fuzziness).fill(0).map((_, i) => wordCount - i - 1);
    const fuzzyUp = new Array(fuzziness).fill(0).map((_, i) => wordCount + i + 1);

    const poolKeys = [wordCount, ...fuzzyDown, ...fuzzyUp];

    const pool = [];
    for (const key of poolKeys) {
      if (key > 0 && byWordCount[key]) {
        pool.push(...byWordCount[key]);
      } else {
        this.warn("No items found for word count", key);
      }
    }

    if (pool.length === 0) {
      this.warn("No items found for word count", wordCount, "and fuzziness", fuzziness, "falling back to random words");
      return this.words(wordCount);
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const randomSentence = pool[randomIndex];

    return randomSentence + ".";
  }

  static paragraph(sentenceCount: number = 4, fuzziness: number = 1): string {
    sentenceCount = parseInt(sentenceCount.toString(), 10);
    fuzziness = parseInt(fuzziness.toString(), 10);

    const fuzzyDown = new Array(fuzziness).fill(0).map((_, i) => sentenceCount - i - 1);
    const fuzzyUp = new Array(fuzziness).fill(0).map((_, i) => sentenceCount + i + 1);

    const counts = [sentenceCount, ...fuzzyDown, ...fuzzyUp];
    const randomCount = Math.max(1, counts[Math.floor(Math.random() * counts.length)]);

    const sentences: string[] = [];
    for (let i = 0; i < randomCount; i++) {
      const sentence = this.sentence();
      if (sentence) {
        sentences.push(sentence);
      } else {
        this.warn("Failed to generate a sentence, using fallback string");
        sentences.push(this.fallbackString);
      }
    }

    return sentences.join(" ");
  }

  static word(): string {
    return this.words(1);
  }

  static words(wordCount: number = 3): string {
    wordCount = parseInt(wordCount.toString(), 10);
    if (wordCount < 1) {
      this.warn("Word count must be at least 1, using 1 instead");
      wordCount = 1;
    }

    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
      const randomIndex = Math.floor(Math.random() * allWords.length);
      words.push(allWords[randomIndex]);
    }

    return words.join(" ");
  }

  static log(...args: unknown[]) {
    console.info("RandomTextSE:", ...args);
  }
  static info(...args: unknown[]) {
    console.info("RandomTextSE:", ...args);
  }
  static error(...args: unknown[]) {
    console.error("RandomTextSE:", ...args);
  }
  static warn(...args: unknown[]) {
    console.warn("RandomTextSE:", ...args);
  }
}