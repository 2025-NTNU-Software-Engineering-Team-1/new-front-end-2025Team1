// This line is used to provide type definition of VITE env variables
// See https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pages/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<object, object, any>;
  export default component;
}

declare namespace Live2DCubismCore {
  // 這兩個是來自官方 Core 的物件，型別先維持 any，
  // 但用 eslint 註解關掉 no-explicit-any 規則，避免 lint � �錯。
  const Moc: unknown;
  const Model: unknown;

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
