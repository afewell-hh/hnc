import { test, expect } from '@playwright/test'

test('HNC E2E: create fabric → configure → compute → save workflow', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  // Wait for app to load completely
  await page.waitForLoadState('networkidle')
  
  // STEP 1: Create a new fabric (starts in FabricList view)
  // Look for create fabric input field
  await expect(page.getByPlaceholder(/fabric name/i)).toBeVisible({ timeout: 5000 })
  
  // Fill fabric name and create
  await page.getByPlaceholder(/fabric name/i).fill('E2E-Test-Fabric')
  await page.getByRole('button', { name: /create/i }).click()
  
  // STEP 2: Should navigate to FabricDesigner view
  // Wait for designer header to appear
  await expect(page.getByText('HNC Fabric Designer v0.2')).toBeVisible({ timeout: 5000 })
  
  // Verify we're in the fabric designer with form visible
  await expect(page.getByTestId('config-form')).toBeVisible()
  
  // STEP 3: Configure the fabric
  // Fill fabric name (should be auto-populated but let's be explicit)
  await page.getByTestId('fabric-name-input').fill('E2E-Test-Fabric')
  
  // Configure uplinks per leaf
  await page.getByTestId('uplinks-input').fill('2')
  
  // Configure endpoint profile (already defaults to Standard Server)
  await expect(page.getByTestId('endpoint-profile-select')).toHaveValue('Standard Server')
  
  // Configure endpoint count
  await page.getByTestId('endpoint-count-input').fill('48')
  
  // STEP 4: Compute topology
  await page.getByRole('button', { name: /Compute Topology/i }).click()
  
  // Wait for computation to complete and results to appear
  await expect(page.getByText('Computed Topology')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Leaves needed:/)).toBeVisible()
  await expect(page.getByText(/Spines needed:/)).toBeVisible()
  await expect(page.getByText(/Oversubscription ratio:/)).toBeVisible()
  
  // STEP 5: Save to FGD (button should appear after successful computation)
  await expect(page.getByRole('button', { name: /Save to FGD/i })).toBeVisible()
  await page.getByRole('button', { name: /Save to FGD/i }).click()
  
  // STEP 6: Verify save completed successfully
  await expect(page.getByText('✅ Topology saved to FGD successfully!')).toBeVisible({ timeout: 5000 })
})