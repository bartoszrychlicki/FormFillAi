import type { Config } from "jest";

const config: Config = {
  displayName: "shared",
  rootDir: ".",
  testEnvironment: "node",
  preset: "ts-jest/presets/default-esm",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "./tsconfig.json"
      }
    ]
  },
  globals: {
    "ts-jest": {
      useESM: true
    }
  },
  passWithNoTests: true
};

export default config;
