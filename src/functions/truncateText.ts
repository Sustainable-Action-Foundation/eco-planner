export default function truncateText(
  string: string | null | undefined, 
  maxLength: number
): string | undefined {
  if (!string) return;
  if (string.length <= maxLength) return string;

  const truncatedString = string.slice(0, maxLength);
  return truncatedString.slice(0, truncatedString.lastIndexOf(' ')) + '…';
}
