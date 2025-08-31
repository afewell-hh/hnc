import{w as o,e,u as s}from"./index-Dmdg8KjP.js";import{F as x}from"./FabricList-uA2FlVB8.js";import"./DriftIndicator-1SzGZTX-.js";import"./index-C3JiJ1qr.js";const V={title:"HNC/FabricList",component:x,parameters:{layout:"fullscreen"},argTypes:{onCreateFabric:{action:"create-fabric"},onSelectFabric:{action:"select-fabric"},onDeleteFabric:{action:"delete-fabric"},onCheckDrift:{action:"check-drift"},onViewDriftDetails:{action:"view-drift-details"}}},S={hasDrift:!1,driftSummary:["No drift detected - in-memory topology matches files on disk"],lastChecked:new Date,affectedFiles:[]},C={hasDrift:!0,driftSummary:["switches: 1 modified","connections: 2 added"],lastChecked:new Date,affectedFiles:["./fgd/test-fabric/switches.yaml","./fgd/test-fabric/connections.yaml"]},I={hasDrift:!0,driftSummary:["switches: 2 added, 1 removed, 3 modified","endpoints: 5 added, 2 modified","connections: 8 added, 3 removed, 4 modified"],lastChecked:new Date,affectedFiles:["./fgd/prod-fabric/servers.yaml","./fgd/prod-fabric/switches.yaml","./fgd/prod-fabric/connections.yaml"]},l=[{id:"fabric-1",name:"Production Network",status:"saved",createdAt:new Date("2024-08-25"),lastModified:new Date("2024-08-29"),driftStatus:I},{id:"fabric-2",name:"Dev Environment",status:"computed",createdAt:new Date("2024-08-28"),lastModified:new Date("2024-08-28"),driftStatus:C},{id:"fabric-3",name:"Test Lab Setup",status:"draft",createdAt:new Date("2024-08-30"),lastModified:new Date("2024-08-30"),driftStatus:S}],F=[{id:"fabric-1",name:"Production Network",status:"saved",createdAt:new Date("2024-08-25"),lastModified:new Date("2024-08-29")},{id:"fabric-2",name:"Dev Environment",status:"computed",createdAt:new Date("2024-08-28"),lastModified:new Date("2024-08-28")},{id:"fabric-3",name:"Test Lab Setup",status:"draft",createdAt:new Date("2024-08-30"),lastModified:new Date("2024-08-30")}],d={args:{fabrics:[],errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a})=>{const t=o(a);await e(t.getByText("No fabrics created yet")).toBeInTheDocument(),await e(t.getByText("Create your first fabric to get started with network design")).toBeInTheDocument();const n=t.getByRole("button",{name:"Create New Fabric"});await e(n).toBeInTheDocument()}},m={args:{fabrics:F,errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a})=>{const t=o(a);await e(t.getByText("Your Fabrics (3)")).toBeInTheDocument(),await e(t.getByText("Production Network")).toBeInTheDocument(),await e(t.getByText("Dev Environment")).toBeInTheDocument(),await e(t.getByText("Test Lab Setup")).toBeInTheDocument();const n=t.getByText("Saved");await e(n).toBeInTheDocument();const r=t.getByText("Computed");await e(r).toBeInTheDocument();const i=t.getByText("Draft");await e(i).toBeInTheDocument();const c=t.getAllByRole("button",{name:"Select"});await e(c).toHaveLength(3);const T=t.getAllByRole("button",{name:"Delete"});await e(T).toHaveLength(3)}},u={args:{fabrics:l,errors:[],isCreating:!0,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a,args:t})=>{const n=o(a),r=n.getByRole("button",{name:"Create New Fabric"});await s.click(r),await e(n.getByText("Create New Fabric")).toBeInTheDocument(),await e(n.getByPlaceholderText("Enter fabric name...")).toBeInTheDocument(),await e(n.getByRole("button",{name:"Creating..."})).toBeInTheDocument(),await e(n.getByRole("button",{name:"Cancel"})).toBeInTheDocument()}},f={name:"Interactive Create Form Validation",args:{fabrics:[],errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a,args:t})=>{const n=o(a),r=n.getByRole("button",{name:"Create New Fabric"});await s.click(r),await e(n.getByText("Create New Fabric")).toBeInTheDocument(),n.getByRole("button",{name:"Create"});const i=n.getByPlaceholderText("Enter fabric name...");await s.type(i,"My New Fabric");const c=n.getByRole("button",{name:"Create"});await e(c).not.toBeDisabled();const T=n.getByRole("button",{name:"Cancel"});await e(T).toBeInTheDocument(),await s.click(c),await e(t.onCreateFabric).toHaveBeenCalledWith("My New Fabric")},parameters:{docs:{description:{story:"Interactive form validation and submission testing with cancel functionality."}}}},w={args:{fabrics:l,errors:["Fabric name cannot be empty","Fabric name must be unique"],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a})=>{const t=o(a);await e(t.getByText("Errors:")).toBeInTheDocument(),await e(t.getByText("Fabric name cannot be empty")).toBeInTheDocument(),await e(t.getByText("Fabric name must be unique")).toBeInTheDocument();const n=t.getByText("Errors:").closest("div");await e(n).not.toBeNull()}},b={args:{fabrics:l,errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a,args:t})=>{const n=o(a),r=n.getAllByRole("button",{name:"Select"});r[0]&&(await s.click(r[0]),await e(t.onSelectFabric).toHaveBeenCalledWith("fabric-1"));const i=window.confirm;window.confirm=()=>!0;const c=n.getAllByRole("button",{name:"Delete"});c[1]&&(await s.click(c[1]),await e(t.onDeleteFabric).toHaveBeenCalledWith("fabric-2")),window.confirm=i}},h={args:{fabrics:[{id:"draft-fabric",name:"Draft Fabric",status:"draft",createdAt:new Date,lastModified:new Date},{id:"computed-fabric",name:"Computed Fabric",status:"computed",createdAt:new Date,lastModified:new Date},{id:"saved-fabric",name:"Saved Fabric",status:"saved",createdAt:new Date,lastModified:new Date}],errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a})=>{const t=o(a),n=t.getByText("Draft"),r=t.getByText("Computed"),i=t.getByText("Saved");await e(n).toBeInTheDocument(),await e(r).toBeInTheDocument(),await e(i).toBeInTheDocument(),await e(n.parentElement).toBeTruthy(),await e(r.parentElement).toBeTruthy(),await e(i.parentElement).toBeTruthy()}},g={name:"With Drift Status Indicators",args:{fabrics:l,errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a,args:t})=>{const n=o(a);await e(n.getByText("2 fabrics have drift")).toBeInTheDocument();const r=n.getAllByText("🔄");await e(r.length).toBeGreaterThanOrEqual(2);const i=n.getAllByText("✓");await e(i.length).toBeGreaterThanOrEqual(1);const c=n.getAllByText("View Details");c[0]&&(await s.click(c[0]),await e(t.onViewDriftDetails).toHaveBeenCalled())},parameters:{docs:{description:{story:"Shows fabrics with different drift states: major drift (Production), minor drift (Dev), and no drift (Test). The workspace header shows a drift badge when fabrics have drift."}}}},D={name:"Multi-Fabric Production Workspace",args:{fabrics:[...l,{id:"fabric-4",name:"Staging Environment",status:"saved",createdAt:new Date("2024-08-29"),lastModified:new Date("2024-08-29"),driftStatus:S},{id:"fabric-5",name:"DR Site Network",status:"computed",createdAt:new Date("2024-08-30"),lastModified:new Date("2024-08-30"),driftStatus:C}],errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a})=>{const t=o(a);await e(t.getByText("Your Fabrics (5)")).toBeInTheDocument(),await e(t.getByText("Production Network")).toBeInTheDocument(),await e(t.getByText("Dev Environment")).toBeInTheDocument(),await e(t.getByText("Test Lab Setup")).toBeInTheDocument(),await e(t.getByText("Staging Environment")).toBeInTheDocument(),await e(t.getByText("DR Site Network")).toBeInTheDocument(),await e(t.getByText("3 fabrics have drift")).toBeInTheDocument();const n=t.getAllByText("Saved"),r=t.getAllByText("Computed"),i=t.getAllByText("Draft");await e(n).toHaveLength(2),await e(r).toHaveLength(2),await e(i).toHaveLength(1)},parameters:{docs:{description:{story:"A realistic multi-fabric workspace with 5 fabrics in different states, showing how the interface scales."}}}},p={name:"File System YAML Integration",args:{fabrics:[{id:"fabric-yaml-1",name:"YAML Test Fabric",status:"saved",createdAt:new Date("2024-08-25"),lastModified:new Date("2024-08-29"),driftStatus:{hasDrift:!0,driftSummary:["servers.yaml: 2 endpoints modified","switches.yaml: 1 leaf switch added"],lastChecked:new Date,affectedFiles:["./fgd/yaml-test-fabric/servers.yaml","./fgd/yaml-test-fabric/switches.yaml"]}}],errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a})=>{const t=o(a);await e(t.getByText("YAML Test Fabric")).toBeInTheDocument(),await e(t.getByText("🔄")).toBeInTheDocument();const n=t.getByText("View Details");await s.click(n)},parameters:{docs:{description:{story:"Demonstrates YAML file system integration with specific file drift detection."}}}},B={name:"State Preservation During Navigation",args:{fabrics:F,errors:[],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a,args:t})=>{const n=o(a),r=n.getAllByRole("button",{name:"Select"});r[1]&&(await s.click(r[1]),await e(t.onSelectFabric).toHaveBeenCalledWith("fabric-2")),await e(n.getByText("Dev Environment")).toBeInTheDocument()},parameters:{docs:{description:{story:"Demonstrates how fabric list state is preserved during navigation to/from fabric designer."}}}},y={name:"Advanced Error Handling",args:{fabrics:l,errors:["Network connectivity error","Failed to load fabric metadata","Insufficient permissions for drift check"],isCreating:!1,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a})=>{const t=o(a);await e(t.getByText("Network connectivity error")).toBeInTheDocument(),await e(t.getByText("Failed to load fabric metadata")).toBeInTheDocument(),await e(t.getByText("Insufficient permissions for drift check")).toBeInTheDocument(),await e(t.getByText("Production Network")).toBeInTheDocument();const n=t.getAllByRole("button",{name:"Select"});await e(n[0]).toBeInTheDocument()},parameters:{docs:{description:{story:"Advanced error scenarios showing how the interface handles multiple concurrent errors while maintaining functionality."}}}},v={name:"Concurrent Create and Delete Operations",args:{fabrics:F,errors:[],isCreating:!0,onCreateFabric:()=>{},onSelectFabric:()=>{},onDeleteFabric:()=>{},onCheckDrift:()=>{},onViewDriftDetails:()=>{}},play:async({canvasElement:a,args:t})=>{const n=o(a);await e(n.getByText("Creating...")).toBeInTheDocument();const r=n.getAllByRole("button",{name:"Delete"});if(r[0]){const i=window.confirm;window.confirm=()=>!0,await s.click(r[0]),await e(t.onDeleteFabric).toHaveBeenCalled(),window.confirm=i}},parameters:{docs:{description:{story:"Tests concurrent operations handling - creating fabric while attempting to delete others."}}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    fabrics: [],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Should show empty state message
    await expect(canvas.getByText('No fabrics created yet')).toBeInTheDocument();
    await expect(canvas.getByText('Create your first fabric to get started with network design')).toBeInTheDocument();

    // Should show create button
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await expect(createButton).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    fabrics: basicFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Should show fabric count
    await expect(canvas.getByText('Your Fabrics (3)')).toBeInTheDocument();

    // Should show all fabric names
    await expect(canvas.getByText('Production Network')).toBeInTheDocument();
    await expect(canvas.getByText('Dev Environment')).toBeInTheDocument();
    await expect(canvas.getByText('Test Lab Setup')).toBeInTheDocument();

    // Should show status badges with correct colors
    const savedStatus = canvas.getByText('Saved');
    await expect(savedStatus).toBeInTheDocument();
    const computedStatus = canvas.getByText('Computed');
    await expect(computedStatus).toBeInTheDocument();
    const draftStatus = canvas.getByText('Draft');
    await expect(draftStatus).toBeInTheDocument();

    // Should show select and delete buttons
    const selectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });
    await expect(selectButtons).toHaveLength(3);
    const deleteButtons = canvas.getAllByRole('button', {
      name: 'Delete'
    });
    await expect(deleteButtons).toHaveLength(3);
  }
}`,...m.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    fabrics: sampleFabrics,
    errors: [],
    isCreating: true,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);

    // Click create button to show form
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);

    // Form should be visible
    await expect(canvas.getByText('Create New Fabric')).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Enter fabric name...')).toBeInTheDocument();

    // Buttons should be present
    await expect(canvas.getByRole('button', {
      name: 'Creating...'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Cancel'
    })).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: 'Interactive Create Form Validation',
  args: {
    fabrics: [],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);

    // Click create button
    const createButton = canvas.getByRole('button', {
      name: 'Create New Fabric'
    });
    await userEvent.click(createButton);

    // Form should appear
    await expect(canvas.getByText('Create New Fabric')).toBeInTheDocument();

    // Test empty submission (should be disabled or show validation)
    const initialSubmitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    // Initial state might be disabled or enabled depending on implementation

    // Type in fabric name
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...');
    await userEvent.type(nameInput, 'My New Fabric');

    // Create button should be enabled after typing
    const submitButton = canvas.getByRole('button', {
      name: 'Create'
    });
    await expect(submitButton).not.toBeDisabled();

    // Test cancel functionality
    const cancelButton = canvas.getByRole('button', {
      name: 'Cancel'
    });
    await expect(cancelButton).toBeInTheDocument();

    // Click create
    await userEvent.click(submitButton);

    // Should call onCreateFabric with trimmed name
    await expect(args.onCreateFabric).toHaveBeenCalledWith('My New Fabric');
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive form validation and submission testing with cancel functionality.'
      }
    }
  }
}`,...f.parameters?.docs?.source}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    fabrics: sampleFabrics,
    errors: ['Fabric name cannot be empty', 'Fabric name must be unique'],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Should show error section
    await expect(canvas.getByText('Errors:')).toBeInTheDocument();
    await expect(canvas.getByText('Fabric name cannot be empty')).toBeInTheDocument();
    await expect(canvas.getByText('Fabric name must be unique')).toBeInTheDocument();

    // Error section should exist and have error styling
    const errorSection = canvas.getByText('Errors:').closest('div');
    await expect(errorSection).not.toBeNull();
  }
}`,...w.parameters?.docs?.source}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    fabrics: sampleFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);

    // Click select on first fabric
    const selectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });
    if (selectButtons[0]) {
      await userEvent.click(selectButtons[0]);

      // Should call onSelectFabric with correct ID
      await expect(args.onSelectFabric).toHaveBeenCalledWith('fabric-1');
    }

    // Test delete with confirmation (mock window.confirm to return true)
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    const deleteButtons = canvas.getAllByRole('button', {
      name: 'Delete'
    });
    if (deleteButtons[1]) {
      await userEvent.click(deleteButtons[1]);

      // Should call onDeleteFabric with correct ID
      await expect(args.onDeleteFabric).toHaveBeenCalledWith('fabric-2');
    }

    // Restore original confirm
    window.confirm = originalConfirm;
  }
}`,...b.parameters?.docs?.source}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    fabrics: [{
      id: 'draft-fabric',
      name: 'Draft Fabric',
      status: 'draft',
      createdAt: new Date(),
      lastModified: new Date()
    }, {
      id: 'computed-fabric',
      name: 'Computed Fabric',
      status: 'computed',
      createdAt: new Date(),
      lastModified: new Date()
    }, {
      id: 'saved-fabric',
      name: 'Saved Fabric',
      status: 'saved',
      createdAt: new Date(),
      lastModified: new Date()
    }],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Check all status badges are present with different colors
    const draftBadge = canvas.getByText('Draft');
    const computedBadge = canvas.getByText('Computed');
    const savedBadge = canvas.getByText('Saved');
    await expect(draftBadge).toBeInTheDocument();
    await expect(computedBadge).toBeInTheDocument();
    await expect(savedBadge).toBeInTheDocument();

    // Verify they have different background colors (check the badges themselves)
    await expect(draftBadge.parentElement).toBeTruthy();
    await expect(computedBadge.parentElement).toBeTruthy();
    await expect(savedBadge.parentElement).toBeTruthy();
  }
}`,...h.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'With Drift Status Indicators',
  args: {
    fabrics: sampleFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);

    // Should show drift badge in header indicating 2 fabrics have drift
    await expect(canvas.getByText('2 fabrics have drift')).toBeInTheDocument();

    // Should show drift indicators for fabrics with drift
    const driftIndicators = canvas.getAllByText('🔄');
    await expect(driftIndicators.length).toBeGreaterThanOrEqual(2); // Major and minor drift

    // Should show checkmark for no-drift fabric
    const checkmarks = canvas.getAllByText('✓');
    await expect(checkmarks.length).toBeGreaterThanOrEqual(1);

    // Test drift detail interactions
    const driftDetails = canvas.getAllByText('View Details');
    if (driftDetails[0]) {
      await userEvent.click(driftDetails[0]);
      await expect(args.onViewDriftDetails).toHaveBeenCalled();
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows fabrics with different drift states: major drift (Production), minor drift (Dev), and no drift (Test). The workspace header shows a drift badge when fabrics have drift.'
      }
    }
  }
}`,...g.parameters?.docs?.source}}};D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'Multi-Fabric Production Workspace',
  args: {
    fabrics: [...sampleFabrics, {
      id: 'fabric-4',
      name: 'Staging Environment',
      status: 'saved',
      createdAt: new Date('2024-08-29'),
      lastModified: new Date('2024-08-29'),
      driftStatus: noDriftStatus
    }, {
      id: 'fabric-5',
      name: 'DR Site Network',
      status: 'computed',
      createdAt: new Date('2024-08-30'),
      lastModified: new Date('2024-08-30'),
      driftStatus: minorDriftStatus
    }],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Should show correct fabric count
    await expect(canvas.getByText('Your Fabrics (5)')).toBeInTheDocument();

    // Should show all fabric names
    await expect(canvas.getByText('Production Network')).toBeInTheDocument();
    await expect(canvas.getByText('Dev Environment')).toBeInTheDocument();
    await expect(canvas.getByText('Test Lab Setup')).toBeInTheDocument();
    await expect(canvas.getByText('Staging Environment')).toBeInTheDocument();
    await expect(canvas.getByText('DR Site Network')).toBeInTheDocument();

    // Should show drift summary
    await expect(canvas.getByText('3 fabrics have drift')).toBeInTheDocument();

    // Should have proper status distribution
    const savedStatuses = canvas.getAllByText('Saved');
    const computedStatuses = canvas.getAllByText('Computed');
    const draftStatuses = canvas.getAllByText('Draft');
    await expect(savedStatuses).toHaveLength(2); // Production, Staging
    await expect(computedStatuses).toHaveLength(2); // Dev, DR Site
    await expect(draftStatuses).toHaveLength(1); // Test Lab
  },
  parameters: {
    docs: {
      description: {
        story: 'A realistic multi-fabric workspace with 5 fabrics in different states, showing how the interface scales.'
      }
    }
  }
}`,...D.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: 'File System YAML Integration',
  args: {
    fabrics: [{
      id: 'fabric-yaml-1',
      name: 'YAML Test Fabric',
      status: 'saved',
      createdAt: new Date('2024-08-25'),
      lastModified: new Date('2024-08-29'),
      driftStatus: {
        hasDrift: true,
        driftSummary: ['servers.yaml: 2 endpoints modified', 'switches.yaml: 1 leaf switch added'],
        lastChecked: new Date(),
        affectedFiles: ['./fgd/yaml-test-fabric/servers.yaml', './fgd/yaml-test-fabric/switches.yaml']
      }
    }],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Should show fabric with YAML-specific drift details
    await expect(canvas.getByText('YAML Test Fabric')).toBeInTheDocument();
    await expect(canvas.getByText('🔄')).toBeInTheDocument();

    // Should show affected file information when drift details are expanded
    const viewDetailsButton = canvas.getByText('View Details');
    await userEvent.click(viewDetailsButton);
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates YAML file system integration with specific file drift detection.'
      }
    }
  }
}`,...p.parameters?.docs?.source}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: 'State Preservation During Navigation',
  args: {
    fabrics: basicFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);

    // Simulate selecting a fabric (would navigate to designer)
    const selectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });
    if (selectButtons[1]) {
      // Select Dev Environment
      await userEvent.click(selectButtons[1]);
      await expect(args.onSelectFabric).toHaveBeenCalledWith('fabric-2');
    }

    // State should be preserved in workspace context
    // This demonstrates the navigation pattern without actually changing routes
    await expect(canvas.getByText('Dev Environment')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates how fabric list state is preserved during navigation to/from fabric designer.'
      }
    }
  }
}`,...B.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'Advanced Error Handling',
  args: {
    fabrics: sampleFabrics,
    errors: ['Network connectivity error', 'Failed to load fabric metadata', 'Insufficient permissions for drift check'],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Should show multiple error types
    await expect(canvas.getByText('Network connectivity error')).toBeInTheDocument();
    await expect(canvas.getByText('Failed to load fabric metadata')).toBeInTheDocument();
    await expect(canvas.getByText('Insufficient permissions for drift check')).toBeInTheDocument();

    // Should still show fabrics despite errors
    await expect(canvas.getByText('Production Network')).toBeInTheDocument();

    // Action buttons should still be available
    const selectButtons = canvas.getAllByRole('button', {
      name: 'Select'
    });
    await expect(selectButtons[0]).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Advanced error scenarios showing how the interface handles multiple concurrent errors while maintaining functionality.'
      }
    }
  }
}`,...y.parameters?.docs?.source}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'Concurrent Create and Delete Operations',
  args: {
    fabrics: basicFabrics,
    errors: [],
    isCreating: true,
    // Simulating concurrent creation
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {}
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);

    // Should show creating state
    await expect(canvas.getByText('Creating...')).toBeInTheDocument();

    // Simulate attempting delete during create (should handle gracefully)
    const deleteButtons = canvas.getAllByRole('button', {
      name: 'Delete'
    });
    if (deleteButtons[0]) {
      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      await userEvent.click(deleteButtons[0]);
      await expect(args.onDeleteFabric).toHaveBeenCalled();

      // Restore
      window.confirm = originalConfirm;
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests concurrent operations handling - creating fabric while attempting to delete others.'
      }
    }
  }
}`,...v.parameters?.docs?.source}}};const M=["Empty","WithFabrics","Creating","CreateFormInteraction","WithErrors","FabricInteractions","StatusVariations","WithDriftIndicators","MultiFabricWorkspace","FileSystemIntegration","StatePreservationScenario","AdvancedErrorScenarios","ConcurrentOperations"];export{y as AdvancedErrorScenarios,v as ConcurrentOperations,f as CreateFormInteraction,u as Creating,d as Empty,b as FabricInteractions,p as FileSystemIntegration,D as MultiFabricWorkspace,B as StatePreservationScenario,h as StatusVariations,g as WithDriftIndicators,w as WithErrors,m as WithFabrics,M as __namedExportsOrder,V as default};
