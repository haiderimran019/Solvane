// Used when .openai/hosting.json is absent (a fresh checkout or CI); Sites writes the real file.
declare module "*hosting.json" {
  const value: { d1?: string; r2?: string };
  export default value;
}
