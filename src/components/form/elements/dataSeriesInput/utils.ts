export function isValidPastedInput(value: string): boolean {
  return /^[0-9+\-.,\s\t\r\n;]*$/.test(value);
}
