import libraryConfig from "@formfillai/eslint-config/library";

const config = [
  ...libraryConfig,
  {
    ignores: ["jest.config.ts"]
  },
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    languageOptions: {
      globals: {
        afterEach: "readonly",
        beforeEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        jest: "readonly"
      }
    }
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import/no-relative-packages": "error"
    }
  }
];

export default config;
