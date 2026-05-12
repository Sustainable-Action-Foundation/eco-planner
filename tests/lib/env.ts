export function boolEnv(envName: string, defaultValue: boolean = false): boolean {
  const value = process.env[envName];
  if (typeof value === "undefined") return defaultValue;
  if (value.length === 0) return defaultValue;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  throw new Error(`Invalid boolean value for environment variable ${envName}: ${value}`);
}