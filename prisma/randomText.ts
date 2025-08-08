import rawText from "./text.json" with { type: "json" };

// Extracted text from wikipedia https://sv.wikipedia.org/wiki/H%C3%A5llbar_utveckling Our license should be compatible https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/
// function main() {
//   if (typeof document === "undefined") return;

//   const includeNode = ["P", "SPAN", "A", "H1", "H2", "H3", "H4", "H5", "H6"];
//   const allText = Array.from(document.querySelectorAll("*"))
//     // Filter nodes
//     .filter(e => includeNode.includes(e.nodeName))

//     // Stringify
//     .map(e => e.textContent?.trim() || "")
//     .filter(Boolean)

//     // Clean
//     .map(t => t.replace(/[\u200B-\u200D\uFEFF]/g, "")) // Zero-width characters
//     .map(t => t.replace(/\s/g, " ")) // Whitespace
//     .map(t => t.replace(/[\u00A0\u202F]/g, " ")) // Non-breaking spaces
//     .map(t => t.replace(/[\u2018\u2019\u201C\u201D]/g, "'")) // Smart quotes
//     .map(t => t.replace(/[\u2013\u2014]/g, "-")) // Dashes
//     .map(t => t.replace(/[\u00AD]/g, "")) // Soft hyphen
//     .map(t => t.replace(/[\u2028\u2029]/g, " ")) // Line and paragraph separators
//     .map(t => t.replace(/[\u00B7]/g, "·")) // Middle dot

//     // More than one whitespace -> new line
//     .map(t => t.replace(/\s\s+/g, "\n"))

//     // Split
//     .flatMap(t => t.split(/\r?\n/)) // New line
//     .flatMap(t => t.split("·")) // Middle dot
//     .flatMap(t => t.split(".")) // Period
//     .flatMap(t => t.split("!")) // Exclamation mark
//     .flatMap(t => t.split("?")) // Question mark
//     .flatMap(t => t.split(/\s/)) // Whitespace

//     // Post trim and filter
//     .map(t => t.trim())
//     .filter(t => t.length > 1);

//   // create button that i can click to copy allText to clipboard
//   const button = document.createElement("button");
//   button.textContent = "Kopiera text";
//   button.style.position = "fixed";
//   button.style.top = "10px";
//   button.style.right = "10px";
//   button.style.zIndex = "1000";
//   button.onclick = () => {
//     navigator.clipboard.writeText(JSON.stringify(allText)).then(() => {
//       console.info("Text kopierad till urklipp!");
//     }).catch(err => {
//       console.error("Kunde inte kopiera text: ", err);
//     });
//   };
//   document.body.appendChild(button);

// }
// setTimeout(main, 1000);

// Filtering
const text = rawText
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
for (const item of text) {
  const wordCount = item.split(/\s+/).length;

  // Create length category if it doesn't exist
  if (!byWordCount[wordCount]) byWordCount[wordCount] = [];

  // Add the item to the corresponding length category
  byWordCount[wordCount].push(item);
}

// Extract all words from the text
const allWords: string[] = [];
for (const item of text) {
  const words = item.split(/\s+/);
  for (const word of words) {
    if (word.length > 0) {
      allWords.push(word);
    }
  }
}

console.log(allWords, "words extracted from text.json");

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

  static sentence(wordCount: number = 10): string {
    const items = byWordCount[wordCount] || [];
    if (items.length === 0 && wordCount > 1) {
      this.info("No items found for word count", wordCount, "falling back to word count", wordCount - 1);
      return this.sentence(wordCount - 1)
    }
    else if (items.length === 0) {
      this.warn("No items found for word count", wordCount, "returning random word");
      return this.words(1);
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  static sentences(sentenceCount: number = 1, wordsPerSentence: number = 10): string {
    const sentences = [];
    for (let i = 0; i < sentenceCount; i++) {
      sentences.push(this.sentence(wordsPerSentence));
    }
    return sentences.join(" ");
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