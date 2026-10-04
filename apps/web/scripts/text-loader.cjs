// A webpack-style loader for Turbopack: a file becomes a module whose default export is its text.
// Used for the templates' Mogram files (see `turbopack.rules` in next.config.ts).
module.exports = function textLoader(source) {
  return `export default ${JSON.stringify(String(source))};`;
};
