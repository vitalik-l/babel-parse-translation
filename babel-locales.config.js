const path = require('path');

const localeOutPath = path.resolve(__dirname, 'locale');

module.exports = {
  presets: [
    '@babel/preset-env',
    [
      '@babel/preset-typescript',
      {
        allExtensions: true,
        isTSX: true,
      },
    ],
  ],
  plugins: [
    [
      './babel-plugin.js',
      {
        localesPath: './public/locales',
      },
    ],
  ],
};
