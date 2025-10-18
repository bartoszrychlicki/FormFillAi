import type { Config } from "jest";

const config: Config = {
  displayName: "web",
  rootDir: ".",
  testEnvironment: "node",
  preset: "ts-jest/presets/js-with-ts-esm",
  testMatch: ["<rootDir>/src/**/*.test.(ts|tsx)"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@formfillai/shared$": "<rootDir>/../../packages/shared/src/index",
    "^.+\\.(css|sass|scss)$": "identity-obj-proxy"
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          jsx: "react-jsx"
        }
      }
    ]
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  passWithNoTests: true
};

export default config;
