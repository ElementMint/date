import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const banner = `/**
 * @elementmints/date
 * A lightweight, dependency-free, attribute-driven date picker
 * @license MIT
 */`;

const tsPlugin = (overrides = {}) =>
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    declarationDir: undefined,
    outDir: undefined,
    ...overrides,
  });

export default [
  // ESM
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'esm',
      sourcemap: true,
      banner,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
    },
    plugins: [tsPlugin()],
  },
  // CJS
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/cjs/index.cjs',
      format: 'cjs',
      sourcemap: true,
      banner,
      exports: 'named',
    },
    plugins: [tsPlugin()],
  },
  // IIFE (browser bundle with auto-init)
  {
    input: 'src/browser.ts',
    output: {
      file: 'dist/iife/date.min.js',
      format: 'iife',
      name: 'DatePicker',
      sourcemap: true,
      banner,
    },
    plugins: [tsPlugin(), terser({ format: { comments: /^!|@license/ } })],
  },
];
