/**
 * WP-GPU1: Dual-Fabric Integration Tests
 * 
 * MISSION: Validate complete dual-fabric workflow integration
 * 
 * Integration Points:
 * - DualFabricEditor UI component integration
 * - Real-time validation feedback
 * - Cross-component communication
 * - End-to-end workflow execution
 * - Error recovery and user experience
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import type { DualFabricSpec } from '../src/domain/dual-fabric'
import { DualFabricEditor } from '../src/components/gfd/DualFabricEditor'
import { createDualFabricTemplate } from '../src/domain/dual-fabric'
import { DualFabricCompiler } from '../src/io/dual-fabric-compiler'

// Mock external dependencies
vi.mock('../src/domain/cross-fabric-validator', () => ({
  CrossFabricValidator: {
    quickValidate: vi.fn(() => ({
      nicCountMatches: true,
      noPortCollisions: true,
      independentTopology: true,
      sharedBOMRollup: true,
      validationErrors: [],
      warnings: []
    }))
  }
}))

vi.mock('../src/domain/shared-nic-allocator', () => ({
  SharedNicAllocator: {
    analyzeNicAllocation: vi.fn(() => ({
      currentAllocations: { frontend: 96, backend: 48 },
      totalServers: 24,
      totalNics: 144,
      utilizationScore: 100
    })),
    optimizeNicAllocation: vi.fn((spec) => spec)
  }
}))

// ====================================================================
// TEST FIXTURES
// ====================================================================

const createMockDualFabricSpec = (): DualFabricSpec => ({
  id: 'integration-test-spec',
  name: 'Integration Test Dual-Fabric',
  mode: 'dual-fabric',
  frontend: {
    name: 'Frontend Fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    leafClasses: [{
      id: 'compute-leaf',
      name: 'Compute Leaf',
      role: 'standard',
      uplinksPerLeaf: 4,
      endpointProfiles: [{
        name: 'GPU Server',
        portsPerEndpoint: 4,
        type: 'compute',
        bandwidth: 25,
        count: 24
      }]
    }]
  },
  backend: {
    name: 'Backend Fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    leafClasses: [{
      id: 'storage-leaf',
      name: 'Storage Leaf',
      role: 'standard',
      uplinksPerLeaf: 2,
      endpointProfiles: [{
        name: 'Storage Server',
        portsPerEndpoint: 2,
        type: 'storage',
        bandwidth: 100,
        count: 24
      }]
    }]
  },
  sharedServers: Array.from({ length: 8 }, (_, i) => ({
    id: `server-${i + 1}`,
    name: `Server-${i + 1}`,
    totalNics: 6,
    serverType: 'gpu-compute' as const,
    nicAllocations: [
      {
        nicCount: 4,
        nicSpeed: '25G',
        targetFabric: 'frontend' as const,
        purpose: 'compute' as const
      },
      {
        nicCount: 2,
        nicSpeed: '100G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }
    ]
  })),
  metadata: {
    createdAt: new Date(),
    version: '1.0.0',
    useCase: 'ai-training'
  }
})

// ====================================================================
// INTEGRATION TEST SUITE
// ====================================================================

describe('WP-GPU1: Dual-Fabric Integration Tests', () => {
  let mockSpec: DualFabricSpec
  let mockOnChange: ReturnType<typeof vi.fn>
  let mockOnCompile: ReturnType<typeof vi.fn>
  let mockOnReset: ReturnType<typeof vi.fn>
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    mockSpec = createMockDualFabricSpec()
    mockOnChange = vi.fn()
    mockOnCompile = vi.fn()
    mockOnReset = vi.fn()
    user = userEvent.setup()
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  // ================================================================
  // Component Integration Tests
  // ================================================================
  
  describe('DualFabricEditor Component Integration', () => {
    it('should render dual-fabric editor with all tabs', () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Verify main title and description
      expect(screen.getByText('Dual-Fabric Configuration')).toBeInTheDocument()
      expect(screen.getByText(/GPU\/AI use case with shared server NICs/)).toBeInTheDocument()

      // Verify all tabs are present
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Frontend Fabric')).toBeInTheDocument()
      expect(screen.getByText('Backend Fabric')).toBeInTheDocument()
      expect(screen.getByText('Shared Servers')).toBeInTheDocument()
      expect(screen.getByText('Validation')).toBeInTheDocument()
    })

    it('should display validation status badges correctly', () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Should show valid status badges (mocked to return valid)
      const validBadges = screen.getAllByText('Valid')
      expect(validBadges.length).toBeGreaterThan(0)
    })

    it('should handle fabric name changes', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      const nameInput = screen.getByDisplayValue('Integration Test Dual-Fabric')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Fabric Name')

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Fabric Name'
        })
      )
    })

    it('should handle template selection changes', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Find and click the use case selector
      const useCaseSelect = screen.getByRole('combobox')
      await user.click(useCaseSelect)
      
      // Select AI training template
      const aiTrainingOption = screen.getByText('AI Training Cluster')
      await user.click(aiTrainingOption)

      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  // ================================================================
  // Tab Navigation Integration
  // ================================================================

  describe('Tab Navigation Integration', () => {
    it('should navigate between all tabs successfully', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Test Overview tab (default)
      expect(screen.getByText('Frontend Fabric Summary')).toBeInTheDocument()

      // Navigate to Frontend Fabric tab
      await user.click(screen.getByText('Frontend Fabric'))
      await waitFor(() => {
        expect(screen.getByText('Frontend Fabric Configuration')).toBeInTheDocument()
      })

      // Navigate to Backend Fabric tab
      await user.click(screen.getByText('Backend Fabric'))
      await waitFor(() => {
        expect(screen.getByText('Backend Fabric Configuration')).toBeInTheDocument()
      })

      // Navigate to Shared Servers tab
      await user.click(screen.getByText('Shared Servers'))
      await waitFor(() => {
        expect(screen.getByText('Shared Servers Configuration')).toBeInTheDocument()
      })

      // Navigate to Validation tab
      await user.click(screen.getByText('Validation'))
      await waitFor(() => {
        expect(screen.getByText('Overall Validation Status')).toBeInTheDocument()
      })
    })

    it('should maintain state across tab switches', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Change name in overview
      const nameInput = screen.getByDisplayValue('Integration Test Dual-Fabric')
      await user.clear(nameInput)
      await user.type(nameInput, 'State Test Fabric')

      // Switch tabs
      await user.click(screen.getByText('Frontend Fabric'))
      await user.click(screen.getByText('Overview'))

      // Name should be preserved
      expect(screen.getByDisplayValue('State Test Fabric')).toBeInTheDocument()
    })
  })

  // ================================================================
  // Server Management Integration
  // ================================================================

  describe('Server Management Integration', () => {
    it('should display all shared servers with correct information', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Navigate to servers tab
      await user.click(screen.getByText('Shared Servers'))

      // Should show correct server count
      expect(screen.getByText('Servers (8)')).toBeInTheDocument()

      // Should show all servers
      for (let i = 1; i <= 8; i++) {
        expect(screen.getByText(`Server-${i}`)).toBeInTheDocument()
      }
    })

    it('should handle server selection and NIC allocation editing', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Navigate to servers tab
      await user.click(screen.getByText('Shared Servers'))

      // Click on first server
      await user.click(screen.getByText('Server-1'))

      // Should show NIC allocation editor
      await waitFor(() => {
        expect(screen.getByText('NIC Allocation - Server-1')).toBeInTheDocument()
      })
    })

    it('should handle adding new servers', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Navigate to servers tab
      await user.click(screen.getByText('Shared Servers'))

      // Click add server button
      const addButton = screen.getByText('Add Server')
      await user.click(addButton)

      // Should call onChange with new server
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sharedServers: expect.arrayContaining([
            expect.objectContaining({
              name: 'Server-9' // Next server number
            })
          ])
        })
      )
    })

    it('should handle removing servers', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Navigate to servers tab
      await user.click(screen.getByText('Shared Servers'))

      // Find and click remove button for first server
      const removeButtons = screen.getAllByText('Remove')
      await user.click(removeButtons[0])

      // Should call onChange with server removed
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sharedServers: expect.arrayContaining([
            expect.not.objectContaining({
              name: 'Server-1'
            })
          ])
        })
      )
    })
  })

  // ================================================================
  // Real-time Validation Integration
  // ================================================================

  describe('Real-time Validation Integration', () => {
    it('should update validation status in real-time', async () => {
      const { rerender } = render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Should show valid status initially
      expect(screen.getAllByText('Valid').length).toBeGreaterThan(0)

      // Mock validation failure
      const invalidSpec = {
        ...mockSpec,
        sharedServers: [] // No servers = invalid
      }

      // Mock the validator to return invalid
      const mockValidator = require('../src/domain/cross-fabric-validator')
      mockValidator.CrossFabricValidator.quickValidate.mockReturnValue({
        nicCountMatches: false,
        noPortCollisions: false,
        independentTopology: false,
        sharedBOMRollup: false,
        validationErrors: ['No shared servers defined'],
        warnings: []
      })

      // Re-render with invalid spec
      rerender(
        <DualFabricEditor
          spec={invalidSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Should show invalid status
      expect(screen.getAllByText('Invalid').length).toBeGreaterThan(0)
    })

    it('should display validation errors prominently', async () => {
      const invalidSpec = {
        ...mockSpec,
        sharedServers: []
      }

      // Mock validation with errors
      const mockValidator = require('../src/domain/cross-fabric-validator')
      mockValidator.CrossFabricValidator.quickValidate.mockReturnValue({
        nicCountMatches: false,
        noPortCollisions: true,
        independentTopology: false,
        sharedBOMRollup: false,
        validationErrors: ['No shared servers defined', 'Invalid NIC allocation'],
        warnings: ['Consider optimizing configuration']
      })

      render(
        <DualFabricEditor
          spec={invalidSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
          validationErrors={['No shared servers defined', 'Invalid NIC allocation']}
        />
      )

      // Should show validation error alert
      expect(screen.getByText('Validation Errors:')).toBeInTheDocument()
      expect(screen.getByText('No shared servers defined')).toBeInTheDocument()
      expect(screen.getByText('Invalid NIC allocation')).toBeInTheDocument()
    })
  })

  // ================================================================
  // Compilation Integration
  // ================================================================

  describe('Compilation Integration', () => {
    it('should handle successful compilation', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Find and click compile button
      const compileButton = screen.getByText('Compile Dual Fabric')
      expect(compileButton).not.toBeDisabled()

      await user.click(compileButton)

      expect(mockOnCompile).toHaveBeenCalled()
    })

    it('should disable compile button when validation fails', async () => {
      // Mock validation failure
      const mockValidator = require('../src/domain/cross-fabric-validator')
      mockValidator.CrossFabricValidator.quickValidate.mockReturnValue({
        nicCountMatches: false,
        noPortCollisions: false,
        independentTopology: false,
        sharedBOMRollup: false,
        validationErrors: ['Critical validation error'],
        warnings: []
      })

      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      const compileButton = screen.getByText('Compile Dual Fabric')
      expect(compileButton).toBeDisabled()
    })

    it('should show compilation progress state', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
          isComputing={true}
        />
      )

      expect(screen.getByText('Compiling...')).toBeInTheDocument()
    })
  })

  // ================================================================
  // Template Integration
  // ================================================================

  describe('Template Integration', () => {
    it('should load AI training template correctly', async () => {
      const aiTrainingTemplate = createDualFabricTemplate('ai-training') as DualFabricSpec

      render(
        <DualFabricEditor
          spec={aiTrainingTemplate}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      expect(screen.getByText('AI Training Cluster')).toBeInTheDocument()
      expect(screen.getByText('Compute Fabric')).toBeInTheDocument()
      expect(screen.getByText('Storage Fabric')).toBeInTheDocument()
    })

    it('should load GPU rendering template correctly', async () => {
      const renderingTemplate = createDualFabricTemplate('gpu-rendering') as DualFabricSpec

      render(
        <DualFabricEditor
          spec={renderingTemplate}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      expect(screen.getByText('GPU Rendering Farm')).toBeInTheDocument()
      expect(screen.getByText('Render Fabric')).toBeInTheDocument()
      expect(screen.getByText('Asset Fabric')).toBeInTheDocument()
    })

    it('should load HPC template correctly', async () => {
      const hpcTemplate = createDualFabricTemplate('hpc') as DualFabricSpec

      render(
        <DualFabricEditor
          spec={hpcTemplate}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      expect(screen.getByText('HPC Cluster')).toBeInTheDocument()
      expect(screen.getByText('Management Fabric')).toBeInTheDocument()
    })
  })

  // ================================================================
  // Error Recovery Integration
  // ================================================================

  describe('Error Recovery Integration', () => {
    it('should handle reset functionality', async () => {
      render(
        <DualFabricEditor
          spec={mockSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Find and click reset button
      const resetButton = screen.getByText('Reset')
      await user.click(resetButton)

      expect(mockOnReset).toHaveBeenCalled()
    })

    it('should maintain usable state during validation errors', async () => {
      const invalidSpec = {
        ...mockSpec,
        sharedServers: []
      }

      render(
        <DualFabricEditor
          spec={invalidSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Even with validation errors, UI should remain functional
      expect(screen.getByText('Add Server')).toBeInTheDocument()
      expect(screen.getByText('Reset')).toBeInTheDocument()

      // Should be able to navigate tabs
      await user.click(screen.getByText('Frontend Fabric'))
      expect(screen.getByText('Frontend Fabric Configuration')).toBeInTheDocument()
    })

    it('should provide helpful guidance for error states', async () => {
      const emptyServersSpec = {
        ...mockSpec,
        sharedServers: []
      }

      render(
        <DualFabricEditor
          spec={emptyServersSpec}
          onChange={mockOnChange}
          onCompile={mockOnCompile}
          onReset={mockOnReset}
        />
      )

      // Navigate to servers tab
      await user.click(screen.getByText('Shared Servers'))

      // Should show guidance for empty state
      expect(screen.getByText('Add Server')).toBeInTheDocument()
    })
  })
})

// ====================================================================
// PERFORMANCE INTEGRATION TESTS
// ====================================================================

describe('Performance Integration Tests', () => {
  it('should handle large server configurations efficiently', async () => {
    const user = userEvent.setup()
    const largeSpec = createMockDualFabricSpec()
    largeSpec.sharedServers = Array.from({ length: 100 }, (_, i) => ({
      id: `server-${i + 1}`,
      name: `Server-${String(i + 1).padStart(3, '0')}`,
      totalNics: 8,
      serverType: 'gpu-compute' as const,
      nicAllocations: [
        {
          nicCount: 6,
          nicSpeed: '25G',
          targetFabric: 'frontend' as const,
          purpose: 'compute' as const
        },
        {
          nicCount: 2,
          nicSpeed: '100G',
          targetFabric: 'backend' as const,
          purpose: 'storage' as const
        }
      ]
    }))

    const startTime = performance.now()

    render(
      <DualFabricEditor
        spec={largeSpec}
        onChange={vi.fn()}
        onCompile={vi.fn()}
        onReset={vi.fn()}
      />
    )

    const renderTime = performance.now() - startTime

    // Should render large configuration within reasonable time
    expect(renderTime).toBeLessThan(1000) // 1 second

    // Should show correct server count
    await user.click(screen.getByText('Shared Servers'))
    expect(screen.getByText('Servers (100)')).toBeInTheDocument()
  }, 10000)

  it('should update validation efficiently for configuration changes', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()

    render(
      <DualFabricEditor
        spec={createMockDualFabricSpec()}
        onChange={mockOnChange}
        onCompile={vi.fn()}
        onReset={vi.fn()}
      />
    )

    const startTime = performance.now()

    // Make multiple rapid changes
    const nameInput = screen.getByDisplayValue('Integration Test Dual-Fabric')
    await user.clear(nameInput)
    await user.type(nameInput, 'Performance Test Fabric')

    const updateTime = performance.now() - startTime

    // Should handle updates efficiently
    expect(updateTime).toBeLessThan(500) // 500ms
    expect(mockOnChange).toHaveBeenCalled()
  })
})