export { };
export type GlobalEnv = {
  APP_VERSION: string;
  COMMIT_SHA: string;
  COMMIT_URL: string | undefined;
  REMOTE_REPO_URL: string;
};

// Values of these are set in next.config.ts at build time
declare global {
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends GlobalEnv { }
  }
}