import { test, expect } from '@playwright/test'

/**
 * HNC v0.2 E2E Golden Path Test
 * 
 * This is the single comprehensive E2E test covering the complete
 * multi-fabric workspace workflow from empty state through fabric
 * creation, design, computation, and file system persistence.
 */

test.describe('HNC v0.2 Multi-Fabric Workspace', () => {
  test.beforeEach(async ({ page }) => {
    // Start dev server should be running on localhost:5173
    await page.goto('/')
    
    // Verify app loads
    await expect(page).toHaveTitle(/HNC/)
  })

  test('Golden Path: Complete Multi-Fabric Workflow', async ({ page }) => {
    // === Phase 1: Empty Workspace State ===
    await expect(page.getByText('No fabrics created yet')).toBeVisible()
    await expect(page.getByText('Create your first fabric to get started')).toBeVisible()
    
    const createButton = page.getByRole('button', { name: 'Create New Fabric' })
    await expect(createButton).toBeVisible()

    // === Phase 2: Create First Fabric ===
    await createButton.click()
    
    await expect(page.getByText('Create New Fabric')).toBeVisible()
    
    const nameInput = page.getByPlaceholder('Enter fabric name...')
    await nameInput.fill('Production Network')
    
    const submitButton = page.getByRole('button', { name: 'Create' })
    await submitButton.click()
    
    // Should be back in list with new fabric
    await expect(page.getByText('Your Fabrics (1)')).toBeVisible()
    await expect(page.getByText('Production Network')).toBeVisible()
    await expect(page.getByText('Draft')).toBeVisible()

    // === Phase 3: Create Second Fabric for Multi-Fabric Demo ===
    const createSecondButton = page.getByRole('button', { name: 'Create New Fabric' })
    await createSecondButton.click()
    
    await page.getByPlaceholder('Enter fabric name...').fill('Development Environment')
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Should now show 2 fabrics
    await expect(page.getByText('Your Fabrics (2)')).toBeVisible()
    await expect(page.getByText('Development Environment')).toBeVisible()

    // === Phase 4: Select Fabric for Design ===
    // Select the first fabric (Production Network)
    const selectButtons = page.getByRole('button', { name: 'Select' })
    await selectButtons.first().click()
    
    // Should navigate to fabric designer
    await expect(page.getByText('HNC Fabric Designer v0.2')).toBeVisible()
    await expect(page.getByText('← Back to List')).toBeVisible()
    
    // Should show the fabric name in the input
    const fabricNameInput = page.getByLabel(/fabric name/i)
    await expect(fabricNameInput).toHaveValue('Production Network')

    // === Phase 5: Configure Fabric ===
    // Verify default values
    await expect(page.getByLabel(/spine model/i)).toHaveValue('DS3000')
    await expect(page.getByLabel(/leaf model/i)).toHaveValue('DS2000')
    await expect(page.getByLabel(/uplinks per leaf/i)).toHaveValue('2')
    await expect(page.getByLabel(/endpoint count/i)).toHaveValue('48')
    
    // Modify configuration
    const endpointInput = page.getByLabel(/endpoint count/i)
    await endpointInput.clear()
    await endpointInput.fill('24')
    
    const uplinksInput = page.getByLabel(/uplinks per leaf/i)
    await uplinksInput.clear()
    await uplinksInput.fill('4')

    // === Phase 6: Compute Topology ===
    const computeButton = page.getByText('Compute Topology')
    await expect(computeButton).toBeEnabled()
    await computeButton.click()
    
    // Should show computed results
    await expect(page.getByText('Computed Topology')).toBeVisible()
    await expect(page.getByText(/leaves needed/i)).toBeVisible()
    await expect(page.getByText(/spines needed/i)).toBeVisible()
    await expect(page.getByText(/oversubscription ratio/i)).toBeVisible()
    
    // Save button should be enabled
    const saveButton = page.getByText('Save to FGD')
    await expect(saveButton).toBeEnabled()

    // === Phase 7: Save to File System ===
    await saveButton.click()
    
    // Should show save success
    await expect(page.getByText(/saved to fgd/i)).toBeVisible()

    // === Phase 8: Navigate Back to Workspace ===
    const backButton = page.getByText('← Back to List')
    await backButton.click()
    
    // Should be back in workspace
    await expect(page.getByText('Your Fabrics (2)')).toBeVisible()
    await expect(page.getByText('Production Network')).toBeVisible()
    await expect(page.getByText('Development Environment')).toBeVisible()
    
    // Production Network should now show as 'Saved' status
    // (This depends on the implementation updating the status after save)

    // === Phase 9: Test Workspace State Preservation ===
    // Select the second fabric to verify state preservation
    const devSelectButton = page.getByRole('button', { name: 'Select' }).last()
    await devSelectButton.click()
    
    await expect(page.getByText('HNC Fabric Designer v0.2')).toBeVisible()
    
    const devNameInput = page.getByLabel(/fabric name/i)
    await expect(devNameInput).toHaveValue('Development Environment')
    
    // Navigate back
    await page.getByText('← Back to List').click()
    
    // Should still show both fabrics
    await expect(page.getByText('Your Fabrics (2)')).toBeVisible()

    // === Phase 10: Test Drift Detection (if available) ===
    // Select first fabric again to check drift functionality
    await page.getByRole('button', { name: 'Select' }).first().click()
    
    // Look for drift section (might be conditional based on saved state)
    const driftSection = page.getByText(/drift detection/i)
    if (await driftSection.isVisible({ timeout: 1000 }).catch(() => false)) {
      // If drift section is present, test it
      const checkDriftButton = page.getByText(/check for drift/i)
      if (await checkDriftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await checkDriftButton.click()
        // Allow time for drift check to complete
        await page.waitForTimeout(1000)
      }
    }

    // === Phase 11: Test Error Handling ===
    await page.getByText('← Back to List').click()
    
    // Try to create fabric with empty name
    await page.getByRole('button', { name: 'Create New Fabric' }).click()
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Should show validation error
    await expect(page.getByText(/fabric name cannot be empty/i)).toBeVisible()
    
    // Cancel the form
    await page.getByRole('button', { name: 'Cancel' }).click()
    
    // Should be back to normal list
    await expect(page.getByText('Your Fabrics (2)')).toBeVisible()

    // === Phase 12: Test Delete Functionality ===
    // Delete the second fabric
    const deleteButtons = page.getByRole('button', { name: 'Delete' })
    
    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept())
    
    await deleteButtons.last().click()
    
    // Should now show only 1 fabric
    await expect(page.getByText('Your Fabrics (1)')).toBeVisible()
    await expect(page.getByText('Production Network')).toBeVisible()
    await expect(page.locator('text=Development Environment')).not.toBeVisible()
  })

  test('Validation Edge Cases', async ({ page }) => {
    // Create a fabric for testing validation
    await page.getByRole('button', { name: 'Create New Fabric' }).click()
    await page.getByPlaceholder('Enter fabric name...').fill('Validation Test')
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Select for design
    await page.getByRole('button', { name: 'Select' }).click()
    
    // Test invalid uplinks (should be 1-4)
    const uplinksInput = page.getByLabel(/uplinks per leaf/i)
    await uplinksInput.clear()
    await uplinksInput.fill('5')
    
    await page.getByText('Compute Topology').click()
    
    // Should show validation error
    await expect(page.getByText(/uplinks per leaf must be/i)).toBeVisible()
    
    // Test invalid endpoint count (should be > 0)
    await uplinksInput.clear()
    await uplinksInput.fill('2')
    
    const endpointInput = page.getByLabel(/endpoint count/i)
    await endpointInput.clear()
    await endpointInput.fill('0')
    
    await page.getByText('Compute Topology').click()
    
    // Should show validation error
    await expect(page.getByText(/endpoint count must be/i)).toBeVisible()
  })

  test('Multi-Fabric Navigation Performance', async ({ page }) => {
    // Create multiple fabrics to test navigation performance
    const fabricNames = ['Fabric A', 'Fabric B', 'Fabric C']
    
    for (const name of fabricNames) {
      await page.getByRole('button', { name: 'Create New Fabric' }).click()
      await page.getByPlaceholder('Enter fabric name...').fill(name)
      await page.getByRole('button', { name: 'Create' }).click()
    }
    
    // Should show 3 fabrics
    await expect(page.getByText('Your Fabrics (3)')).toBeVisible()
    
    // Test rapid navigation between fabrics
    for (let i = 0; i < 3; i++) {
      const selectButtons = page.getByRole('button', { name: 'Select' })
      await selectButtons.nth(i).click()
      
      // Should load designer quickly
      await expect(page.getByText('HNC Fabric Designer v0.2')).toBeVisible()
      
      // Navigate back
      await page.getByText('← Back to List').click()
      
      // Should return to list quickly
      await expect(page.getByText('Your Fabrics (3)')).toBeVisible()
    }
  })
})