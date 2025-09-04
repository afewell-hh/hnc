const noop = () => ({ postcssPlugin: 'noop', Once() {} })
let tailwindcss = noop
let autoprefixer = noop
try {
  tailwindcss = require('@tailwindcss/postcss')
} catch {}
try {
  autoprefixer = require('autoprefixer')
} catch {}
module.exports = {
  plugins: [tailwindcss, autoprefixer],
}
