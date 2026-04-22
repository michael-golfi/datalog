/** @type {import('lint-staged').Configuration} */
export default {
  'packages/**/*.{ts,tsx,cts,mts}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  'packages/**/*.{js,jsx,mjs,cjs,json,md,yml,yaml,css,scss,html}': 'prettier --write',
};
