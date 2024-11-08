/// <reference types="vite/client" />

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

interface ImportMeta {
  glob: (pattern: string) => Record<string, () => Promise<{ default: string }>>;
}
