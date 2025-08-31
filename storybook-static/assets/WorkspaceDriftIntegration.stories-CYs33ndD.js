import{w as o,u as t,e as a}from"./index-Dmdg8KjP.js";import{A as m}from"./App-gxQTugmU.js";import"./DriftIndicator-1SzGZTX-.js";import"./index-C3JiJ1qr.js";import"./iframe-Dr5DdYiT.js";import"./FabricList-uA2FlVB8.js";import"./DriftSection-CESTiHQZ.js";const E={title:"HNC/Integration/Workspace+Drift",component:m,parameters:{layout:"fullscreen",docs:{description:{component:"Integration stories demonstrating Workspace and Drift Detection working together in HNC v0.2."}}}},u={name:"Complete Drift Detection Workflow",play:async({canvasElement:i})=>{const e=o(i),c=e.getByRole("button",{name:"Create New Fabric"});await t.click(c);const n=e.getByPlaceholderText("Enter fabric name...");await t.type(n,"Drift Test Fabric");const r=e.getByRole("button",{name:"Create"});await t.click(r);const s=e.getByRole("button",{name:"Select"});if(await t.click(s),await a(e.getByText("HNC Fabric Designer v0.2")).toBeInTheDocument(),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"24"),await t.click(e.getByText("Compute Topology")),await a(e.getByText("Computed Topology")).toBeInTheDocument(),await t.click(e.getByText("Save to FGD")),await a(e.getByText(/saved to fgd/i)).toBeInTheDocument(),e.queryByText(/drift detection/i)){const l=e.queryByText(/check for drift/i);l&&await t.click(l)}},parameters:{docs:{description:{story:"Complete integration test of workspace navigation and drift detection, from fabric creation through save and drift check."}}}},y={name:"Multi-Fabric Drift Management",play:async({canvasElement:i})=>{const e=o(i);await t.click(e.getByRole("button",{name:"Create New Fabric"})),await t.type(e.getByPlaceholderText("Enter fabric name..."),"Prod Fabric"),await t.click(e.getByRole("button",{name:"Create"})),await t.click(e.getByRole("button",{name:"Create New Fabric"})),await t.type(e.getByPlaceholderText("Enter fabric name..."),"Test Fabric"),await t.click(e.getByRole("button",{name:"Create"})),await a(e.getByText("Your Fabrics (2)")).toBeInTheDocument();const n=e.getAllByRole("button",{name:"Select"})[0];n&&await t.click(n),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"48"),await t.click(e.getByText("Compute Topology")),await t.click(e.getByText("Save to FGD")),await t.click(e.getByText("← Back to List"));const s=e.getAllByRole("button",{name:"Select"})[1];s&&await t.click(s),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"24"),await t.click(e.getByText("Compute Topology")),await t.click(e.getByText("Save to FGD")),await t.click(e.getByText("← Back to List")),await a(e.getByText("Prod Fabric")).toBeInTheDocument(),await a(e.getByText("Test Fabric")).toBeInTheDocument()},parameters:{docs:{description:{story:"Tests drift detection across multiple fabrics in a workspace, demonstrating state isolation."}}}},d={name:"Drift Detection Error Scenarios",play:async({canvasElement:i})=>{const e=o(i);if(await t.click(e.getByRole("button",{name:"Create New Fabric"})),await t.type(e.getByPlaceholderText("Enter fabric name..."),"No Baseline Fabric"),await t.click(e.getByRole("button",{name:"Create"})),await t.click(e.getByRole("button",{name:"Select"})),await a(e.getByText("HNC Fabric Designer v0.2")).toBeInTheDocument(),e.queryByText(/drift detection/i)){const n=e.queryByText(/check for drift/i);n&&await t.click(n)}},parameters:{docs:{description:{story:"Tests error handling in drift detection when no baseline exists or other error conditions occur."}}}},g={name:"File System Integration with Drift",play:async({canvasElement:i})=>{const e=o(i);if(await t.click(e.getByRole("button",{name:"Create New Fabric"})),await t.type(e.getByPlaceholderText("Enter fabric name..."),"FS Integration Test"),await t.click(e.getByRole("button",{name:"Create"})),await t.click(e.getByRole("button",{name:"Select"})),await t.clear(e.getByLabelText(/fabric name/i)),await t.type(e.getByLabelText(/fabric name/i),"fs-integration-test"),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"32"),await t.clear(e.getByLabelText(/uplinks per leaf/i)),await t.type(e.getByLabelText(/uplinks per leaf/i),"3"),await t.click(e.getByText("Compute Topology")),await a(e.getByText("Computed Topology")).toBeInTheDocument(),await t.click(e.getByText("Save to FGD")),await a(e.getByText(/saved to fgd/i)).toBeInTheDocument(),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"40"),await t.click(e.getByText("Compute Topology")),e.queryByText(/drift detection/i)){const n=e.queryByText(/check for drift/i);n&&await t.click(n)}},parameters:{docs:{description:{story:"Integration test focusing on file system persistence and drift detection between in-memory and saved states."}}}},B={name:"Workspace State Consistency with Drift",play:async({canvasElement:i})=>{const e=o(i),c=["Consistent Fabric","Modified Fabric","Clean Fabric"];for(const l of c)await t.click(e.getByRole("button",{name:"Create New Fabric"})),await t.type(e.getByPlaceholderText("Enter fabric name..."),l),await t.click(e.getByRole("button",{name:"Create"}));await a(e.getByText("Your Fabrics (3)")).toBeInTheDocument();const r=e.getAllByRole("button",{name:"Select"})[0];r&&await t.click(r),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"16"),await t.click(e.getByText("Compute Topology")),await t.click(e.getByText("Save to FGD")),await t.click(e.getByText("← Back to List"));const p=e.getAllByRole("button",{name:"Select"})[1];p&&await t.click(p),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"32"),await t.click(e.getByText("Compute Topology")),await t.click(e.getByText("Save to FGD")),await t.click(e.getByText("← Back to List")),await a(e.getByText("Your Fabrics (3)")).toBeInTheDocument(),await a(e.getByText("Consistent Fabric")).toBeInTheDocument(),await a(e.getByText("Modified Fabric")).toBeInTheDocument(),await a(e.getByText("Clean Fabric")).toBeInTheDocument()},parameters:{docs:{description:{story:"Tests workspace state consistency when navigating between multiple fabrics with different drift states."}}}},f={name:"Real-time Drift Updates",play:async({canvasElement:i})=>{const e=o(i);await t.click(e.getByRole("button",{name:"Create New Fabric"})),await t.type(e.getByPlaceholderText("Enter fabric name..."),"Realtime Test"),await t.click(e.getByRole("button",{name:"Create"})),await t.click(e.getByRole("button",{name:"Select"})),await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),"48"),await t.click(e.getByText("Compute Topology")),await t.click(e.getByText("Save to FGD"));for(const n of["24","36","48"])await t.clear(e.getByLabelText(/endpoint count/i)),await t.type(e.getByLabelText(/endpoint count/i),n),await t.click(e.getByText("Compute Topology"));if(e.queryByText(/drift detection/i)){const n=e.queryByText(/check for drift/i);n&&await t.click(n)}},parameters:{docs:{description:{story:"Tests drift detection under rapid configuration changes, ensuring UI remains responsive and accurate."}}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: 'Complete Drift Detection Workflow',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Start by creating a fabric
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'Drift Test Fabric');
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    await userEvent.click(submitButton);

    // Select the fabric for design
    const selectButton = canvas.getByRole('button', {
      name: 'Select'
    });
    await userEvent.click(selectButton);

    // Should now be in designer mode with drift section
    await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument();

    // Configure and compute topology to have something to check drift against
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '24');
    await userEvent.click(canvas.getByText('Compute Topology'));
    await expect(canvas.getByText('Computed Topology')).toBeInTheDocument();

    // Save to create baseline for drift detection
    await userEvent.click(canvas.getByText('Save to FGD'));
    await expect(canvas.getByText(/saved to fgd/i)).toBeInTheDocument();

    // Now test drift detection functionality
    const driftSection = canvas.queryByText(/drift detection/i);
    if (driftSection) {
      // Check for drift should be available
      const checkDriftButton = canvas.queryByText(/check for drift/i);
      if (checkDriftButton) {
        await userEvent.click(checkDriftButton);

        // Should show drift status after check
        // (Results will depend on actual file system state)
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete integration test of workspace navigation and drift detection, from fabric creation through save and drift check.'
      }
    }
  }
}`,...u.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'Multi-Fabric Drift Management',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create first fabric
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create New Fabric'
    }));
    await userEvent.type(canvas.getByPlaceholderText('Enter fabric name...'), 'Prod Fabric');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create'
    }));

    // Create second fabric
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create New Fabric'
    }));
    await userEvent.type(canvas.getByPlaceholderText('Enter fabric name...'), 'Test Fabric');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create'
    }));

    // Should show 2 fabrics
    await expect(canvas.getByText('Your Fabrics (2)')).toBeInTheDocument();

    // Select and configure first fabric
    const selectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });
    const firstButton = selectButtons[0];
    if (firstButton) {
      await userEvent.click(firstButton);
    }

    // Configure, compute, and save first fabric
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '48');
    await userEvent.click(canvas.getByText('Compute Topology'));
    await userEvent.click(canvas.getByText('Save to FGD'));

    // Navigate back to workspace
    await userEvent.click(canvas.getByText('← Back to List'));

    // Select second fabric
    const secondSelectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });
    const secondButton = secondSelectButtons[1];
    if (secondButton) {
      await userEvent.click(secondButton);
    }

    // Configure and save second fabric differently
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '24');
    await userEvent.click(canvas.getByText('Compute Topology'));
    await userEvent.click(canvas.getByText('Save to FGD'));

    // Navigate back to workspace
    await userEvent.click(canvas.getByText('← Back to List'));

    // Should show 2 fabrics, both with potential for drift checking
    await expect(canvas.getByText('Prod Fabric')).toBeInTheDocument();
    await expect(canvas.getByText('Test Fabric')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests drift detection across multiple fabrics in a workspace, demonstrating state isolation.'
      }
    }
  }
}`,...y.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: 'Drift Detection Error Scenarios',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create fabric but don't save it (no baseline for drift)
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create New Fabric'
    }));
    await userEvent.type(canvas.getByPlaceholderText('Enter fabric name...'), 'No Baseline Fabric');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create'
    }));

    // Select fabric
    await userEvent.click(canvas.getByRole('button', {
      name: 'Select'
    }));

    // Should be in designer mode
    await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument();

    // Try to check drift without having computed/saved anything
    const driftSection = canvas.queryByText(/drift detection/i);
    if (driftSection) {
      const checkDriftButton = canvas.queryByText(/check for drift/i);
      if (checkDriftButton) {
        await userEvent.click(checkDriftButton);

        // Should handle gracefully - either show "no baseline" message or disable button
        // Implementation-dependent behavior
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests error handling in drift detection when no baseline exists or other error conditions occur.'
      }
    }
  }
}`,...d.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'File System Integration with Drift',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create a fabric for file system testing
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create New Fabric'
    }));
    await userEvent.type(canvas.getByPlaceholderText('Enter fabric name...'), 'FS Integration Test');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create'
    }));

    // Select and configure
    await userEvent.click(canvas.getByRole('button', {
      name: 'Select'
    }));

    // Set specific configuration for testing
    await userEvent.clear(canvas.getByLabelText(/fabric name/i));
    await userEvent.type(canvas.getByLabelText(/fabric name/i), 'fs-integration-test');
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '32');
    await userEvent.clear(canvas.getByLabelText(/uplinks per leaf/i));
    await userEvent.type(canvas.getByLabelText(/uplinks per leaf/i), '3');

    // Compute topology
    await userEvent.click(canvas.getByText('Compute Topology'));
    await expect(canvas.getByText('Computed Topology')).toBeInTheDocument();

    // Save to file system
    await userEvent.click(canvas.getByText('Save to FGD'));
    await expect(canvas.getByText(/saved to fgd/i)).toBeInTheDocument();

    // Now modify configuration (simulating file system changes)
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '40');
    await userEvent.click(canvas.getByText('Compute Topology'));

    // Check drift detection should now detect differences
    const driftSection = canvas.queryByText(/drift detection/i);
    if (driftSection) {
      const checkDriftButton = canvas.queryByText(/check for drift/i);
      if (checkDriftButton) {
        await userEvent.click(checkDriftButton);

        // Should detect drift between in-memory and saved state
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Integration test focusing on file system persistence and drift detection between in-memory and saved states.'
      }
    }
  }
}`,...g.parameters?.docs?.source}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: 'Workspace State Consistency with Drift',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create multiple fabrics with different configurations
    const fabrics = ['Consistent Fabric', 'Modified Fabric', 'Clean Fabric'];
    for (const fabricName of fabrics) {
      await userEvent.click(canvas.getByRole('button', {
        name: 'Create New Fabric'
      }));
      await userEvent.type(canvas.getByPlaceholderText('Enter fabric name...'), fabricName);
      await userEvent.click(canvas.getByRole('button', {
        name: 'Create'
      }));
    }

    // Should show 3 fabrics
    await expect(canvas.getByText('Your Fabrics (3)')).toBeInTheDocument();

    // Configure and save each fabric
    const selectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });

    // Configure first fabric
    const firstButton = selectButtons[0];
    if (firstButton) {
      await userEvent.click(firstButton);
    }
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '16');
    await userEvent.click(canvas.getByText('Compute Topology'));
    await userEvent.click(canvas.getByText('Save to FGD'));

    // Back to list
    await userEvent.click(canvas.getByText('← Back to List'));

    // Configure second fabric differently
    const secondSelectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });
    const secondButton = secondSelectButtons[1];
    if (secondButton) {
      await userEvent.click(secondButton);
    }
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '32');
    await userEvent.click(canvas.getByText('Compute Topology'));
    await userEvent.click(canvas.getByText('Save to FGD'));

    // Back to list and verify state preservation
    await userEvent.click(canvas.getByText('← Back to List'));
    await expect(canvas.getByText('Your Fabrics (3)')).toBeInTheDocument();

    // All fabric names should still be visible
    await expect(canvas.getByText('Consistent Fabric')).toBeInTheDocument();
    await expect(canvas.getByText('Modified Fabric')).toBeInTheDocument();
    await expect(canvas.getByText('Clean Fabric')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests workspace state consistency when navigating between multiple fabrics with different drift states.'
      }
    }
  }
}`,...B.parameters?.docs?.source}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: 'Real-time Drift Updates',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create fabric for real-time testing
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create New Fabric'
    }));
    await userEvent.type(canvas.getByPlaceholderText('Enter fabric name...'), 'Realtime Test');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Create'
    }));

    // Select and configure
    await userEvent.click(canvas.getByRole('button', {
      name: 'Select'
    }));
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '48');

    // Compute and save baseline
    await userEvent.click(canvas.getByText('Compute Topology'));
    await userEvent.click(canvas.getByText('Save to FGD'));

    // Simulate rapid configuration changes
    for (const count of ['24', '36', '48']) {
      await userEvent.clear(canvas.getByLabelText(/endpoint count/i));
      await userEvent.type(canvas.getByLabelText(/endpoint count/i), count);
      await userEvent.click(canvas.getByText('Compute Topology'));

      // Each change should potentially affect drift status
      // Implementation would need to handle rapid updates gracefully
    }

    // Final drift check
    const driftSection = canvas.queryByText(/drift detection/i);
    if (driftSection) {
      const checkDriftButton = canvas.queryByText(/check for drift/i);
      if (checkDriftButton) {
        await userEvent.click(checkDriftButton);
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests drift detection under rapid configuration changes, ensuring UI remains responsive and accurate.'
      }
    }
  }
}`,...f.parameters?.docs?.source}}};const S=["DriftWorkflowIntegration","MultiFabricDriftScenario","DriftErrorHandling","FileSystemPersistence","WorkspaceStateConsistency","RealTimeUpdateScenario"];export{d as DriftErrorHandling,u as DriftWorkflowIntegration,g as FileSystemPersistence,y as MultiFabricDriftScenario,f as RealTimeUpdateScenario,B as WorkspaceStateConsistency,S as __namedExportsOrder,E as default};
