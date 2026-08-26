import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "**/playwright-report/**"
    ]
  },
  {
    files: ["eslint.config.mjs", "apps/pms/package.json"],
    plugins: {
      "@next/next": nextPlugin
    },
    rules: {}
  },
  ...compat.config({
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
        files: ["apps/pms/**/*.{ts,tsx,js,jsx}"],
        extends: ["next/core-web-vitals", "next/typescript"],
        settings: {
          next: {
            rootDir: "apps/pms/"
          }
        },
        rules: {
          "@next/next/no-html-link-for-pages": "off"
        }
      }
    ]
  })
];
