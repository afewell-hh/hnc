import{j as e,D as N,a as W}from"./DriftIndicator-1SzGZTX-.js";import{D as f}from"./DriftSection-CESTiHQZ.js";import{r as z}from"./index-C3JiJ1qr.js";function _({fabrics:t,onGetDriftStatus:a,onSelectFabric:c,onRefreshAll:u}){const[d,h]=z.useState(new Map),[P,$]=z.useState(!1);z.useEffect(()=>{const r=new Map;t.forEach(o=>{r.set(o.id,{fabricId:o.id,fabricName:o.name,driftStatus:null,isLoading:!1})}),h(r)},[t]);const p=async r=>{h(o=>{const n=new Map(o),s=n.get(r);return s&&n.set(r,{...s,isLoading:!0}),n});try{const o=await a(r);h(n=>{const s=new Map(n),m=s.get(r);return m&&s.set(r,{...m,driftStatus:o,isLoading:!1}),s})}catch{h(n=>{const s=new Map(n),m=s.get(r);return m&&s.set(r,{...m,isLoading:!1}),s})}},O=async()=>{$(!0);try{await Promise.all(t.map(r=>p(r.id))),u?.()}finally{$(!1)}},A=Array.from(d.values()).filter(r=>r.driftStatus?.hasDrift),G=Array.from(d.values()).filter(r=>r.driftStatus&&!r.driftStatus.hasDrift),E=Array.from(d.values()).filter(r=>!r.driftStatus&&!r.isLoading);return e.jsxs("div",{style:{border:"1px solid #e0e0e0",borderRadius:"8px",backgroundColor:"white",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"1rem",backgroundColor:"#f5f5f5",borderBottom:"1px solid #e0e0e0",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[e.jsx("h3",{style:{margin:0,color:"#333"},children:"Fabric Drift Status"}),e.jsx("button",{onClick:O,disabled:P,style:{padding:"0.5rem 1rem",backgroundColor:"#1976d2",color:"white",border:"none",borderRadius:"4px",cursor:"pointer",fontSize:"0.9rem"},children:P?"Checking All...":"Check All"})]}),e.jsxs("div",{style:{padding:"1rem"},children:[t.length===0&&e.jsx("p",{style:{color:"#666",textAlign:"center",margin:0},children:"No fabrics available to check for drift"}),A.length>0&&e.jsxs("div",{style:{marginBottom:"1.5rem"},children:[e.jsxs("h4",{style:{margin:"0 0 0.5rem 0",color:"#f57c00"},children:["⚠️ Fabrics with Drift (",A.length,")"]}),A.map(r=>e.jsx(T,{info:r,onCheck:()=>p(r.fabricId),onSelect:c},r.fabricId))]}),G.length>0&&e.jsxs("div",{style:{marginBottom:"1.5rem"},children:[e.jsxs("h4",{style:{margin:"0 0 0.5rem 0",color:"#4caf50"},children:["✅ Fabrics without Drift (",G.length,")"]}),G.map(r=>e.jsx(T,{info:r,onCheck:()=>p(r.fabricId),onSelect:c,compact:!0},r.fabricId))]}),E.length>0&&e.jsxs("div",{children:[e.jsxs("h4",{style:{margin:"0 0 0.5rem 0",color:"#666"},children:["❓ Unchecked Fabrics (",E.length,")"]}),E.map(r=>e.jsx(T,{info:r,onCheck:()=>p(r.fabricId),onSelect:c,showCheckButton:!0},r.fabricId))]})]})]})}function T({info:t,onCheck:a,onSelect:c,compact:u=!1,showCheckButton:d=!1}){return e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:u?"0.5rem":"0.75rem",marginBottom:"0.5rem",border:"1px solid #e0e0e0",borderRadius:"4px",backgroundColor:"#fafafa"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem",flex:1},children:[e.jsx("span",{style:{fontSize:"1.2rem",color:q(t)},children:U(t)}),e.jsxs("div",{children:[e.jsx("div",{style:{fontWeight:500,color:"#333"},children:t.fabricName}),e.jsx("div",{style:{fontSize:"0.8rem",color:"#666"},children:t.fabricId}),t.driftStatus&&!u&&e.jsx("div",{style:{fontSize:"0.8rem",color:"#666",marginTop:"0.25rem"},children:t.driftStatus.hasDrift?`${t.driftStatus.driftSummary.length} changes detected`:`No drift (checked ${t.driftStatus.lastChecked.toLocaleTimeString()})`})]})]}),e.jsxs("div",{style:{display:"flex",gap:"0.5rem",alignItems:"center"},children:[d&&e.jsx("button",{onClick:a,disabled:t.isLoading,style:{padding:"0.25rem 0.5rem",fontSize:"0.8rem",border:"1px solid #ddd",borderRadius:"4px",backgroundColor:"white",cursor:"pointer"},children:t.isLoading?"Checking...":"Check"}),!d&&e.jsx("button",{onClick:a,disabled:t.isLoading,style:{padding:"0.25rem 0.5rem",fontSize:"0.8rem",border:"none",backgroundColor:"transparent",cursor:"pointer",color:"#1976d2"},children:"Refresh"}),c&&e.jsx("button",{onClick:()=>c(t.fabricId),style:{padding:"0.25rem 0.5rem",fontSize:"0.8rem",border:"1px solid #1976d2",borderRadius:"4px",backgroundColor:"#1976d2",color:"white",cursor:"pointer"},children:"Select"})]})]})}function U(t){return t.isLoading?"🔄":t.driftStatus?t.driftStatus.hasDrift?"⚠️":"✅":"❓"}function q(t){return t.isLoading?"#1976d2":t.driftStatus?t.driftStatus.hasDrift?"#f57c00":"#4caf50":"#666"}const L={hasDrift:!1,driftSummary:["No drift detected - in-memory topology matches files on disk"],lastChecked:new Date,affectedFiles:[]},l={hasDrift:!0,driftSummary:["switches: 1 modified","connections: 2 added"],lastChecked:new Date,affectedFiles:["./fgd/test-fabric/switches.yaml","./fgd/test-fabric/connections.yaml"]},V={hasDrift:!0,driftSummary:["switches: 2 added, 1 removed, 3 modified","endpoints: 5 added, 2 modified","connections: 8 added, 3 removed, 4 modified"],lastChecked:new Date,affectedFiles:["./fgd/prod-fabric/servers.yaml","./fgd/prod-fabric/switches.yaml","./fgd/prod-fabric/connections.yaml"]},i={onRefreshDrift:()=>console.log("Refreshing drift..."),onShowDetails:()=>console.log("Showing drift details..."),onClick:()=>console.log("Drift indicator clicked"),onGetDriftStatus:async t=>(console.log(`Getting drift status for ${t}`),await new Promise(a=>setTimeout(a,1e3)),t.includes("drift")?V:t.includes("minor")?l:L),onSelectFabric:t=>console.log(`Selecting fabric: ${t}`)},Q={title:"Drift/FabricDriftStatus",component:N,parameters:{layout:"padded",docs:{description:{component:"Components for displaying fabric drift status and detection results"}}}},g={name:"Indicator - No Drift",args:{driftStatus:L,isChecking:!1,onClick:i.onClick}},S={name:"Indicator - Minor Drift",args:{driftStatus:l,isChecking:!1,onClick:i.onClick}},D={name:"Indicator - Major Drift",args:{driftStatus:V,isChecking:!1,onClick:i.onClick}},b={name:"Indicator - Checking",args:{driftStatus:null,isChecking:!0,onClick:i.onClick,compact:!0}},x={name:"Indicator - Compact Mode",args:{driftStatus:l,isChecking:!1,onClick:i.onClick,compact:!0}},k={name:"Badge - No Drift",render:()=>e.jsx(W,{driftCount:0,onClick:i.onClick})},C={name:"Badge - Single Fabric",render:()=>e.jsx(W,{driftCount:1,onClick:i.onClick})},y={name:"Badge - Multiple Fabrics",render:()=>e.jsx(W,{driftCount:3,onClick:i.onClick})},j={name:"Section - No Status",render:()=>e.jsx("div",{style:{maxWidth:"600px"},children:e.jsx(f,{fabricId:"test-fabric",driftStatus:null,onRefreshDrift:i.onRefreshDrift,onShowDetails:i.onShowDetails,isRefreshing:!1})})},F={name:"Section - No Drift",render:()=>e.jsx("div",{style:{maxWidth:"600px"},children:e.jsx(f,{fabricId:"test-fabric",driftStatus:L,onRefreshDrift:i.onRefreshDrift,onShowDetails:i.onShowDetails,isRefreshing:!1})})},w={name:"Section - Minor Drift",render:()=>e.jsx("div",{style:{maxWidth:"600px"},children:e.jsx(f,{fabricId:"test-fabric",driftStatus:l,onRefreshDrift:i.onRefreshDrift,onShowDetails:i.onShowDetails,isRefreshing:!1})})},v={name:"Section - Major Drift",render:()=>e.jsx("div",{style:{maxWidth:"600px"},children:e.jsx(f,{fabricId:"prod-fabric",driftStatus:V,onRefreshDrift:i.onRefreshDrift,onShowDetails:i.onShowDetails,isRefreshing:!1})})},R={name:"Section - Refreshing",render:()=>e.jsx("div",{style:{maxWidth:"600px"},children:e.jsx(f,{fabricId:"test-fabric",driftStatus:l,onRefreshDrift:i.onRefreshDrift,onShowDetails:i.onShowDetails,isRefreshing:!0})})},I={name:"List View - Multiple Fabrics",render:()=>e.jsx("div",{style:{maxWidth:"800px"},children:e.jsx(_,{fabrics:[{id:"fabric-with-drift",name:"Production Fabric"},{id:"fabric-minor-drift",name:"Staging Fabric"},{id:"fabric-clean",name:"Development Fabric"},{id:"fabric-unchecked",name:"Test Fabric"}],onGetDriftStatus:i.onGetDriftStatus,onSelectFabric:i.onSelectFabric})})},M={name:"List View - No Fabrics",render:()=>e.jsx("div",{style:{maxWidth:"800px"},children:e.jsx(_,{fabrics:[],onGetDriftStatus:i.onGetDriftStatus,onSelectFabric:i.onSelectFabric})})},B={name:"Combined Demo",render:()=>e.jsxs("div",{style:{maxWidth:"800px",padding:"1rem"},children:[e.jsx("h2",{children:"Drift Detection Components Demo"}),e.jsx("h3",{children:"Workspace Badge"}),e.jsx("div",{style:{marginBottom:"1rem",padding:"1rem",backgroundColor:"#f5f5f5",borderRadius:"4px"},children:e.jsx(W,{driftCount:2,onClick:i.onClick})}),e.jsx("h3",{children:"Fabric Card Indicators"}),e.jsxs("div",{style:{marginBottom:"1rem",display:"flex",gap:"1rem",flexWrap:"wrap"},children:[e.jsxs("div",{style:{padding:"0.5rem",border:"1px solid #ddd",borderRadius:"4px"},children:["No drift: ",e.jsx(N,{driftStatus:L,compact:!0})]}),e.jsxs("div",{style:{padding:"0.5rem",border:"1px solid #ddd",borderRadius:"4px"},children:["Minor drift: ",e.jsx(N,{driftStatus:l,compact:!0})]}),e.jsxs("div",{style:{padding:"0.5rem",border:"1px solid #ddd",borderRadius:"4px"},children:["Checking: ",e.jsx(N,{driftStatus:null,isChecking:!0,compact:!0})]})]}),e.jsx("h3",{children:"Fabric Designer Section"}),e.jsx(f,{fabricId:"demo-fabric",driftStatus:V,onRefreshDrift:i.onRefreshDrift,onShowDetails:i.onShowDetails})]})};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'Indicator - No Drift',
  args: {
    driftStatus: noDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick
  }
}`,...g.parameters?.docs?.source}}};S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: 'Indicator - Minor Drift',
  args: {
    driftStatus: minorDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick
  }
}`,...S.parameters?.docs?.source}}};D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'Indicator - Major Drift',
  args: {
    driftStatus: majorDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick
  }
}`,...D.parameters?.docs?.source}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: 'Indicator - Checking',
  args: {
    driftStatus: null,
    isChecking: true,
    onClick: mockFunctions.onClick,
    compact: true
  }
}`,...b.parameters?.docs?.source}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: 'Indicator - Compact Mode',
  args: {
    driftStatus: minorDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick,
    compact: true
  }
}`,...x.parameters?.docs?.source}}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  name: 'Badge - No Drift',
  render: () => <DriftBadge driftCount={0} onClick={mockFunctions.onClick} />
}`,...k.parameters?.docs?.source}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: 'Badge - Single Fabric',
  render: () => <DriftBadge driftCount={1} onClick={mockFunctions.onClick} />
}`,...C.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'Badge - Multiple Fabrics',
  render: () => <DriftBadge driftCount={3} onClick={mockFunctions.onClick} />
}`,...y.parameters?.docs?.source}}};j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  name: 'Section - No Status',
  render: () => <div style={{
    maxWidth: '600px'
  }}>
      <DriftSection fabricId="test-fabric" driftStatus={null} onRefreshDrift={mockFunctions.onRefreshDrift} onShowDetails={mockFunctions.onShowDetails} isRefreshing={false} />
    </div>
}`,...j.parameters?.docs?.source}}};F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  name: 'Section - No Drift',
  render: () => <div style={{
    maxWidth: '600px'
  }}>
      <DriftSection fabricId="test-fabric" driftStatus={noDriftStatus} onRefreshDrift={mockFunctions.onRefreshDrift} onShowDetails={mockFunctions.onShowDetails} isRefreshing={false} />
    </div>
}`,...F.parameters?.docs?.source}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'Section - Minor Drift',
  render: () => <div style={{
    maxWidth: '600px'
  }}>
      <DriftSection fabricId="test-fabric" driftStatus={minorDriftStatus} onRefreshDrift={mockFunctions.onRefreshDrift} onShowDetails={mockFunctions.onShowDetails} isRefreshing={false} />
    </div>
}`,...w.parameters?.docs?.source}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'Section - Major Drift',
  render: () => <div style={{
    maxWidth: '600px'
  }}>
      <DriftSection fabricId="prod-fabric" driftStatus={majorDriftStatus} onRefreshDrift={mockFunctions.onRefreshDrift} onShowDetails={mockFunctions.onShowDetails} isRefreshing={false} />
    </div>
}`,...v.parameters?.docs?.source}}};R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  name: 'Section - Refreshing',
  render: () => <div style={{
    maxWidth: '600px'
  }}>
      <DriftSection fabricId="test-fabric" driftStatus={minorDriftStatus} onRefreshDrift={mockFunctions.onRefreshDrift} onShowDetails={mockFunctions.onShowDetails} isRefreshing={true} />
    </div>
}`,...R.parameters?.docs?.source}}};I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  name: 'List View - Multiple Fabrics',
  render: () => <div style={{
    maxWidth: '800px'
  }}>
      <DriftListView fabrics={[{
      id: 'fabric-with-drift',
      name: 'Production Fabric'
    }, {
      id: 'fabric-minor-drift',
      name: 'Staging Fabric'
    }, {
      id: 'fabric-clean',
      name: 'Development Fabric'
    }, {
      id: 'fabric-unchecked',
      name: 'Test Fabric'
    }]} onGetDriftStatus={mockFunctions.onGetDriftStatus} onSelectFabric={mockFunctions.onSelectFabric} />
    </div>
}`,...I.parameters?.docs?.source}}};M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  name: 'List View - No Fabrics',
  render: () => <div style={{
    maxWidth: '800px'
  }}>
      <DriftListView fabrics={[]} onGetDriftStatus={mockFunctions.onGetDriftStatus} onSelectFabric={mockFunctions.onSelectFabric} />
    </div>
}`,...M.parameters?.docs?.source}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: 'Combined Demo',
  render: () => <div style={{
    maxWidth: '800px',
    padding: '1rem'
  }}>
      <h2>Drift Detection Components Demo</h2>
      
      <h3>Workspace Badge</h3>
      <div style={{
      marginBottom: '1rem',
      padding: '1rem',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px'
    }}>
        <DriftBadge driftCount={2} onClick={mockFunctions.onClick} />
      </div>
      
      <h3>Fabric Card Indicators</h3>
      <div style={{
      marginBottom: '1rem',
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap'
    }}>
        <div style={{
        padding: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}>
          No drift: <DriftIndicator driftStatus={noDriftStatus} compact />
        </div>
        <div style={{
        padding: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}>
          Minor drift: <DriftIndicator driftStatus={minorDriftStatus} compact />
        </div>
        <div style={{
        padding: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}>
          Checking: <DriftIndicator driftStatus={null} isChecking compact />
        </div>
      </div>
      
      <h3>Fabric Designer Section</h3>
      <DriftSection fabricId="demo-fabric" driftStatus={majorDriftStatus} onRefreshDrift={mockFunctions.onRefreshDrift} onShowDetails={mockFunctions.onShowDetails} />
    </div>
}`,...B.parameters?.docs?.source}}};const X=["IndicatorNoDrift","IndicatorMinorDrift","IndicatorMajorDrift","IndicatorChecking","IndicatorCompact","BadgeNoDrift","BadgeSingleFabric","BadgeMultipleFabrics","SectionNoDriftStatus","SectionNoDrift","SectionMinorDrift","SectionMajorDrift","SectionRefreshing","ListView","ListViewEmpty","CombinedDemo"];export{y as BadgeMultipleFabrics,k as BadgeNoDrift,C as BadgeSingleFabric,B as CombinedDemo,b as IndicatorChecking,x as IndicatorCompact,D as IndicatorMajorDrift,S as IndicatorMinorDrift,g as IndicatorNoDrift,I as ListView,M as ListViewEmpty,v as SectionMajorDrift,w as SectionMinorDrift,F as SectionNoDrift,j as SectionNoDriftStatus,R as SectionRefreshing,X as __namedExportsOrder,Q as default};
