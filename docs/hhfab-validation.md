# HHFab Validation Integration

This document describes the HHFab validation tool integration that validates Fabric Graph Definition (FGD) files using the hhfab CLI tool.

## Overview

The HHFab validation tool (`tools/hhfab-validate.mjs`) creates a temporary directory, initializes hhfab, copies FGD YAML files from the `./fgd/<fabric-id>/` directory to the `include/` directory, and runs `hhfab validate` to verify the fabric configuration.

## Prerequisites

- **hhfab CLI tool**: Must be installed and accessible
- **Environment Configuration**: `HHFAB` environment variable must be set to the path of the hhfab binary

## Usage

### Quick Start

1. **Set up environment**:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env to set HHFAB path
   HHFAB=/usr/local/bin/hhfab
   HNC_VERBOSE=true  # Optional: Enable verbose logging
   ```

2. **Run validation**:
   ```bash
   # Validate default fabric (golden-path-fabric)
   npm run validate:hhfab
   
   # Validate specific fabric
   npm run validate:hhfab vlab-test
   npm run validate:hhfab golden-path-fabric
   ```

3. **CI/CD Integration**:
   ```bash
   # CI script with environment guard
   npm run validate:hhfab:ci
   npm run validate:hhfab:ci vlab-test
   ```

### Available Scripts

| Script | Description | Environment Handling |
|--------|-------------|---------------------|
| `validate:hhfab` | Run hhfab validation | Requires HHFAB env var |
| `validate:hhfab:ci` | CI-friendly validation | Skips if HHFAB not set |
| `validate:all` | Run all validation checks | Includes hhfab validation |

### Direct Usage

```bash
# Direct tool usage (requires HHFAB env var)
node tools/hhfab-validate.mjs [fabric-id]

# With environment variables
HHFAB=/usr/local/bin/hhfab node tools/hhfab-validate.mjs vlab-test

# Enable verbose logging
HHFAB=/usr/local/bin/hhfab HNC_VERBOSE=true node tools/hhfab-validate.mjs
```

## Fabric Structure

The tool expects fabric files to be organized as follows:

```
fgd/
├── fabric-id/
│   ├── switches.yaml      # Switch definitions
│   ├── servers.yaml       # Server definitions 
│   ├── connections.yaml   # Connection definitions
│   └── *.yaml            # Any additional YAML files
```

### Supported Formats

The tool supports HHFab-compatible YAML formats with proper Kubernetes-style resources:

```yaml
# Example: Kubernetes-style resources (required by hhfab)
apiVersion: wiring.githedgehog.com/v1beta1
kind: Switch
metadata:
  name: leaf-01
spec:
  role: server-leaf
  # ... switch configuration
---
apiVersion: wiring.githedgehog.com/v1beta1
kind: Connection
metadata:
  name: spine-01--fabric--leaf-01
spec:
  fabric:
    links:
      - leaf:
          port: leaf-01/E1/8
        spine:
          port: spine-01/E1/1
```

**Note**: The legacy HNC format (plain YAML without apiVersion/kind) is not compatible with hhfab and will fail validation.

## Environment Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `HHFAB` | Path to hhfab binary | Yes | - |
| `HNC_VERBOSE` | Enable verbose logging | No | `false` |

### .env File Support

Create a `.env` file in the project root:

```bash
# HHFab CLI tool path
HHFAB=/usr/local/bin/hhfab

# Optional: Enable verbose logging  
HNC_VERBOSE=true
```

## Output Examples

### Successful Validation

```bash
npm run validate:hhfab vlab-test

🔍 HHFab Fabric Validation
📁 Fabric: vlab-test

✅ PASS: Fabric validation successful
{
  "fabricId": "vlab-test",
  "duration": "1634ms", 
  "summary": "Validation completed successfully",
  "fileCount": 1
}
```

### Failed Validation

```bash
npm run validate:hhfab invalid-fabric

🔍 HHFab Fabric Validation
📁 Fabric: invalid-fabric

❌ FAIL: Fabric validation failed
{
  "fabricId": "invalid-fabric",
  "duration": "1695ms",
  "exitCode": 1,
  "errors": [
    "Object 'Kind' is missing in connections.yaml"
  ],
  "warnings": []
}
```

### CI Mode (No HHFAB configured)

```bash
npm run validate:hhfab:ci

⚠️  HHFAB not configured, skipping validation
To enable hhfab validation, set HHFAB=/path/to/hhfab in your environment
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Fabric Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Install hhfab (example)
      - name: Install HHFab
        run: |
          curl -L https://github.com/githedgehog/fabricator/releases/download/v0.41.3/hhfab-linux-amd64 -o /usr/local/bin/hhfab
          chmod +x /usr/local/bin/hhfab
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Validate fabric configurations
        env:
          HHFAB: /usr/local/bin/hhfab
        run: npm run validate:hhfab:ci
```

## Troubleshooting

### Common Issues

1. **"HHFAB environment variable not set"**
   ```bash
   # Solution: Set the HHFAB environment variable
   export HHFAB=/usr/local/bin/hhfab
   # Or add to .env file
   echo "HHFAB=/usr/local/bin/hhfab" >> .env
   ```

2. **"Object 'Kind' is missing"**
   ```bash
   # Solution: Ensure YAML files use Kubernetes-style resources
   # Convert from HNC format to hhfab format with apiVersion and kind
   ```

3. **"Fabric directory not found"**
   ```bash
   # Solution: Verify fabric directory exists
   ls -la fgd/
   # Create fabric directory if needed
   mkdir -p fgd/my-fabric/
   ```

4. **"No YAML files found"**
   ```bash
   # Solution: Ensure .yaml files exist in fabric directory
   ls -la fgd/my-fabric/*.yaml
   ```

### Debug Mode

Enable verbose logging to see detailed execution:

```bash
HNC_VERBOSE=true npm run validate:hhfab vlab-test
```

This will show:
- Temporary directory creation
- File copy operations  
- HHFab command execution
- Detailed validation output
- Cleanup operations

## Technical Details

### Validation Process

1. **Environment Validation**: Checks if HHFAB binary exists and is executable
2. **Temporary Directory**: Creates unique temp directory in `tmp/`
3. **HHFab Initialization**: Runs `hhfab init --dev` in temp directory
4. **File Discovery**: Finds all `.yaml` files in `fgd/<fabric-id>/`
5. **File Copy**: Copies FGD files to `temp/include/` directory
6. **Validation**: Executes `hhfab validate` and captures output
7. **Result Parsing**: Parses stdout/stderr for errors and warnings
8. **Cleanup**: Removes temporary directory

### Exit Codes

- `0`: Validation successful
- `1`: Validation failed or tool error

### Temporary Directory Management

- **Location**: `tmp/hnc-hhfab-validate-{timestamp}-{random}/`
- **Cleanup**: Automatic cleanup after validation (success or failure)
- **Contents**: Standard hhfab project structure with `include/` directory

## Integration with ONF

This tool provides seamless integration with ONF (Open Networking Foundation) workflows by:

1. **Standardized Validation**: Uses official hhfab tool for consistency
2. **CI/CD Ready**: Environment guards prevent failures in environments without hhfab
3. **Clear Output**: Structured JSON output for programmatic processing
4. **Error Reporting**: Detailed error messages for debugging

The validation ensures that fabric configurations meet hhfab standards before deployment or integration with broader ONF toolchains.

## Related Documentation

- [Package Scripts Documentation](../package.json) - All available npm scripts
- [Environment Configuration](../.env.example) - Environment variable examples
- [Integration Testing](./integration-testing.md) - Other validation tools
- [HHFab Documentation](https://github.com/githedgehog/fabricator) - Official hhfab documentation