import sharedConfig from "@formfillai/eslint-config";

const config = [
  ...sharedConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    settings: {
      next: {
        rootDir: ["apps/web"],
      },
    },
  },
];

export default config;
