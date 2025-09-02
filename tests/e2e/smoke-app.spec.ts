/**
 * QC-LOCK2: App smoke test on vite preview
 * Validates homepage renders correctly with all navigation and zero console errors
 * Then checks Designer page basic accessibility
 */

import { test, expect, type Page } from '@playwright/test'

test.describe('App Smoke Test', () => {
  let consoleErrors: string[] = []
  let pageErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    // Reset error collectors
    consoleErrors = []
    pageErrors = []

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Capture page errors
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })
  })

  test('homepage renders with workspace elements and zero errors', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check page title contains HNC
    await expect(page).toHaveTitle(/HNC/)

    // Assert Create New Fabric button is visible (this is the key element)
    await expect(page.getByRole('button', { name: 'Create New Fabric' })).toBeVisible()

    // Assert either workspace heading or app content is visible
    const workspaceHeading = page.getByText(/HNC|Fabric/)
    await expect(workspaceHeading.first()).toBeVisible()

    // Check for zero console errors and page errors
    expect(consoleErrors, `Console errors found: ${consoleErrors.join(', ')}`).toHaveLength(0)
    expect(pageErrors, `Page errors found: ${pageErrors.join(', ')}`).toHaveLength(0)
  })

  test('designer page basic accessibility', async ({ page }) => {
    // Navigate to homepage first
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Create a fabric if none exist, or select an existing one
    const createButton = page.getByRole('button', { name: 'Create New Fabric' })
    
    if (await createButton.isVisible()) {
      const emptyState = page.getByText('No fabrics created yet')
      const hasEmptyState = await emptyState.isVisible().catch(() => false)
      
      if (hasEmptyState) {
        // Create a test fabric
        await createButton.click()
        await page.getByPlaceholder('Enter fabric name...').fill('Smoke Test Fabric')
        await page.getByRole('button', { name: 'Create' }).click()
      }
      
      // Select the first fabric
      await page.getByRole('button', { name: 'Select' }).first().click()
    }
    
    await page.waitForLoadState('networkidle')

    // Assert Designer page key elements are visible
    await expect(page.getByTestId('leaf-model-select')).toBeVisible()
    await expect(page.getByTestId('uplinks-per-leaf-input')).toBeVisible()

    // Check for zero console errors and page errors on Designer page
    expect(consoleErrors, `Console errors found on Designer: ${consoleErrors.join(', ')}`).toHaveLength(0)
    expect(pageErrors, `Page errors found on Designer: ${pageErrors.join(', ')}`).toHaveLength(0)
  })
})