import path from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal: async (cfg) => {
    cfg.resolve = cfg.resolve || {}
    cfg.resolve.alias = {
      ...(cfg.resolve.alias || {}),
      '@': path.resolve(__dirname, '../src'),
    }
    return cfg
  },
}

export default config