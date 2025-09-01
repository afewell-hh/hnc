#!/usr/bin/env node

/**
 * Upstream Repository Synchronization Tool
 * 
 * Synchronizes upstream githedgehog repositories to local .upstream/ mirrors
 * Supports pinned commits, shallow clones, and selective path syncing
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const CONFIG_PATH = join(ROOT_DIR, 'upstream.json');

class UpstreamSync {
  constructor() {
    this.config = this.loadConfig();
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
    this.force = process.argv.includes('--force') || process.argv.includes('-f');
  }

  loadConfig() {
    if (!existsSync(CONFIG_PATH)) {
      throw new Error(`Configuration file not found: ${CONFIG_PATH}`);
    }
    
    try {
      const content = readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse configuration: ${error.message}`);
    }
  }

  saveConfig() {
    if (this.dryRun) {
      this.log('DRY RUN: Would save configuration');
      return;
    }

    this.config.metadata.last_updated = new Date().toISOString();
    writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2) + '\n');
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  verboseLog(message) {
    if (this.verbose) {
      this.log(message, 'debug');
    }
  }

  async execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      this.verboseLog(`Executing: ${command}`);
      
      if (this.dryRun) {
        this.log(`DRY RUN: ${command}`);
        resolve({ stdout: '', stderr: '', code: 0 });
        return;
      }

      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: options.cwd || ROOT_DIR,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Command execution failed: ${error.message}`));
      });
    });
  }

  async checkGitInstalled() {
    try {
      if (this.dryRun) {
        // In dry-run mode, just check if git command exists
        const { execSync } = await import('child_process');
        execSync('git --version', { stdio: 'ignore' });
        return true;
      }
      await this.execCommand('git --version');
      return true;
    } catch (error) {
      throw new Error('Git is not installed or not accessible');
    }
  }

  async getRemoteCommit(url, ref) {
    try {
      const result = await this.execCommand(`git ls-remote ${url} ${ref}`);
      const commit = result.stdout.split('\t')[0];
      return commit || null;
    } catch (error) {
      this.log(`Failed to get remote commit for ${url}:${ref} - ${error.message}`, 'warn');
      return null;
    }
  }

  async cloneOrUpdateRepo(repoName, repoConfig) {
    const localPath = join(ROOT_DIR, repoConfig.local_path);
    const exists = existsSync(localPath);
    
    this.log(`${exists ? 'Updating' : 'Cloning'} ${repoName}...`);

    if (!exists) {
      // Create parent directory if it doesn't exist
      mkdirSync(dirname(localPath), { recursive: true });

      // Clone repository
      const cloneArgs = [
        'git clone',
        this.config.sync.shallow_clone ? '--depth 1' : '',
        repoConfig.ref !== 'HEAD' ? `--branch ${repoConfig.ref}` : '',
        repoConfig.url,
        localPath
      ].filter(Boolean).join(' ');

      await this.execCommand(cloneArgs);
      this.verboseLog(`Cloned ${repoName} to ${localPath}`);
    } else {
      // Update existing repository
      try {
        await this.execCommand('git fetch origin', { cwd: localPath });
        const resetRef = repoConfig.ref === 'HEAD' ? 'HEAD' : `origin/${repoConfig.ref}`;
        await this.execCommand(`git reset --hard ${resetRef}`, { cwd: localPath });
        this.verboseLog(`Updated ${repoName} at ${localPath}`);
      } catch (error) {
        this.log(`Failed to update ${repoName}: ${error.message}`, 'warn');
        
        if (this.force) {
          this.log(`Force flag enabled, re-cloning ${repoName}...`, 'warn');
          await this.execCommand(`rm -rf ${localPath}`);
          return this.cloneOrUpdateRepo(repoName, repoConfig);
        }
        throw error;
      }
    }

    // Get current commit
    try {
      const result = await this.execCommand('git rev-parse HEAD', { cwd: localPath });
      const currentCommit = result.stdout.trim();
      
      // Update config with current commit and sync time
      repoConfig.pinned_commit = currentCommit;
      repoConfig.last_synced = new Date().toISOString();
      
      this.verboseLog(`Repository ${repoName} at commit: ${currentCommit.substring(0, 8)}`);
      return currentCommit;
    } catch (error) {
      if (this.verbose) {
        this.log(`Failed to get current commit for ${repoName}: ${error.message}`, 'warn');
      }
      return null;
    }
  }

  async syncRepository(repoName, repoConfig) {
    try {
      this.log(`Syncing ${repoName}...`);
      
      const commit = await this.cloneOrUpdateRepo(repoName, repoConfig);
      
      // Verify sync paths exist
      const localPath = join(ROOT_DIR, repoConfig.local_path);
      let validPaths = 0;
      
      for (const syncPath of repoConfig.sync_paths) {
        const fullPath = join(localPath, syncPath);
        if (existsSync(fullPath)) {
          validPaths++;
          this.verboseLog(`✓ Found sync path: ${syncPath}`);
        } else {
          this.verboseLog(`✗ Missing sync path: ${syncPath}`);
        }
      }

      this.log(`Synced ${repoName} (${validPaths}/${repoConfig.sync_paths.length} paths found)`, 
               validPaths > 0 ? 'success' : 'warn');
      
      return { commit, validPaths };
    } catch (error) {
      this.log(`Failed to sync ${repoName}: ${error.message}`, 'error');
      throw error;
    }
  }

  async syncAll() {
    try {
      await this.checkGitInstalled();
      
      const results = {};
      const repos = Object.entries(this.config.upstream);
      
      this.log(`Starting sync of ${repos.length} repositories...`);
      this.log(`Sync configuration: shallow=${this.config.sync.shallow_clone}, auto_upgrade=${this.config.sync.auto_upgrade}`);

      for (const [repoName, repoConfig] of repos) {
        try {
          results[repoName] = await this.syncRepository(repoName, repoConfig);
        } catch (error) {
          results[repoName] = { error: error.message };
          this.log(`Skipping ${repoName} due to error: ${error.message}`, 'error');
        }
      }

      // Save updated configuration
      this.saveConfig();

      // Report results
      const successful = Object.values(results).filter(r => !r.error).length;
      const failed = Object.values(results).filter(r => r.error).length;
      
      this.log(`Sync complete: ${successful} successful, ${failed} failed`, 
               failed === 0 ? 'success' : 'warn');
      
      if (this.verbose) {
        console.log('\nDetailed Results:');
        for (const [repo, result] of Object.entries(results)) {
          if (result.error) {
            console.log(`  ❌ ${repo}: ${result.error}`);
          } else {
            console.log(`  ✅ ${repo}: ${result.commit?.substring(0, 8)} (${result.validPaths} paths)`);
          }
        }
      }

      return { successful, failed, results };
    } catch (error) {
      this.log(`Sync failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async status() {
    this.log('Upstream repository status:');
    
    for (const [repoName, repoConfig] of Object.entries(this.config.upstream)) {
      const localPath = join(ROOT_DIR, repoConfig.local_path);
      const exists = existsSync(localPath);
      
      console.log(`\n📦 ${repoName}`);
      console.log(`   URL: ${repoConfig.url}`);
      console.log(`   Local: ${repoConfig.local_path}`);
      console.log(`   Status: ${exists ? '✅ Present' : '❌ Missing'}`);
      
      if (exists) {
        try {
          const result = await this.execCommand('git rev-parse HEAD', { cwd: localPath });
          const commit = result.stdout.trim();
          console.log(`   Commit: ${commit.substring(0, 8)}...`);
          
          const lastSync = repoConfig.last_synced;
          if (lastSync) {
            const ago = Math.round((Date.now() - Date.parse(lastSync)) / (1000 * 60 * 60 * 24));
            console.log(`   Last Sync: ${ago} days ago`);
          } else {
            console.log(`   Last Sync: Never`);
          }

          // Check sync paths
          let validPaths = 0;
          for (const syncPath of repoConfig.sync_paths) {
            const fullPath = join(localPath, syncPath);
            if (existsSync(fullPath)) validPaths++;
          }
          console.log(`   Sync Paths: ${validPaths}/${repoConfig.sync_paths.length} available`);
          
        } catch (error) {
          console.log(`   ❌ Error reading repository: ${error.message}`);
        }
      }
    }

    console.log(`\n📊 Configuration:`);
    console.log(`   Auto-upgrade: ${this.config.sync.auto_upgrade ? '✅' : '❌'}`);
    console.log(`   Shallow clone: ${this.config.sync.shallow_clone ? '✅' : '❌'}`);
    console.log(`   Last updated: ${this.config.metadata.last_updated || 'Never'}`);
  }

  showHelp() {
    console.log(`
Upstream Repository Synchronization Tool

Usage: node tools/upstream-sync.mjs [options] [command]

Commands:
  sync     Synchronize all upstream repositories (default)
  status   Show status of upstream repositories
  help     Show this help message

Options:
  -v, --verbose    Enable verbose logging
  -n, --dry-run    Show what would be done without making changes
  -f, --force      Force re-clone repositories on update failures

Examples:
  node tools/upstream-sync.mjs sync --verbose
  node tools/upstream-sync.mjs status
  node tools/upstream-sync.mjs --dry-run sync
`);
  }
}

async function main() {
  const sync = new UpstreamSync();
  
  // Filter out options to find the command
  const args = process.argv.slice(2);
  const command = args.find(arg => !arg.startsWith('-')) || 'sync';
  
  try {
    switch (command) {
      case 'sync':
        await sync.syncAll();
        break;
      case 'status':
        await sync.status();
        break;
      case 'help':
      case '--help':
      case '-h':
        sync.showHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        sync.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default UpstreamSync;