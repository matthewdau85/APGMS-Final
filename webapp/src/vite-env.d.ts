/// <reference types="vite/client" />

declare module "@tailwindcss/vite" {
  const plugin: () => import("vite").PluginOption;
  export default plugin;
}
