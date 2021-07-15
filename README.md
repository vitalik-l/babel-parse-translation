To install:\
```yarn add -D babel-plugin-parse-translation```

You may need also @babel/preset-typescript

Add config file babel-locales.config.js:
```javascript
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
      'parse-translation',
      {
        localesPath: './public/locales',
      },
    ],
  ],
};

```

Add `yarn locales` command to package.json:
```json
{ 
  "scripts": {
    "locales": "babel --extensions \".tsx\" --config-file babel-locales.config.js ./src"
  }
}
```
Run `yarn locales`