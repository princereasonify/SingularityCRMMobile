module.exports = {
  preset: 'react-native',
  // The App smoke test used to die on `import 'react-native-reanimated'` before reaching a
  // single assertion, so App.tsx was effectively untested. Two things are needed for
  // reanimated 4 under Jest:
  //
  //  - transformIgnorePatterns: reanimated and worklets ship untranspiled ESM/TS, and the
  //    react-native preset excludes node_modules from Babel, so they must be allowed through
  //    or they fail to parse.
  //  - resolver: reanimated pulls react-native-worklets, whose `.native` entrypoints throw
  //    "Native part of Worklets doesn't seem to be initialized" outside a real runtime. The
  //    resolver worklets ships for this drops the `.native` extensions so the plain JS
  //    implementations load instead.
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|react-native-.*|@react-navigation/.*)/)',
  ],
};
