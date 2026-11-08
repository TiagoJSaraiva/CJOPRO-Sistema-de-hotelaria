import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const NEXT_APPS = ["apps/{pms,public}/**/*.{ts,tsx,js,jsx}"];

// O eslint-config-next 16 só existe em configuração plana. Cada bloco vale apenas para os apps Next,
// como valia o extends anterior; blocos só com ignores continuam globais.
const scopeToNextApps = (config) =>
  Object.keys(config).length === 1 && config.ignores
    ? config
    : { ...config, files: NEXT_APPS };

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "**/playwright-report/**",
    ],
  },
  {
    files: ["eslint.config.mjs", "apps/pms/package.json"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {},
  },
  ...compat.config({
    overrides: [
      {
        files: [
          "apps/backend-service/**/*.{ts,tsx}",
          "apps/booking-engine-service/**/*.{ts,tsx}",
          "packages/shared/**/*.{ts,tsx}",
        ],
        parser: "@typescript-eslint/parser",
        plugins: ["@typescript-eslint"],
        extends: [
          "eslint:recommended",
          "plugin:@typescript-eslint/recommended",
        ],
        env: {
          node: true,
          es2022: true,
        },
        rules: {
          "@typescript-eslint/no-explicit-any": "off",
        },
      },
    ],
  }),
  ...[...nextCoreWebVitals, ...nextTypescript].map(scopeToNextApps),
  {
    files: NEXT_APPS,
    settings: {
      next: {
        rootDir: ["apps/pms/", "apps/public/"],
      },
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      // O eslint-plugin-react-hooks 7 trouxe regras do React Compiler, que o projeto não usa. Estas duas
      // acusam 12 pontos de código anterior; a adoção é avaliada depois da depuração (QA-098).
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
