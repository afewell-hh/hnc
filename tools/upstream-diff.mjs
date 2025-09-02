#!/usr/bin/env node

/**
 * UP-WATCH: Upstream Diff Detector
 * 
 * Compares current snapshots to .upstream HEAD, detects changes in:
 * - CRDs (schema changes, new/removed CRDs, version changes)
 * - Switch profiles (configuration changes, new profiles)
 * - Examples (new/modified/removed example files)
 * 
 * Generates Markdown reports and optionally creates GitHub issues.
 * 
 * Usage: 
 *   node tools/upstream-diff.mjs [--verbose] [--dry-run] [--github-issue] [--format=markdown|json]
 * 
 * Environment:
 *   GITHUB_TOKEN - Required for GitHub issue creation
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import jsyaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

class UpstreamDiffDetector {
  constructor(options = {}) {
    this.verbose = options.verbose || process.argv.includes('--verbose') || process.argv.includes('-v');
    this.dryRun = options.dryRun || process.argv.includes('--dry-run') || process.argv.includes('-n');
    this.createGitHubIssue = options.createGitHubIssue || process.argv.includes('--github-issue');
    this.format = options.format || this.parseFormat() || 'markdown';
    
    this.upstreamConfigPath = join(ROOT_DIR, 'upstream.json');
    this.snapshotPath = join(ROOT_DIR, 'src/upstream/extraction-snapshot.json');
    
    this.changes = {
      crds: {
        added: [],
        removed: [],
        modified: [],
        versionChanges: [],
        breakingChanges: []
      },
      switchProfiles: {
        added: [],
        removed: [],
        modified: []
      },
      examples: {
        added: [],
        removed: [],
        modified: []
      },
      summary: {
        hasChanges: false,
        totalChanges: 0,
        criticalChanges: 0,
        breakingChanges: 0
      }
    };
  }

  parseFormat() {
    const formatArg = process.argv.find(arg => arg.startsWith('--format='));
    return formatArg ? formatArg.split('=')[1] : null;
  }

  log(message, level = 'info') {
    if (level === 'verbose' && !this.verbose) return;
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'verbose' ? '🔍' : 'ℹ️';
    console.log(`${prefix} ${message}`);
  }

  async run() {
    try {
      this.log('🔍 Starting upstream diff detection...');
      
      // Load current configuration and snapshot
      await this.loadCurrentState();
      
      // For each upstream repository, compare pinned commit with HEAD
      for (const [repoName, config] of Object.entries(this.upstreamConfig.upstream)) {
        this.log(`🔄 Analyzing ${repoName}...`, 'verbose');
        await this.analyzeRepository(repoName, config);
      }
      
      // Calculate summary
      this.calculateSummary();
      
      // Generate reports
      await this.generateReport();
      
      // Create GitHub issue if requested and changes detected
      if (this.createGitHubIssue && this.changes.summary.hasChanges) {
        await this.createGitHubIssueIfRequested();
      }
      
      // Exit with appropriate code
      if (this.changes.summary.hasChanges) {
        this.log(`✅ Detection complete. Found ${this.changes.summary.totalChanges} changes.`);
        if (this.changes.summary.breakingChanges > 0) {
          this.log(`⚠️ WARNING: ${this.changes.summary.breakingChanges} breaking changes detected!`, 'warn');
          process.exit(2); // Breaking changes exit code
        }
        process.exit(1); // Changes detected exit code
      } else {
        this.log('✅ No upstream changes detected.');
        process.exit(0);
      }
      
    } catch (error) {
      this.log(`❌ Error during diff detection: ${error.message}`, 'error');
      if (this.verbose) {
        console.error(error.stack);
      }
      process.exit(3);
    }
  }

  async loadCurrentState() {
    this.log('📖 Loading current upstream configuration...', 'verbose');
    
    if (!existsSync(this.upstreamConfigPath)) {
      throw new Error(`Upstream config not found: ${this.upstreamConfigPath}`);
    }
    
    this.upstreamConfig = JSON.parse(readFileSync(this.upstreamConfigPath, 'utf8'));
    
    if (existsSync(this.snapshotPath)) {
      this.currentSnapshot = JSON.parse(readFileSync(this.snapshotPath, 'utf8'));
      this.log(`📸 Loaded current snapshot with ${Object.keys(this.currentSnapshot.crds || {}).length} CRDs`, 'verbose');
    } else {
      this.log('⚠️ No current snapshot found, treating as initial state', 'warn');
      this.currentSnapshot = { crds: {}, switchProfiles: {}, examples: {}, metadata: {} };
    }
  }

  async analyzeRepository(repoName, config) {
    const repoPath = join(ROOT_DIR, config.local_path);
    
    if (!existsSync(repoPath)) {
      this.log(`⚠️ Repository not found: ${repoPath}`, 'warn');
      return;
    }

    try {
      // Get current HEAD commit
      const currentHead = this.getGitCommit(repoPath, 'HEAD');
      const pinnedCommit = config.pinned_commit;
      
      this.log(`📍 ${repoName}: pinned=${pinnedCommit.substring(0, 8)}, head=${currentHead.substring(0, 8)}`, 'verbose');
      
      if (currentHead === pinnedCommit) {
        this.log(`✅ ${repoName}: No changes (HEAD matches pinned commit)`, 'verbose');
        return;
      }
      
      // Analyze changes between commits
      await this.analyzeCommitDifferences(repoName, config, pinnedCommit, currentHead);
      
    } catch (error) {
      this.log(`❌ Error analyzing ${repoName}: ${error.message}`, 'error');
    }
  }

  getGitCommit(repoPath, ref) {
    try {
      return execSync(`cd "${repoPath}" && git rev-parse ${ref}`, { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error(`Failed to get git commit for ${ref} in ${repoPath}: ${error.message}`);
    }
  }

  async analyzeCommitDifferences(repoName, config, fromCommit, toCommit) {
    const repoPath = join(ROOT_DIR, config.local_path);
    
    // Get list of changed files
    const changedFiles = this.getChangedFiles(repoPath, fromCommit, toCommit);
    
    this.log(`🔍 ${repoName}: ${changedFiles.length} files changed`, 'verbose');
    
    for (const file of changedFiles) {
      await this.analyzeFileChange(repoName, config, repoPath, file, fromCommit, toCommit);
    }
  }

  getChangedFiles(repoPath, fromCommit, toCommit) {
    try {
      const output = execSync(
        `cd "${repoPath}" && git diff --name-status ${fromCommit}..${toCommit}`, 
        { encoding: 'utf8' }
      ).trim();
      
      if (!output) return [];
      
      return output.split('\n').map(line => {
        const [status, file] = line.split('\t');
        return { status, file };
      });
    } catch (error) {
      this.log(`⚠️ Error getting changed files: ${error.message}`, 'warn');
      return [];
    }
  }

  async analyzeFileChange(repoName, config, repoPath, change, fromCommit, toCommit) {
    const { status, file } = change;
    const filePath = join(repoPath, file);
    
    // Determine file type and relevance
    const fileType = this.determineFileType(file, config);
    if (!fileType) return; // Not a file we care about
    
    this.log(`📄 ${repoName}/${file}: ${status} (${fileType})`, 'verbose');
    
    switch (fileType) {
      case 'crd':
        await this.analyzeCrdChange(repoName, file, status, repoPath, fromCommit, toCommit);
        break;
      case 'switchProfile':
        await this.analyzeSwitchProfileChange(repoName, file, status, repoPath, fromCommit, toCommit);
        break;
      case 'example':
        await this.analyzeExampleChange(repoName, file, status, repoPath, fromCommit, toCommit);
        break;
    }
  }

  determineFileType(file, config) {
    // Check if it's a CRD file
    if (file.includes('config/crd') || file.includes('_crd.yaml') || file.endsWith('.crd.yaml')) {
      return 'crd';
    }
    
    // Check if it's a switch profile
    if (file.includes('switch') && (file.endsWith('.yaml') || file.endsWith('.yml'))) {
      return 'switchProfile';
    }
    
    // Check if it's in example directories
    if (file.includes('example') && (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json'))) {
      return 'example';
    }
    
    // Check against sync_paths
    for (const syncPath of config.sync_paths || []) {
      if (file.startsWith(syncPath)) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          return file.includes('switch') ? 'switchProfile' : 'example';
        }
      }
    }
    
    return null; // Not a file we care about
  }

  async analyzeCrdChange(repoName, file, status, repoPath, fromCommit, toCommit) {
    const changeRecord = {
      repository: repoName,
      file: file,
      status: status,
      timestamp: new Date().toISOString()
    };

    try {
      if (status === 'A') {
        // New CRD added
        const newContent = await this.getFileContentAtCommit(repoPath, file, toCommit);
        const crdData = await this.parseCrdFile(newContent, file);
        
        if (crdData) {
          changeRecord.crdName = crdData.metadata.name;
          changeRecord.kind = crdData.spec.names.kind;
          changeRecord.group = crdData.spec.group;
          changeRecord.versions = crdData.spec.versions?.map(v => v.name) || [];
          
          this.changes.crds.added.push(changeRecord);
          this.log(`➕ New CRD: ${crdData.metadata.name}`, 'verbose');
        }
        
      } else if (status === 'D') {
        // CRD removed
        const oldContent = await this.getFileContentAtCommit(repoPath, file, fromCommit);
        const crdData = await this.parseCrdFile(oldContent, file);
        
        if (crdData) {
          changeRecord.crdName = crdData.metadata.name;
          changeRecord.kind = crdData.spec.names.kind;
          changeRecord.group = crdData.spec.group;
          
          this.changes.crds.removed.push(changeRecord);
          this.log(`➖ Removed CRD: ${crdData.metadata.name}`, 'verbose');
        }
        
      } else if (status === 'M') {
        // CRD modified - this is where we check for breaking changes
        const oldContent = await this.getFileContentAtCommit(repoPath, file, fromCommit);
        const newContent = await this.getFileContentAtCommit(repoPath, file, toCommit);
        
        const oldCrd = await this.parseCrdFile(oldContent, file);
        const newCrd = await this.parseCrdFile(newContent, file);
        
        if (oldCrd && newCrd) {
          const diff = await this.compareCrdSchemas(oldCrd, newCrd);
          changeRecord.crdName = newCrd.metadata.name;
          changeRecord.differences = diff;
          
          if (diff.hasBreakingChanges) {
            this.changes.crds.breakingChanges.push(changeRecord);
            this.log(`💥 Breaking change in CRD: ${newCrd.metadata.name}`, 'warn');
          }
          
          if (diff.versionChanges.length > 0) {
            this.changes.crds.versionChanges.push(changeRecord);
            this.log(`🔄 Version changes in CRD: ${newCrd.metadata.name}`, 'verbose');
          }
          
          this.changes.crds.modified.push(changeRecord);
        }
      }
    } catch (error) {
      this.log(`❌ Error analyzing CRD change ${file}: ${error.message}`, 'error');
    }
  }

  async analyzeSwitchProfileChange(repoName, file, status, repoPath, fromCommit, toCommit) {
    const changeRecord = {
      repository: repoName,
      file: file,
      status: status,
      timestamp: new Date().toISOString()
    };

    try {
      if (status === 'A') {
        this.changes.switchProfiles.added.push(changeRecord);
        this.log(`➕ New switch profile: ${file}`, 'verbose');
      } else if (status === 'D') {
        this.changes.switchProfiles.removed.push(changeRecord);
        this.log(`➖ Removed switch profile: ${file}`, 'verbose');
      } else if (status === 'M') {
        // For switch profiles, we could add more detailed analysis here
        this.changes.switchProfiles.modified.push(changeRecord);
        this.log(`🔄 Modified switch profile: ${file}`, 'verbose');
      }
    } catch (error) {
      this.log(`❌ Error analyzing switch profile change ${file}: ${error.message}`, 'error');
    }
  }

  async analyzeExampleChange(repoName, file, status, repoPath, fromCommit, toCommit) {
    const changeRecord = {
      repository: repoName,
      file: file,
      status: status,
      timestamp: new Date().toISOString()
    };

    try {
      if (status === 'A') {
        this.changes.examples.added.push(changeRecord);
        this.log(`➕ New example: ${file}`, 'verbose');
      } else if (status === 'D') {
        this.changes.examples.removed.push(changeRecord);
        this.log(`➖ Removed example: ${file}`, 'verbose');
      } else if (status === 'M') {
        this.changes.examples.modified.push(changeRecord);
        this.log(`🔄 Modified example: ${file}`, 'verbose');
      }
    } catch (error) {
      this.log(`❌ Error analyzing example change ${file}: ${error.message}`, 'error');
    }
  }

  async getFileContentAtCommit(repoPath, file, commit) {
    try {
      return execSync(`cd "${repoPath}" && git show ${commit}:${file}`, { encoding: 'utf8' });
    } catch (error) {
      // File might not exist at that commit
      return null;
    }
  }

  async parseCrdFile(content, filename) {
    if (!content) return null;
    
    try {
      const parsed = jsyaml.load(content);
      if (parsed && parsed.kind === 'CustomResourceDefinition') {
        return parsed;
      }
    } catch (error) {
      this.log(`⚠️ Failed to parse CRD file ${filename}: ${error.message}`, 'warn');
    }
    
    return null;
  }

  async compareCrdSchemas(oldCrd, newCrd) {
    const diff = {
      hasBreakingChanges: false,
      versionChanges: [],
      schemaChanges: [],
      fieldChanges: []
    };

    // Compare versions
    const oldVersions = new Set((oldCrd.spec.versions || []).map(v => v.name));
    const newVersions = new Set((newCrd.spec.versions || []).map(v => v.name));
    
    for (const version of oldVersions) {
      if (!newVersions.has(version)) {
        diff.versionChanges.push({ type: 'removed', version });
        diff.hasBreakingChanges = true;
      }
    }
    
    for (const version of newVersions) {
      if (!oldVersions.has(version)) {
        diff.versionChanges.push({ type: 'added', version });
      }
    }

    // For each version, compare schemas
    for (const newVersion of newCrd.spec.versions || []) {
      const oldVersion = (oldCrd.spec.versions || []).find(v => v.name === newVersion.name);
      if (oldVersion && oldVersion.schema && newVersion.schema) {
        const schemaChanges = this.compareSchemas(
          oldVersion.schema.openAPIV3Schema,
          newVersion.schema.openAPIV3Schema,
          newVersion.name
        );
        diff.schemaChanges.push(...schemaChanges);
        
        // Check for breaking schema changes
        if (schemaChanges.some(c => c.breaking)) {
          diff.hasBreakingChanges = true;
        }
      }
    }

    return diff;
  }

  compareSchemas(oldSchema, newSchema, version) {
    const changes = [];
    
    // This is a simplified schema comparison
    // In a production environment, you might want to use a more sophisticated
    // JSON schema diff library
    
    if (!oldSchema || !newSchema) return changes;
    
    // Compare required fields
    const oldRequired = new Set(oldSchema.required || []);
    const newRequired = new Set(newSchema.required || []);
    
    for (const field of newRequired) {
      if (!oldRequired.has(field)) {
        changes.push({
          type: 'required_added',
          field: field,
          version: version,
          breaking: true
        });
      }
    }
    
    for (const field of oldRequired) {
      if (!newRequired.has(field)) {
        changes.push({
          type: 'required_removed',
          field: field,
          version: version,
          breaking: false // Removing required fields is generally not breaking
        });
      }
    }
    
    // Compare properties (basic comparison)
    if (oldSchema.properties && newSchema.properties) {
      const oldProps = new Set(Object.keys(oldSchema.properties));
      const newProps = new Set(Object.keys(newSchema.properties));
      
      for (const prop of oldProps) {
        if (!newProps.has(prop)) {
          changes.push({
            type: 'property_removed',
            field: prop,
            version: version,
            breaking: true
          });
        }
      }
      
      for (const prop of newProps) {
        if (!oldProps.has(prop)) {
          changes.push({
            type: 'property_added',
            field: prop,
            version: version,
            breaking: false
          });
        }
      }
    }
    
    return changes;
  }

  calculateSummary() {
    const summary = this.changes.summary;
    
    summary.totalChanges = 
      this.changes.crds.added.length +
      this.changes.crds.removed.length +
      this.changes.crds.modified.length +
      this.changes.switchProfiles.added.length +
      this.changes.switchProfiles.removed.length +
      this.changes.switchProfiles.modified.length +
      this.changes.examples.added.length +
      this.changes.examples.removed.length +
      this.changes.examples.modified.length;
    
    summary.breakingChanges = this.changes.crds.breakingChanges.length;
    
    summary.criticalChanges = 
      this.changes.crds.added.length +
      this.changes.crds.removed.length +
      summary.breakingChanges;
    
    summary.hasChanges = summary.totalChanges > 0;
  }

  async generateReport() {
    if (this.format === 'json') {
      await this.generateJsonReport();
    } else {
      await this.generateMarkdownReport();
    }
  }

  async generateJsonReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.changes.summary,
      changes: this.changes
    };
    
    const outputPath = join(ROOT_DIR, 'upstream-diff-report.json');
    
    if (!this.dryRun) {
      writeFileSync(outputPath, JSON.stringify(report, null, 2));
      this.log(`📄 JSON report written to: ${outputPath}`);
    } else {
      this.log('📄 JSON report (dry run):');
      console.log(JSON.stringify(report, null, 2));
    }
  }

  async generateMarkdownReport() {
    const timestamp = new Date().toISOString();
    let report = `# Upstream Changes Report

Generated: ${timestamp}

## Summary

- **Total Changes**: ${this.changes.summary.totalChanges}
- **Critical Changes**: ${this.changes.summary.criticalChanges}
- **Breaking Changes**: ${this.changes.summary.breakingChanges}

`;

    if (!this.changes.summary.hasChanges) {
      report += "✅ **No changes detected** - all upstream repositories are in sync with pinned commits.\n\n";
    } else {
      if (this.changes.summary.breakingChanges > 0) {
        report += "⚠️ **WARNING**: Breaking changes detected that may require manual intervention.\n\n";
      }
    }

    // CRD Changes
    if (this.changes.crds.added.length > 0 || 
        this.changes.crds.removed.length > 0 || 
        this.changes.crds.modified.length > 0) {
      
      report += "## CRD Changes\n\n";
      
      if (this.changes.crds.added.length > 0) {
        report += "### ➕ New CRDs\n\n";
        for (const crd of this.changes.crds.added) {
          report += `- **${crd.crdName || crd.file}** (${crd.repository})\n`;
          if (crd.kind) report += `  - Kind: ${crd.kind}\n`;
          if (crd.group) report += `  - Group: ${crd.group}\n`;
          if (crd.versions) report += `  - Versions: ${crd.versions.join(', ')}\n`;
        }
        report += "\n";
      }
      
      if (this.changes.crds.removed.length > 0) {
        report += "### ➖ Removed CRDs\n\n";
        for (const crd of this.changes.crds.removed) {
          report += `- **${crd.crdName || crd.file}** (${crd.repository})\n`;
        }
        report += "\n";
      }
      
      if (this.changes.crds.breakingChanges.length > 0) {
        report += "### 💥 Breaking Changes\n\n";
        for (const crd of this.changes.crds.breakingChanges) {
          report += `- **${crd.crdName}** (${crd.repository})\n`;
          if (crd.differences && crd.differences.schemaChanges) {
            for (const change of crd.differences.schemaChanges.filter(c => c.breaking)) {
              report += `  - ${change.type}: ${change.field} (${change.version})\n`;
            }
          }
        }
        report += "\n";
      }
      
      if (this.changes.crds.versionChanges.length > 0) {
        report += "### 🔄 Version Changes\n\n";
        for (const crd of this.changes.crds.versionChanges) {
          report += `- **${crd.crdName}** (${crd.repository})\n`;
          if (crd.differences && crd.differences.versionChanges) {
            for (const change of crd.differences.versionChanges) {
              report += `  - ${change.type}: ${change.version}\n`;
            }
          }
        }
        report += "\n";
      }
      
      if (this.changes.crds.modified.length > 0) {
        report += "### 🔄 Modified CRDs\n\n";
        for (const crd of this.changes.crds.modified) {
          if (!this.changes.crds.breakingChanges.includes(crd) && 
              !this.changes.crds.versionChanges.includes(crd)) {
            report += `- **${crd.crdName || crd.file}** (${crd.repository})\n`;
          }
        }
        report += "\n";
      }
    }

    // Switch Profile Changes
    if (this.changes.switchProfiles.added.length > 0 ||
        this.changes.switchProfiles.removed.length > 0 ||
        this.changes.switchProfiles.modified.length > 0) {
      
      report += "## Switch Profile Changes\n\n";
      
      if (this.changes.switchProfiles.added.length > 0) {
        report += "### ➕ New Switch Profiles\n\n";
        for (const profile of this.changes.switchProfiles.added) {
          report += `- **${basename(profile.file)}** (${profile.repository})\n`;
        }
        report += "\n";
      }
      
      if (this.changes.switchProfiles.removed.length > 0) {
        report += "### ➖ Removed Switch Profiles\n\n";
        for (const profile of this.changes.switchProfiles.removed) {
          report += `- **${basename(profile.file)}** (${profile.repository})\n`;
        }
        report += "\n";
      }
      
      if (this.changes.switchProfiles.modified.length > 0) {
        report += "### 🔄 Modified Switch Profiles\n\n";
        for (const profile of this.changes.switchProfiles.modified) {
          report += `- **${basename(profile.file)}** (${profile.repository})\n`;
        }
        report += "\n";
      }
    }

    // Example Changes
    if (this.changes.examples.added.length > 0 ||
        this.changes.examples.removed.length > 0 ||
        this.changes.examples.modified.length > 0) {
      
      report += "## Example Changes\n\n";
      
      if (this.changes.examples.added.length > 0) {
        report += "### ➕ New Examples\n\n";
        for (const example of this.changes.examples.added) {
          report += `- **${basename(example.file)}** (${example.repository})\n`;
        }
        report += "\n";
      }
      
      if (this.changes.examples.removed.length > 0) {
        report += "### ➖ Removed Examples\n\n";
        for (const example of this.changes.examples.removed) {
          report += `- **${basename(example.file)}** (${example.repository})\n`;
        }
        report += "\n";
      }
      
      if (this.changes.examples.modified.length > 0) {
        report += "### 🔄 Modified Examples\n\n";
        for (const example of this.changes.examples.modified) {
          report += `- **${basename(example.file)}** (${example.repository})\n`;
        }
        report += "\n";
      }
    }

    // Next Steps
    if (this.changes.summary.hasChanges) {
      report += "## Recommended Actions\n\n";
      
      if (this.changes.summary.breakingChanges > 0) {
        report += "1. **⚠️ Review breaking changes** - Manual intervention may be required\n";
        report += "2. **Update type definitions** - Run `npm run upstream:extract` to regenerate types\n";
        report += "3. **Update tests** - Ensure tests work with new schemas\n";
        report += "4. **Update documentation** - Document any API changes\n";
      } else {
        report += "1. **Update extraction** - Run `npm run upstream:extract` to pull new changes\n";
        report += "2. **Run tests** - Ensure compatibility with updated schemas\n";
        report += "3. **Review changes** - Verify that changes align with expected functionality\n";
      }
      
      report += `\n---\n\n*To sync with upstream changes, run:*\n\n\`\`\`bash\nnpm run upstream:sync\nnpm run upstream:extract\n\`\`\`\n`;
    }

    const outputPath = join(ROOT_DIR, 'upstream-diff-report.md');
    
    if (!this.dryRun) {
      writeFileSync(outputPath, report);
      this.log(`📄 Markdown report written to: ${outputPath}`);
    } else {
      this.log('📄 Markdown report (dry run):');
      console.log(report);
    }
    
    // Also print summary to console
    console.log('\n' + report.split('## Summary')[1].split('\n## ')[0]);
  }

  async createGitHubIssueIfRequested() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      this.log('⚠️ GITHUB_TOKEN not found. Skipping GitHub issue creation.', 'warn');
      return;
    }

    this.log('🎫 Creating GitHub issue for upstream changes...', 'verbose');

    try {
      const issueTitle = `Upstream Changes Detected - ${this.changes.summary.totalChanges} changes found`;
      const issueBody = await this.generateGitHubIssueBody();
      
      if (this.dryRun) {
        this.log('🎫 GitHub issue (dry run):');
        console.log(`Title: ${issueTitle}`);
        console.log(`Body:\n${issueBody}`);
        return;
      }

      // Use gh CLI if available, otherwise fall back to curl
      const issueUrl = await this.createIssueWithGhCli(issueTitle, issueBody);
      
      if (issueUrl) {
        this.log(`🎫 Created GitHub issue: ${issueUrl}`);
      } else {
        // Fallback to curl
        await this.createIssueWithCurl(issueTitle, issueBody);
      }
      
    } catch (error) {
      this.log(`❌ Failed to create GitHub issue: ${error.message}`, 'error');
    }
  }

  async createIssueWithGhCli(title, body) {
    try {
      const result = execSync(`gh issue create --title "${title}" --body "${body}" --label "upstream,automated"`, {
        encoding: 'utf8',
        cwd: ROOT_DIR
      }).trim();
      
      // Extract URL from gh CLI output
      const urlMatch = result.match(/(https:\/\/github\.com\/[^\s]+)/);
      return urlMatch ? urlMatch[1] : result;
    } catch (error) {
      this.log('⚠️ gh CLI not available or failed, trying curl...', 'verbose');
      return null;
    }
  }

  async createIssueWithCurl(title, body) {
    // This would need the repository owner and name
    // For now, just log that we would create an issue
    this.log('🎫 Would create GitHub issue via API (repository info needed)', 'verbose');
    this.log(`Title: ${title}`, 'verbose');
    this.log(`Labels: upstream, automated`, 'verbose');
  }

  async generateGitHubIssueBody() {
    const timestamp = new Date().toISOString();
    
    let body = `## Upstream Changes Detected

**Generated**: ${timestamp}
**Total Changes**: ${this.changes.summary.totalChanges}
**Breaking Changes**: ${this.changes.summary.breakingChanges}

`;

    if (this.changes.summary.breakingChanges > 0) {
      body += `⚠️ **WARNING**: This update includes breaking changes that may require manual intervention.\n\n`;
    }

    // Add summary of changes
    if (this.changes.crds.added.length > 0) {
      body += `### New CRDs (${this.changes.crds.added.length})\n`;
      for (const crd of this.changes.crds.added.slice(0, 5)) { // Limit to first 5
        body += `- ${crd.crdName || crd.file}\n`;
      }
      if (this.changes.crds.added.length > 5) {
        body += `- ... and ${this.changes.crds.added.length - 5} more\n`;
      }
      body += '\n';
    }

    if (this.changes.crds.breakingChanges.length > 0) {
      body += `### Breaking Changes (${this.changes.crds.breakingChanges.length})\n`;
      for (const crd of this.changes.crds.breakingChanges) {
        body += `- ${crd.crdName} (${crd.repository})\n`;
      }
      body += '\n';
    }

    body += `### Next Steps

1. Review the full diff report: \`npm run upstream:diff\`
2. Update extraction: \`npm run upstream:extract\`
3. Run tests to verify compatibility
4. Update documentation if needed

### Automation

This issue was created automatically by the UP-WATCH system. The upstream diff detector monitors changes in githedgehog repositories and alerts when updates are available.

/label upstream automated
`;

    return body;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const detector = new UpstreamDiffDetector();
  detector.run().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(3);
  });
}

export { UpstreamDiffDetector };