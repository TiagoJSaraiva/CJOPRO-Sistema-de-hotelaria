module.exports = {
  root: true,
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.next/**",
    "**/playwright-report/**"
  ],
  overrides: [
    {
      files: [
        "apps/backend-service/**/*.{ts,tsx}",
        "apps/booking-engine-service/**/*.{ts,tsx}",
        "packages/shared/**/*.{ts,tsx}"
      ],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
      env: {
        node: true,
        es2022: true
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off"
      }
    },
    {
      files: ["apps/pms/**/*.{ts,tsx,js,jsx}", "apps/site/**/*.{ts,tsx,js,jsx}"],
      extends: ["next/core-web-vitals"]
    }
  ]
};
