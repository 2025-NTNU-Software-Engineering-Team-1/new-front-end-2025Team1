// This line is used to provide type definition of VITE env variables
// See https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pages/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare namespace Live2DCubismCore {
  const Moc: any;
  const Model: any;
  function Logging_Log(message: string): void;
  function Logging_SetLogFunction(handler: (message: string) => void): void;
  enum LogLevel {
    LogLevel_Verbose,
    LogLevel_Debug,
    LogLevel_Info,
    LogLevel_Warning,
    LogLevel_Error,
  }
}

interface Window {
  Live2DCubismCore: typeof Live2DCubismCore;
}