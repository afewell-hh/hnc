import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  logLevel: 'verbose',
  tags: { include: ['ci'], exclude: ['no-tests'] }
};

// Global setup hook - reset before each story
export const prepare = async (page: any) => {
  await page.evaluate(() => (window as any).__HNC_RESET__?.())
}

export default config;