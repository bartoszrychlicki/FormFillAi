import libraryConfig from "@formfillai/eslint-config/library";

const projectRoot = new URL(".", import.meta.url).pathname;
const tsconfigPath = new URL("./tsconfig.json", import.meta.url).pathname;

const config = [
  ...libraryConfig,
  {
    ignores: ["jest.config.ts", "tsup.config.ts"]
  },
  {
    files: ["src/**/*.test.{ts,tsx}"],
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
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json"
        }
      }
    },
    languageOptions: {
      parserOptions: {
        project: tsconfigPath,
        tsconfigRootDir: projectRoot
      },
      globals: {
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        console: "readonly",
        globalThis: "readonly"
      }
    },
    rules: {
      "import/no-relative-packages": "error"
    }
  }
];

export default config;
