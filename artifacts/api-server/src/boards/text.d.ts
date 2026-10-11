// Page templates and the browser copy of the money engine, bundled as text (build.mjs).
declare module "*.html" { const text: string; export default text; }
declare module "*.txt" { const text: string; export default text; }
