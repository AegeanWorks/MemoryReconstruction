/// <reference types="vite/client" />

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.wgsl' {
  const value: string;
  export default value;
}

declare module '*.glsl' {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  readonly GAME_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Automated playtests and the console reach the running game through this handle.
interface Window {
  __MR__?: import('./app/App').App;
}
