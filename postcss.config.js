/** @type {import('postcss-load-config').Config} */
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {
      base: __dirname,
      // Skip Lightning CSS native bindings in dev — Turbopack can't bundle .node files.
      optimize: false,
    },
  },
};
