// Pre commit: fix and format only the staged files. The full typecheck runs after this in .husky/pre-commit.
const config = {
  "*.{ts,tsx,js,mjs,cjs}": ["eslint --fix --no-warn-ignored", "prettier --write"],
  "*.{json,jsonc,css,md,yml,yaml}": "prettier --write --ignore-unknown",
};

export default config;
