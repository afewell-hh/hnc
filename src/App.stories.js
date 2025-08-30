import { within, userEvent, expect } from '@storybook/test';
import App from './App';
const meta = {
    title: 'HNC/App',
    component: App,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: 'HNC v0.2 multi-fabric workspace application. Routes between fabric list and individual fabric designer based on workspace state.'
            }
        }
    },
};
export default meta;
// Workspace-level stories
export const EmptyWorkspace = {
    name: 'Empty Workspace - No Fabrics',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Should show empty workspace state
        await expect(canvas.getByText('No fabrics created yet')).toBeInTheDocument();
        await expect(canvas.getByText('Create your first fabric to get started with network design')).toBeInTheDocument();
        // Should have create button available
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await expect(createButton).toBeInTheDocument();
        await expect(createButton).toBeEnabled();
    },
    parameters: {
        docs: {
            description: {
                story: 'Initial state when no fabrics exist. Shows empty workspace with create fabric prompt.'
            }
        }
    }
};
export const WithFabricsListing = {
    name: 'Workspace with Multiple Fabrics',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Create first fabric
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Production Network');
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        // Should show fabric list with the new fabric
        await expect(canvas.getByText('Your Fabrics (1)')).toBeInTheDocument();
        await expect(canvas.getByText('Production Network')).toBeInTheDocument();
        await expect(canvas.getByText('Draft')).toBeInTheDocument();
    },
    parameters: {
        docs: {
            description: {
                story: 'Workspace showing fabric list with created fabrics. Demonstrates fabric creation flow and listing.'
            }
        }
    }
};
export const FabricDesignSelected = {
    name: 'Single Fabric Design Mode',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Create a fabric first
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Test Fabric');
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        // Select the fabric for design
        const selectButton = canvas.getByRole('button', { name: 'Select' });
        await userEvent.click(selectButton);
        // Should now be in fabric designer mode
        await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument();
        await expect(canvas.getByText('← Back to List')).toBeInTheDocument();
        await expect(canvas.getByLabelText(/fabric name/i)).toHaveValue('Test Fabric');
        await expect(canvas.getByText('Compute Topology')).toBeEnabled();
    },
    parameters: {
        docs: {
            description: {
                story: 'Fabric designer mode showing single fabric configuration and compute interface. Includes navigation back to workspace.'
            }
        }
    }
};
export const CreateNewFabricFlow = {
    name: 'Create New Fabric Workflow',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Start with create button
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        // Should show create form
        await expect(canvas.getByText('Create New Fabric')).toBeInTheDocument();
        // Type fabric name
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Development Environment');
        // Submit form
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        // Verify fabric appears in list
        await expect(canvas.getByText('Development Environment')).toBeInTheDocument();
        await expect(canvas.getByText('Draft')).toBeInTheDocument();
        // Should have action buttons
        await expect(canvas.getByRole('button', { name: 'Select' })).toBeInTheDocument();
        await expect(canvas.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    },
    parameters: {
        docs: {
            description: {
                story: 'Complete workflow for creating a new fabric from empty workspace to fabric list.'
            }
        }
    }
};
export const NavigationFlow = {
    name: 'Workspace Navigation Flow',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Create and select fabric
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Navigation Test');
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        // Select for design
        const selectButton = canvas.getByRole('button', { name: 'Select' });
        await userEvent.click(selectButton);
        // Should be in designer
        await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument();
        // Navigate back to list
        const backButton = canvas.getByText('← Back to List');
        await userEvent.click(backButton);
        // Should be back in workspace list
        await expect(canvas.getByText('Your Fabrics (1)')).toBeInTheDocument();
        await expect(canvas.getByText('Navigation Test')).toBeInTheDocument();
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates navigation between workspace fabric list and individual fabric designer.'
            }
        }
    }
};
export const DriftDetectionWorkflow = {
    name: 'Workspace with Drift Detection',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Create fabric and enter design mode
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Drift Test Fabric');
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        const selectButton = canvas.getByRole('button', { name: 'Select' });
        await userEvent.click(selectButton);
        // Should show drift section in designer
        await expect(canvas.getByText(/drift detection/i)).toBeInTheDocument();
        await expect(canvas.getByText(/check for drift/i)).toBeInTheDocument();
    },
    parameters: {
        docs: {
            description: {
                story: 'Shows drift detection functionality integrated into the fabric designer workflow.'
            }
        }
    }
};
export const ErrorStatesWorkspace = {
    name: 'Workspace Error States',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Try to create fabric with empty name
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        // Submit without typing anything
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        // Should show error
        await expect(canvas.getByText('Fabric name cannot be empty')).toBeInTheDocument();
        // Try with valid name
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Valid Name');
        await userEvent.click(submitButton);
        // Error should clear and fabric should be created
        await expect(canvas.queryByText('Fabric name cannot be empty')).not.toBeInTheDocument();
        await expect(canvas.getByText('Valid Name')).toBeInTheDocument();
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates error handling in the workspace, including validation errors and recovery.'
            }
        }
    }
};
// Legacy v0.1 compatibility stories (updated for workspace context)
export const LegacyComputedPreview = {
    name: 'v0.1 Compatibility - Computed Preview',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Create fabric first (v0.2 requirement)
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Legacy Test');
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        // Select fabric for design
        const selectButton = canvas.getByRole('button', { name: 'Select' });
        await userEvent.click(selectButton);
        // Now perform v0.1 compute workflow
        await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
        await userEvent.type(canvas.getByLabelText(/endpoint count/i), '24');
        await userEvent.click(canvas.getByText('Compute Topology'));
        // Verify computed results
        await expect(canvas.getByText('Computed Topology')).toBeInTheDocument();
        await expect(canvas.getByText('Save to FGD')).toBeEnabled();
    },
    parameters: {
        docs: {
            description: {
                story: 'Legacy v0.1 compute workflow wrapped in v0.2 workspace context for backward compatibility.'
            }
        }
    }
};
export const LegacyInvalidUplinks = {
    name: 'v0.1 Compatibility - Invalid Uplinks',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Setup fabric in workspace
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Validation Test');
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        const selectButton = canvas.getByRole('button', { name: 'Select' });
        await userEvent.click(selectButton);
        // Test validation - set invalid uplinks
        await userEvent.clear(canvas.getByLabelText(/uplinks per leaf/i));
        await userEvent.type(canvas.getByLabelText(/uplinks per leaf/i), '5');
        await userEvent.click(canvas.getByText('Compute Topology'));
        // Should show validation error
        await expect(canvas.getByText(/uplinks per leaf must be/i)).toBeInTheDocument();
    },
    parameters: {
        docs: {
            description: {
                story: 'Legacy v0.1 validation error handling in v0.2 workspace context.'
            }
        }
    }
};
export const LegacySaveAfterCompute = {
    name: 'v0.1 Compatibility - Save After Compute',
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Workspace setup
        const createButton = canvas.getByRole('button', { name: 'Create New Fabric' });
        await userEvent.click(createButton);
        const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
        await userEvent.type(nameInput, 'Save Test');
        const submitButton = canvas.getByRole('button', { name: 'Create' });
        await userEvent.click(submitButton);
        const selectButton = canvas.getByRole('button', { name: 'Select' });
        await userEvent.click(selectButton);
        // Perform compute and save workflow
        await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
        await userEvent.type(canvas.getByLabelText(/endpoint count/i), '16');
        await userEvent.click(canvas.getByText('Compute Topology'));
        await userEvent.click(canvas.getByText('Save to FGD'));
        // Verify save success
        await expect(canvas.getByText(/saved to fgd/i)).toBeInTheDocument();
    },
    parameters: {
        docs: {
            description: {
                story: 'Legacy v0.1 save workflow in v0.2 workspace context, demonstrating backward compatibility.'
            }
        }
    }
};
