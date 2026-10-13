declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PROVIDER_CREDENTIAL_MASTER_KEY?: string;
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GEMINI_API_KEY?: string;
    PERPLEXITY_API_KEY?: string;
    OPENAI_MODEL?: string;
    ANTHROPIC_MODEL?: string;
    GEMINI_MODEL?: string;
    PERPLEXITY_MODEL?: string;
  }
}
