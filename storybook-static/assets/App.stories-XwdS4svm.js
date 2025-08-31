import{w as s,e as a,u as t}from"./index-Dmdg8KjP.js";import{A as h}from"./App-gxQTugmU.js";import"./DriftIndicator-1SzGZTX-.js";import"./index-C3JiJ1qr.js";import"./iframe-Dr5DdYiT.js";import"./FabricList-uA2FlVB8.js";import"./DriftSection-CESTiHQZ.js";const R={title:"HNC/App",component:h,parameters:{layout:"fullscreen",docs:{description:{component:"HNC v0.2 multi-fabric workspace application. Routes between fabric list and individual fabric designer based on workspace state."}}},tags:["ci"]},l={name:"Empty Workspace - No Fabrics",play:async({canvasElement:n})=>{const e=s(n);await a(e.getByText("No fabrics created yet")).toBeInTheDocument(),await a(e.getByText("Create your first fabric to get started with network design")).toBeInTheDocument();const o=e.getByRole("button",{name:"Create New Fabric"});await a(o).toBeInTheDocument(),await a(o).toBeEnabled()},parameters:{docs:{description:{story:"Initial state when no fabrics exist. Shows empty workspace with create fabric prompt."}}}},m={name:"Workspace with Multiple Fabrics",play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("button",{name:"Create New Fabric"});await t.click(o);const i=e.getByPlaceholderText("Enter fabric name...");await t.type(i,"Production Network");const c=e.getByRole("button",{name:"Create"});await t.click(c),await a(e.getByText("Your Fabrics (1)")).toBeInTheDocument(),await a(e.getByText("Production Network")).toBeInTheDocument(),await a(e.getByText("Draft")).toBeInTheDocument()},parameters:{docs:{description:{story:"Workspace showing fabric list with created fabrics. Demonstrates fabric creation flow and listing."}}}},p={name:"Single Fabric Design Mode",play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("button",{name:"Create New Fabric"});await t.click(o);const i=e.getByPlaceholderText("Enter fabric name...");await t.type(i,"Test Fabric");const c=e.getByRole("button",{name:"Create"});await t.click(c);const r=e.getByRole("button",{name:"Select"});await t.click(r),await a(e.getByText("HNC Fabric Designer v0.2")).toBeInTheDocument(),await a(e.getByText("← Back to List")).toBeInTheDocument();const u=e.getByDisplayValue("");await a(u).toBeInTheDocument(),await a(e.getByText("Compute Topology")).toBeEnabled()},parameters:{docs:{description:{story:"Fabric designer mode showing single fabric configuration and compute interface. Includes navigation back to workspace."}}}},w={name:"Create New Fabric Workflow",play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("button",{name:"Create New Fabric"});await t.click(o),await a(e.getByText("Create New Fabric")).toBeInTheDocument();const i=e.getByPlaceholderText("Enter fabric name...");await t.type(i,"Development Environment");const c=e.getByRole("button",{name:"Create"});await t.click(c),await a(e.getByText("Development Environment")).toBeInTheDocument(),await a(e.getByText("Draft")).toBeInTheDocument(),await a(e.getByRole("button",{name:"Select"})).toBeInTheDocument(),await a(e.getByRole("button",{name:"Delete"})).toBeInTheDocument()},parameters:{docs:{description:{story:"Complete workflow for creating a new fabric from empty workspace to fabric list."}}}},d={name:"Workspace Navigation Flow",play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("button",{name:"Create New Fabric"});await t.click(o);const i=e.getByPlaceholderText("Enter fabric name...");await t.type(i,"Navigation Test");const c=e.getByRole("button",{name:"Create"});await t.click(c);const r=e.getByRole("button",{name:"Select"});await t.click(r),await a(e.getByText("HNC Fabric Designer v0.2")).toBeInTheDocument();const u=e.getByText("← Back to List");await t.click(u),await a(e.getByText("Your Fabrics (1)")).toBeInTheDocument(),await a(e.getByText("Navigation Test")).toBeInTheDocument()},parameters:{docs:{description:{story:"Demonstrates navigation between workspace fabric list and individual fabric designer."}}}},y={name:"Workspace with Drift Detection",play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("button",{name:"Create New Fabric"});await t.click(o);const i=e.getByPlaceholderText("Enter fabric name...");await t.type(i,"Drift Test Fabric");const c=e.getByRole("button",{name:"Create"});await t.click(c);const r=e.getByRole("button",{name:"Select"});await t.click(r),await a(e.getByText("HNC Fabric Designer v0.2")).toBeInTheDocument(),await a(e.getByText("Drift Status")).toBeInTheDocument(),await a(e.getByRole("button",{name:"Check for Drift"})).toBeInTheDocument()},parameters:{docs:{description:{story:"Shows drift detection functionality integrated into the fabric designer workflow."}}}},B={name:"Workspace Error States",play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("button",{name:"Create New Fabric"});await t.click(o);const i=e.getByRole("button",{name:"Create"});await a(i).toBeDisabled();const c=e.getByPlaceholderText("Enter fabric name...");await t.type(c,"Valid Name"),await a(i).toBeEnabled(),await t.click(i),await a(e.getByText("Valid Name")).toBeInTheDocument()},parameters:{docs:{description:{story:"Demonstrates error handling in the workspace, including validation errors and recovery."}}}},f=async n=>{const e=await n.queryByRole("button",{name:/Create.*Fabric/i});if(e){await t.click(e);const i=await n.findByPlaceholderText("Enter fabric name...");await t.clear(i),await t.type(i,"v01"),await t.click(await n.findByRole("button",{name:/^Create$/i}))}const o=await n.findByRole("button",{name:"Select"});await t.click(o),await n.findByRole("combobox",{name:/Leaf model/i}),await t.selectOptions(await n.findByRole("combobox",{name:/Leaf model/i}),await n.findByRole("option",{name:/^DS2000$/i})),await n.findByRole("spinbutton",{name:/Uplinks per leaf/i}),await n.findByRole("button",{name:/Compute/i}),await n.findByTestId("fabric-name-input"),await n.findByTestId("uplinks-input"),await n.findByTestId("endpoint-count-input")},b={name:"v0.1 Compatibility - Computed Preview",tags:["ci"],play:async({canvasElement:n})=>{const e=s(n);await f(e);const o=await e.findByTestId("uplinks-input");await t.clear(o),await t.type(o,"4");const i=await e.findByTestId("endpoint-count-input");await t.clear(i),await t.type(i,"100"),await t.click(await e.findByRole("button",{name:/Compute/i})),await a(await e.findByText(/leaves needed:/i)).toBeInTheDocument(),await a(await e.findByText(/spines needed:/i)).toBeInTheDocument()},parameters:{docs:{description:{story:"Legacy v0.1 compute workflow with stable selectors and proper navigation."}}}},v={name:"v0.1 Compatibility - Invalid Uplinks",play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("button",{name:"Create New Fabric"});await t.click(o);const i=e.getByPlaceholderText("Enter fabric name...");await t.type(i,"Validation Test");const c=e.getByRole("button",{name:"Create"});await t.click(c);const r=e.getByRole("button",{name:"Select"});await t.click(r);const u=e.getByDisplayValue("2");await t.clear(u),await t.type(u,"5"),await t.click(e.getByText("Compute Topology"));const T=e.getAllByText(/uplinks per leaf must be/i);await a(T.length).toBeGreaterThan(0)},parameters:{docs:{description:{story:"Legacy v0.1 validation error handling in v0.2 workspace context."}}}},g={name:"v0.1 Compatibility - Save After Compute",tags:["ci"],play:async({canvasElement:n})=>{const e=s(n);await f(e),await t.clear(await e.findByTestId("uplinks-input")),await t.type(await e.findByTestId("uplinks-input"),"4"),await t.clear(await e.findByTestId("endpoint-count-input")),await t.type(await e.findByTestId("endpoint-count-input"),"100"),await t.click(await e.findByRole("button",{name:/Compute/i})),await a(await e.findByText(/leaves needed:/i)).toBeInTheDocument(),await a(await e.findByText(/spines needed:/i)).toBeInTheDocument(),await t.click(await e.findByRole("button",{name:/Save.*FGD/i})),await a(await e.findByText(/saved to fgd successfully/i)).toBeInTheDocument()},parameters:{docs:{description:{story:"Legacy v0.1 save workflow with stable selectors and proper save verification."}}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: 'Empty Workspace - No Fabrics',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Should show empty workspace state
    await expect(canvas.getByText('No fabrics created yet')).toBeInTheDocument();
    await expect(canvas.getByText('Create your first fabric to get started with network design')).toBeInTheDocument();

    // Should have create button available
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
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
}`,...l.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: 'Workspace with Multiple Fabrics',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create first fabric
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'Production Network');
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
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
}`,...m.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: 'Single Fabric Design Mode',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create a fabric first
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'Test Fabric');
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    await userEvent.click(submitButton);

    // Select the fabric for design
    const selectButton = canvas.getByRole('button', {
      name: 'Select'
    });
    await userEvent.click(selectButton);

    // Should now be in fabric designer mode
    await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument();
    await expect(canvas.getByText('← Back to List')).toBeInTheDocument();
    // The fabric name input should be empty initially in designer mode
    const fabricNameInput = canvas.getByDisplayValue('');
    await expect(fabricNameInput).toBeInTheDocument();
    await expect(canvas.getByText('Compute Topology')).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story: 'Fabric designer mode showing single fabric configuration and compute interface. Includes navigation back to workspace.'
      }
    }
  }
}`,...p.parameters?.docs?.source}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'Create New Fabric Workflow',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Start with create button
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);

    // Should show create form
    await expect(canvas.getByText('Create New Fabric')).toBeInTheDocument();

    // Type fabric name
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'Development Environment');

    // Submit form
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    await userEvent.click(submitButton);

    // Verify fabric appears in list
    await expect(canvas.getByText('Development Environment')).toBeInTheDocument();
    await expect(canvas.getByText('Draft')).toBeInTheDocument();

    // Should have action buttons
    await expect(canvas.getByRole('button', {
      name: 'Select'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Delete'
    })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete workflow for creating a new fabric from empty workspace to fabric list.'
      }
    }
  }
}`,...w.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: 'Workspace Navigation Flow',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create and select fabric
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'Navigation Test');
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    await userEvent.click(submitButton);

    // Select for design
    const selectButton = canvas.getByRole('button', {
      name: 'Select'
    });
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
}`,...d.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'Workspace with Drift Detection',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Create fabric and enter design mode
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
    const selectButton = canvas.getByRole('button', {
      name: 'Select'
    });
    await userEvent.click(selectButton);

    // Should show drift section in designer
    await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument();
    await expect(canvas.getByText('Drift Status')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Check for Drift'
    })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows drift detection functionality integrated into the fabric designer workflow.'
      }
    }
  }
}`,...y.parameters?.docs?.source}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: 'Workspace Error States',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Try to create fabric with empty name
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);

    // Submit button should be disabled when input is empty
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    await expect(submitButton).toBeDisabled();

    // Try with valid name
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'Valid Name');

    // Button should now be enabled
    await expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    // Fabric should be created and appear in list
    await expect(canvas.getByText('Valid Name')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates error handling in the workspace, including validation errors and recovery.'
      }
    }
  }
}`,...B.parameters?.docs?.source}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: 'v0.1 Compatibility - Computed Preview',
  tags: ['ci'],
  play: async ({
    canvasElement
  }) => {
    const c = within(canvasElement);
    await ensureFabricAndConfig(c);
    const upl = await c.findByTestId('uplinks-input');
    await userEvent.clear(upl);
    await userEvent.type(upl, '4');
    const count = await c.findByTestId('endpoint-count-input');
    await userEvent.clear(count);
    await userEvent.type(count, '100');
    await userEvent.click(await c.findByRole('button', {
      name: /Compute/i
    }));
    await expect(await c.findByText(/leaves needed:/i)).toBeInTheDocument();
    await expect(await c.findByText(/spines needed:/i)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Legacy v0.1 compute workflow with stable selectors and proper navigation.'
      }
    }
  }
}`,...b.parameters?.docs?.source}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'v0.1 Compatibility - Invalid Uplinks',
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Setup fabric in workspace
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'Validation Test');
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    await userEvent.click(submitButton);
    const selectButton = canvas.getByRole('button', {
      name: 'Select'
    });
    await userEvent.click(selectButton);

    // Test validation - set invalid uplinks (odd number)
    const uplinksInput = canvas.getByDisplayValue('2');
    await userEvent.clear(uplinksInput);
    await userEvent.type(uplinksInput, '5');
    await userEvent.click(canvas.getByText('Compute Topology'));

    // Should show validation error (use getAllBy since there might be multiple)
    const errorElements = canvas.getAllByText(/uplinks per leaf must be/i);
    await expect(errorElements.length).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story: 'Legacy v0.1 validation error handling in v0.2 workspace context.'
      }
    }
  }
}`,...v.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'v0.1 Compatibility - Save After Compute',
  tags: ['ci'],
  play: async ({
    canvasElement
  }) => {
    const c = within(canvasElement);
    await ensureFabricAndConfig(c);
    await userEvent.clear(await c.findByTestId('uplinks-input'));
    await userEvent.type(await c.findByTestId('uplinks-input'), '4');
    await userEvent.clear(await c.findByTestId('endpoint-count-input'));
    await userEvent.type(await c.findByTestId('endpoint-count-input'), '100');
    await userEvent.click(await c.findByRole('button', {
      name: /Compute/i
    }));
    await expect(await c.findByText(/leaves needed:/i)).toBeInTheDocument();
    await expect(await c.findByText(/spines needed:/i)).toBeInTheDocument();
    await userEvent.click(await c.findByRole('button', {
      name: /Save.*FGD/i
    }));
    await expect(await c.findByText(/saved to fgd successfully/i)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Legacy v0.1 save workflow with stable selectors and proper save verification.'
      }
    }
  }
}`,...g.parameters?.docs?.source}}};const S=["EmptyWorkspace","WithFabricsListing","FabricDesignSelected","CreateNewFabricFlow","NavigationFlow","DriftDetectionWorkflow","ErrorStatesWorkspace","LegacyComputedPreview","LegacyInvalidUplinks","LegacySaveAfterCompute"];export{w as CreateNewFabricFlow,y as DriftDetectionWorkflow,l as EmptyWorkspace,B as ErrorStatesWorkspace,p as FabricDesignSelected,b as LegacyComputedPreview,v as LegacyInvalidUplinks,g as LegacySaveAfterCompute,d as NavigationFlow,m as WithFabricsListing,S as __namedExportsOrder,R as default};
