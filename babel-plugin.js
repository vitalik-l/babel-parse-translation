'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true,
})

const fs = require('fs')

const logPrefix = '[babel-plugin-translation]'

function get(value, path, defaultValue) {
  if (value[path]) return value[path]
  return String(path)
    .split('.')
    .reduce((acc, v) => {
      try {
        acc = acc[v] === undefined ? defaultValue : acc[v]
      } catch (e) {
        return defaultValue
      }
      return acc
    }, value)
}

const set = (obj, path, value) => {
  if (Object(obj) !== obj) return obj // When obj is not an object
  // If not yet an array, get the keys from the string-path
  if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || []
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
  )[path[path.length - 1]] = value // Finally assign the value to the last key
  return obj // Return the top-level object to allow chaining
}

function warn(text) {
  console.log(
    '\x1b[33m%s\x1b[0m',
    `
${logPrefix}: ${text}
`,
  )
}
function error(text) {
  console.log(
    '\x1b[31m%s\x1b[0m',
    `
${logPrefix}: ${text}
`,
  )
}
function success(text) {
  console.log(
    '\x1b[32m%s\x1b[0m',
    `
${logPrefix}: ${text}
`,
  )
}

exports.default = function ({ types: t }) {
  let strings
  let localeOutPath
  let needWrite = false
  let unknownStrings = null

  return {
    visitor: {
      CallExpression(path, state) {
        const options = state.opts
        const node = path.node
        const arg = node.arguments[0]
        const { fnNames = ['t'] } = options
        if (!localeOutPath) {
          localeOutPath = options.localeOutPath
        }
        if (!!~fnNames.indexOf(node.callee.name) && arg) {
          if (t.isStringLiteral(arg) && arg.value) {
            if (!needWrite) {
              try {
                const raw = fs.readFileSync(localeOutPath)
                strings = JSON.parse(raw)
              } catch (err) {
                if (!strings) {
                  strings = {}
                }
              }
            }
            const value = arg.value
            const stringValue = get(strings, value)
            const needToChange = !stringValue
            if (needToChange) {
              set(strings, value, value)
              needWrite = true
            }
          } else {
            warn(
              path.buildCodeFrameError(
                ` found unknown argument ${path.toString()} in the ${path.hub.file.opts.sourceFileName}`,
              ),
            )
            if (!unknownStrings) unknownStrings = {}
            unknownStrings[`${path}`] = path.toString()
            needWrite = true
          }
        }
      },
      Program: {
        exit() {
          if (!needWrite) return
          success(`write lang strings to file ${localeOutPath}`)
          const { __UNKNOWN, ...restStrings } = strings
          const res = {
            __UNKNOWN: unknownStrings,
            ...restStrings,
          }
          fs.writeFileSync(localeOutPath, JSON.stringify(unknownStrings ? res : strings, null, 2))
          needWrite = false
        },
      },
    },
  }
}
