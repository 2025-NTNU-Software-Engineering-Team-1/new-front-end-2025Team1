// This line is used to provide type definition of VITE env variables
// See https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pages/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  const component: DefineComponent<object, object, any>;
  export default component;
}
