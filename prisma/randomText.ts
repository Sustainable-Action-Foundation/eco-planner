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

  static sentence(options: { wordCount: number, fuzziness: number } = { wordCount: 7, fuzziness: 2 }): string {
    if (typeof options !== "object" || options === null || Array.isArray(options) || !("wordCount" in options) || !("fuzziness" in options)) {
      this.error("Invalid options for sentence generation, expected an object but got", typeof options);
      return this.fallbackString;
    }

    options.wordCount = parseInt(options.wordCount.toString(), 10);
    options.fuzziness = parseInt(options.fuzziness.toString(), 10);

    const fuzzyDown = new Array(options.fuzziness).fill(0).map((_, i) => options.wordCount - i - 1);
    const fuzzyUp = new Array(options.fuzziness).fill(0).map((_, i) => options.wordCount + i + 1);

    const poolKeys = [options.wordCount, ...fuzzyDown, ...fuzzyUp];

    const pool = [];
    for (const key of poolKeys) {
      if (key > 0 && byWordCount[key]) {
        pool.push(...byWordCount[key]);
      } else {
        this.warn("No items found for word count", key);
      }
    }

    if (pool.length === 0) {
      this.warn("No items found for word count", options.wordCount, "and fuzziness", options.fuzziness, "falling back to random words");
      return this.words(options.wordCount);
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const randomSentence = pool[randomIndex];

    return randomSentence + ".";
  }

  static paragraph(options: { sentenceCount: number, fuzziness: number } = { sentenceCount: 4, fuzziness: 1 }): string {
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      this.error("Invalid options for sentences generation, expected an object but got", typeof options);
      return this.fallbackString;
    }

    options.sentenceCount = parseInt(options.sentenceCount.toString(), 10);
    options.fuzziness = parseInt(options.fuzziness.toString(), 10);

    const fuzzyDown = new Array(options.fuzziness).fill(0).map((_, i) => options.sentenceCount - i - 1);
    const fuzzyUp = new Array(options.fuzziness).fill(0).map((_, i) => options.sentenceCount + i + 1);

    const counts = [options.sentenceCount, ...fuzzyDown, ...fuzzyUp];
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

    return sentences.map(s => s + ".").join(" ");
  }

  static word(): string {
    return this.words(1);
  }

  static words(wordCount: number = 1): string {
    const items = byWordCount[wordCount] || [];
    if (items.length === 0 && wordCount > 1) {
      this.info("No items found for word count", wordCount, "falling back to word count", wordCount - 1);
      return this.words(wordCount - 1);
    }
    else if (items.length === 0) {
      this.warn("No items found for word count", wordCount, `returning ${this.fallbackString} in place of words`);
      return this.fallbackString.repeat(wordCount);
    }
    return items[Math.floor(Math.random() * items.length)];
  }
}

console.log(RandomTextSE.paragraph());