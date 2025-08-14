
// Extracted text from wikipedia 
//   https://sv.wikipedia.org/wiki/H%C3%A5llbar_utveckling 
//   https://sv.wikipedia.org/wiki/Ekosystemtj%C3%A4nster
// Our license should be compatible https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/
function main() {
  if (typeof document === "undefined") return;

  const includeNode = ["P", "SPAN", "A", "H1", "H2", "H3", "H4", "H5", "H6"];
  const allText = Array.from(document.querySelectorAll("*"))
    // Filter nodes
    .filter(e => includeNode.includes(e.nodeName))

    // Stringify
    .map(e => e.textContent?.trim() || "")
    .filter(Boolean)

    // Clean
    // .map(t => t.replace(/[\u200B-\u200D\uFEFF]/g, "")) // Zero-width characters
    .map(t => t.replace(/\s/g, " ")) // Whitespace
    .map(t => t.replace(/[\u00A0\u202F]/g, " ")) // Non-breaking spaces
    .map(t => t.replace(/[\u2018\u2019\u201C\u201D]/g, "'")) // Smart quotes
    .map(t => t.replace(/[\u02bb]/g, "'")) // Apostrophe
    .map(t => t.replace(/[\u2013\u2014]/g, "-")) // Dashes
    .map(t => t.replace(/[\u00AD]/g, "")) // Soft hyphen
    .map(t => t.replace(/[\u2212]/g, "-")) // Minus sign
    .map(t => t.replace(/[\u2028\u2029]/g, " ")) // Line and paragraph separators
    .map(t => t.replace(/[\u00B7]/g, "·")) // Middle dot
    .map(t => t.replace(/\s\s+/g, "\n")) // More than one whitespace -> new line
    .map(t => t.replaceAll("\"", "'")) // Backslash escaped double quotes to single quotes
    .map(t => t.replaceAll("'''", "'")) // Triple quotes to single quotes
    .map(t => t.replaceAll("''", "'")) // Double quotes to single quotes

    // Split sentences
    .flatMap(t => t.split(/\r?\n/)) // New line
    .flatMap(t => t.split("·")) // Middle dot
    .flatMap(t => t.split(".")) // Period
    .flatMap(t => t.split("!")) // Exclamation mark
    .flatMap(t => t.split("?")) // Question mark

    // Post trim and content filter
    .map(t => t.trim())
    .filter(t => !t.includes("http") && !t.includes("www") && !t.includes("@") && !t.includes("mailto:") && !t.includes("://") && !(t.match(/\/.*?\//) ?? false))
    .filter(t => !(t.match(/\[\d*\]/) ?? false)) // Citations
    .filter(t => !(t.includes("[") && t.includes("]") && t.includes("|"))) // Wikipedia edit nav
    .filter(t => t.length > 1);

  // create button that i can click to copy allText to clipboard
  const button = document.createElement("button");
  button.textContent = "Kopiera text";
  button.style.position = "fixed";
  button.style.top = "10px";
  button.style.right = "10px";
  button.style.zIndex = "1000";
  button.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(allText)).then(() => {
      console.info("Text kopierad till urklipp!");
    }).catch(err => {
      console.error("Kunde inte kopiera text: ", err);
    });
  };
  document.body.appendChild(button);
}
setTimeout(main, 1000);
