export default function truncateText(
  string: string | null | undefined, 
  maxLength: number,
): string | undefined {
  if (!string) return;
  if (string.length <= maxLength) return string;

  const truncatedString = string.slice(0, maxLength);
  // Cut at the last word boundary within the limit; without one, keep the whole prefix
  const lastSpace = truncatedString.lastIndexOf(' ');
  return (lastSpace === -1 ? truncatedString : truncatedString.slice(0, lastSpace)) + '…';
}
