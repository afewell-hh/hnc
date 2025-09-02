import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { VPCEditor, type VPCConfig } from '../../../src/components/editors/VPCEditor'

describe('VPCEditor', () => {
  const mockOnChange = vi.fn()
  const mockOnValidate = vi.fn()

  const sampleVPC: VPCConfig = {
    metadata: {
      name: 'test-vpc',
      labels: { env: 'test' },
      annotations: { 'created-by': 'test' }
    },
    spec: {
      defaultIsolated: false,
      defaultRestricted: false,
      ipv4Namespace: 'default',
      vlanNamespace: 'default',
      mode: 'default',
      subnets: {
        'web': {
          name: 'web',
          cidr: '10.1.1.0/24',
          gateway: '10.1.1.1',
          isolated: false,
          restricted: false
        }
      },
      permit: [],
      staticRoutes: []
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders VPC editor with basic settings', () => {
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    expect(screen.getByText('VPC Configuration')).toBeInTheDocument()
    expect(screen.getByTestId('vpc-name-input')).toHaveValue('test-vpc')
    expect(screen.getByTestId('ipv4-namespace-input')).toHaveValue('default')
    expect(screen.getByTestId('vlan-namespace-input')).toHaveValue('default')
  })

  it('renders default VPC when no VPC provided', () => {
    render(
      <VPCEditor 
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    expect(screen.getByTestId('vpc-name-input')).toHaveValue('vpc-1')
    expect(screen.getByTestId('ipv4-namespace-input')).toHaveValue('default')
  })

  it('handles VPC name changes', async () => {
    const user = userEvent.setup()
    
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    const nameInput = screen.getByTestId('vpc-name-input')
    await user.clear(nameInput)
    await user.type(nameInput, 'updated-vpc')

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'updated-vpc'
          })
        })
      )
    })
  })

  it('handles subnet management', async () => {
    const user = userEvent.setup()
    
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    // Switch to subnets tab
    const subnetsTab = screen.getByText('Subnets')
    await user.click(subnetsTab)

    expect(screen.getByText('web')).toBeInTheDocument()

    // Add a new subnet
    const addSubnetButton = screen.getByTestId('add-subnet-button')
    await user.click(addSubnetButton)

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            subnets: expect.objectContaining({
              'subnet-2': expect.any(Object)
            })
          })
        })
      )
    })
  })

  it('handles static route management', async () => {
    const user = userEvent.setup()
    
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    // Switch to routing tab
    const routingTab = screen.getByText('Static Routes')
    await user.click(routingTab)

    // Add a static route
    const addRouteButton = screen.getByTestId('add-static-route-button')
    await user.click(addRouteButton)

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            staticRoutes: expect.arrayContaining([
              expect.objectContaining({
                destination: '0.0.0.0/0',
                nextHop: '10.1.0.1'
              })
            ])
          })
        })
      )
    })
  })

  it('validates VPC configuration', async () => {
    const invalidVPC = {
      ...sampleVPC,
      metadata: { ...sampleVPC.metadata, name: '' }, // Invalid: empty name
      spec: {
        ...sampleVPC.spec,
        subnets: {
          'invalid': {
            name: 'invalid',
            cidr: 'invalid-cidr', // Invalid CIDR format
            gateway: 'invalid-ip', // Invalid IP format
            isolated: false,
            restricted: false
          }
        }
      }
    }

    render(
      <VPCEditor 
        vpc={invalidVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalledWith(
        false,
        expect.arrayContaining([
          'VPC name is required',
          'Invalid CIDR format for subnet invalid',
          'Invalid gateway IP for subnet invalid'
        ])
      )
    })

    expect(screen.getByText('Validation Errors:')).toBeInTheDocument()
  })

  it('handles checkbox toggles', async () => {
    const user = userEvent.setup()
    
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    const isolatedCheckbox = screen.getByTestId('default-isolated-checkbox')
    await user.click(isolatedCheckbox)

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            defaultIsolated: true
          })
        })
      )
    })
  })

  it('renders in readonly mode', () => {
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
        readonly={true}
      />
    )

    const nameInput = screen.getByTestId('vpc-name-input')
    expect(nameInput).toBeDisabled()

    const isolatedCheckbox = screen.getByTestId('default-isolated-checkbox')
    expect(isolatedCheckbox).toBeDisabled()
  })

  it('shows correct tab content when switching tabs', async () => {
    const user = userEvent.setup()
    
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    // Initially on basic settings
    expect(screen.getByText('VPC Name:')).toBeInTheDocument()

    // Switch to subnets
    const subnetsTab = screen.getByText('Subnets')
    await user.click(subnetsTab)
    expect(screen.getByText('Add Subnet')).toBeInTheDocument()

    // Switch to routing
    const routingTab = screen.getByText('Static Routes')
    await user.click(routingTab)
    expect(screen.getByText('Add Route')).toBeInTheDocument()

    // Switch to policies
    const policiesTab = screen.getByText('Access Policies')
    await user.click(policiesTab)
    expect(screen.getByText('Access Control Policies')).toBeInTheDocument()
  })

  it('updates subnet properties', async () => {
    const user = userEvent.setup()
    
    render(
      <VPCEditor 
        vpc={sampleVPC}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    // Switch to subnets tab
    const subnetsTab = screen.getByText('Subnets')
    await user.click(subnetsTab)

    // Update subnet CIDR
    const subnetCidr = screen.getByTestId('subnet-web-cidr')
    await user.clear(subnetCidr)
    await user.type(subnetCidr, '10.2.1.0/24')

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            subnets: expect.objectContaining({
              'web': expect.objectContaining({
                cidr: '10.2.1.0/24'
              })
            })
          })
        })
      )
    })
  })

  it('removes subnets correctly', async () => {
    const vpcWithMultipleSubnets = {
      ...sampleVPC,
      spec: {
        ...sampleVPC.spec,
        subnets: {
          'web': sampleVPC.spec.subnets.web,
          'app': {
            name: 'app',
            cidr: '10.1.2.0/24',
            gateway: '10.1.2.1',
            isolated: false,
            restricted: false
          }
        }
      }
    }

    const user = userEvent.setup()
    
    render(
      <VPCEditor 
        vpc={vpcWithMultipleSubnets}
        onChange={mockOnChange}
        onValidate={mockOnValidate}
      />
    )

    // Switch to subnets tab
    const subnetsTab = screen.getByText('Subnets')
    await user.click(subnetsTab)

    // Remove app subnet
    const removeButton = screen.getByTestId('remove-subnet-app')
    await user.click(removeButton)

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            subnets: expect.not.objectContaining({
              'app': expect.any(Object)
            })
          })
        })
      )
    })
  })
})