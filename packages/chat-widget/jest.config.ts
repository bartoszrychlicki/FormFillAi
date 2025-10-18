import type { Config } from "jest";

const config: Config = {
  displayName: "chat-widget",
  rootDir: ".",
  testEnvironment: "jsdom",
  preset: "ts-jest/presets/default-esm",
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
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
