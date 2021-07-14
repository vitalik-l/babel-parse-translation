'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

const path = require('path');
const fs = require('fs');
const glob = require('glob');

const logPrefix = '[babel-parse-translation]';
const nativeStdout = process.stdout.write;
let silent = true;

const setSilent = () => {
  if (silent) {
    process.stdout.write = () => {};
  }
};

function warn(text) {
  process.stdout.write = nativeStdout;
  console.log(
    '\x1b[33m%s\x1b[0m',
    `
${logPrefix}: ${text}`,
  );
  setSilent();
}

function error(text) {
  process.stdout.write = nativeStdout;
  console.log(
    '\x1b[31m%s\x1b[0m',
    `
${logPrefix}: ${text}`,
  );
  setSilent();
}
function success(text) {
  process.stdout.write = nativeStdout;
  console.log(
    '\x1b[32m%s\x1b[0m',
    `
  ${logPrefix}: ${text}`,
  );
  setSilent();
}

function get(value, path, defaultValue) {
  if (value[path]) return value[path];
  return String(path)
    .split('.')
    .reduce((acc, v) => {
      try {
        acc = acc[v] === undefined ? defaultValue : acc[v];
      } catch (e) {
        return defaultValue;
      }
      return acc;
    }, value);
}

const set = (obj, path, value) => {
  if (Object(obj) !== obj) return obj; // When obj is not an object
  // If not yet an array, get the keys from the string-path
  if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
  path.slice(0, -1).reduce(
    (
      a,
      c,
      i, // Iterate all of them except the last one
    ) =>
      Object(a[c]) === a[c] // Does the key exist and is its value an object?
        ? // Yes: then follow that path
          a[c]
        : // No: create the key. Is the next key a potential array-index?
          (a[c] =
            Math.abs(path[i + 1]) >> 0 === +path[i + 1]
              ? [] // Yes: assign a new array object
              : {}), // No: assign a new plain object
    obj,
  )[path[path.length - 1]] = value; // Finally assign the value to the last key
  return obj; // Return the top-level object to allow chaining
};

exports.default = function ({ types: t }) {
  let localesOutPath;
  let localesIn;
  let unknownKeys;
  let needWrite = false;
  let baseLang = 'en';
  const localesOut = {};
  const untranslated = {};

  const getLocalesIn = (localesPath) => {
    if (!localesIn) {
      localesIn = {};
      localesOutPath = path.resolve(localesPath, 'parsed');
      const files = glob.sync(`${localesPath}/*.json`);
      files.forEach((file) => {
        const fileParams = path.parse(file);
        localesIn[fileParams.name] = JSON.parse(fs.readFileSync(file));
      });
    }
  };

  const getUnknownKeys = (keys) => {
    if (!unknownKeys) {
      unknownKeys = keys || {};
    }
    return unknownKeys;
  };

  const addKey = (key, { isUnknown = false } = {}) => {
    if (isUnknown) {
      getUnknownKeys();
      if (unknownKeys[key]) {
        unknownKeys[key].forEach((unknownKey) => {
          addKey(unknownKey);
        });
        return;
      }
    }
    Object.keys(localesIn).forEach((name) => {
      if (!localesOut[name]) localesOut[name] = {};
      if (!get(localesOut[name], isUnknown ? `__UNKNOWN.${key}` : key)) {
        const data = localesIn[name];
        if (isUnknown) {
          const { __UNKNOWN, ...restStrings } = localesOut[name];
          localesOut[name] = {
            __UNKNOWN: {
              ...__UNKNOWN,
              [key]: key,
            },
            ...restStrings,
          };
        } else {
          const baseValue = get(localesIn[baseLang], key);
          const value = get(data, key) || baseValue || key;
          set(localesOut[name], key, value);
          if (name !== baseLang && value === baseValue) {
            if (!untranslated[name]) untranslated[name] = {};
            set(untranslated[name], key, value);
          }
        }
        needWrite = true;
      }
    });
  };

  const save = () => {
    if (!needWrite) return;
    success(`write lang strings to file ${localesOutPath}`);
    fs.mkdirSync(localesOutPath, { recursive: true });
    Object.keys(localesOut).forEach((name) => {
      fs.writeFileSync(
        path.resolve(localesOutPath, `${name}.json`),
        JSON.stringify(localesOut[name], null, 2),
      );
    });
    const untranslatedKeys = Object.keys(untranslated);
    if (untranslatedKeys.length) {
      fs.writeFileSync(
        path.resolve(localesOutPath, `_untranslated.json`),
        JSON.stringify(untranslated, null, 2),
      );
    }
    needWrite = false;
  };

  return {
    visitor: {
      CallExpression(pathParam, state) {
        const options = state.opts;
        const node = pathParam.node;
        const arg = node.arguments[0];
        const { fnNames = ['t'] } = options;
        if (!localesOutPath) {
          localesOutPath = options.localesOutPath;
        }
        if (!!~fnNames.indexOf(node.callee.name) && arg) {
          if (t.isStringLiteral(arg) && arg.value) {
            addKey(arg.value);
          } else {
            warn(
              pathParam.buildCodeFrameError(
                ` found unknown argument ${pathParam.toString()} in the ${
                  pathParam.hub.file.opts.sourceFileName
                }`,
              ),
            );
            addKey(pathParam.toString(), { isUnknown: true });
          }
        }
      },
      Program: {
        enter(_, state) {
          getLocalesIn(state.opts.localesPath);
          getUnknownKeys(state.opts.unknownKeys);
          if (state.opts.baseLang) {
            baseLang = state.opts.baseLang;
          }
          if (state.opts.silent === false) {
            silent = false;
          }
        },
        exit() {
          save();
        },
      },
    },
  };
};
