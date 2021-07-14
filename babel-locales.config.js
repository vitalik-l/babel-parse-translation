const path = require('path');

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
