import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // Code GÉNÉRÉ (client OpenAPI) — jamais édité ni linté à la main
      "lib/api/generated/**",
      // Code du template shadcn-ui-kit conservé tel quel (P6) — purge au J9
      "app/dashboard/**",
      "components/ui/**",
      "components/layout/**",
      "components/theme-customizer/**",
      "components/active-theme.tsx",
      "components/custom-date-range-picker.tsx",
      "components/date-time-picker.tsx",
      "components/icon.tsx",
      "hooks/**",
      "lib/compose-refs.ts",
      "lib/fonts.ts",
      "lib/ga.ts",
      "lib/themes.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "react/no-children-prop": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off"
    }
  }
];

export default eslintConfig;
