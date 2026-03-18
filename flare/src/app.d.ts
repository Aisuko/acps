// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: {
        OPENAI_API_KEY?: string;
        OPENAI_MODEL?: string;
        OPENAI_BASE_URL?: string;
        ALLOWED_ORIGIN?: string;
      };
    }
  }
}

export {};
