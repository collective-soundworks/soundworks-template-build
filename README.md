# `@soundworks/template-build`

> `soundworks-template` build scripts for [soundworks#v3](https://github.com/collective-soundworks/soundworks)

General approach:
- `webpack` and `babel` to bundle browser clients
- `chokidar` for file watching
- from v4 - Node processes (server, node clients) should run with "type: module"

## Install

```
npm install --save soundworks-template-build
```

## Usage

```
soundworks-template-build --build [--watch]
soundworks-template-build --minify
soundworks-template-build --watch-process <processName>
```

## Notes

Should support iOS >= 9

> browserlist: 'ios >= 9, not ie 11, not op_mini all'

## Todos

- `typescript` support (see https://github.com/collective-soundworks/soundworks-template-build/pull/1)
- `vue.js` and `react` support

## License

BSD-3-Clause
