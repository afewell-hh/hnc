#!/usr/bin/env node
/**
 * HHFab Validation Tool
 * 
 * Creates a temporary directory, initializes hhfab, copies FGD YAML files,
 * and validates the fabric configuration using the hhfab CLI tool.
 * 
 * Usage:
 *   node tools/hhfab-validate.mjs [fabric-id]
 *   
 * Environment:
 *   HHFAB - Path to hhfab binary (required)
 *   HNC_VERBOSE - Enable verbose logging
 */

import { execSync, spawn } from 'child_process';
import { mkdirSync, rmSync, copyFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Configuration
const DEFAULT_FABRIC_ID = 'golden-path-fabric';
const TEMP_DIR_PREFIX = 'hnc-hhfab-validate-';

class HHFabValidator {
  constructor(fabricId = DEFAULT_FABRIC_ID) {
    this.fabricId = fabricId;
    this.tempDir = null;
    this.verbose = process.env.HNC_VERBOSE === 'true';
    this.hhfabPath = process.env.HHFAB;
    
    this.log('Initializing HHFab Validator', { fabricId });
    this.validateEnvironment();
  }

  validateEnvironment() {
    if (!this.hhfabPath) {
      throw new Error('HHFAB environment variable not set. Please set HHFAB=/path/to/hhfab');
    }
    
    try {
      execSync(`"${this.hhfabPath}" --version`, { stdio: 'pipe' });
      this.log('✓ HHFab binary found and accessible');
    } catch (error) {
      throw new Error(`HHFab binary not accessible at ${this.hhfabPath}: ${error.message}`);
    }
  }

  log(message, data = null) {
    if (this.verbose || data?.level === 'error') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${message}`);
      if (data && typeof data === 'object' && data.level !== 'error') {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  error(message, data = null) {
    console.error(`❌ ${message}`);
    if (data) {
      console.error(JSON.stringify(data, null, 2));
    }
  }

  success(message, data = null) {
    console.log(`✅ ${message}`);
    if (data && this.verbose) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  createTempDirectory() {
    const tempBase = join(process.cwd(), 'tmp');
    mkdirSync(tempBase, { recursive: true });
    
    // Create unique temp directory
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    this.tempDir = join(tempBase, `${TEMP_DIR_PREFIX}${timestamp}-${random}`);
    
    mkdirSync(this.tempDir, { recursive: true });
    this.log('✓ Created temporary directory', { tempDir: this.tempDir });
    return this.tempDir;
  }

  initializeHHFab() {
    try {
      this.log('Initializing hhfab in temporary directory...');
      const result = execSync(`"${this.hhfabPath}" init --dev`, {
        cwd: this.tempDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      this.log('✓ HHFab initialized successfully');
      if (this.verbose) {
        console.log(result);
      }
      
      return true;
    } catch (error) {
      this.error('Failed to initialize hhfab', {
        error: error.message,
        stderr: error.stderr?.toString(),
        stdout: error.stdout?.toString()
      });
      return false;
    }
  }

  findFGDFiles() {
    const fgdPath = join(projectRoot, 'fgd', this.fabricId);
    
    if (!existsSync(fgdPath)) {
      throw new Error(`Fabric directory not found: ${fgdPath}`);
    }
    
    const yamlFiles = [];
    const files = readdirSync(fgdPath);
    
    for (const file of files) {
      const fullPath = join(fgdPath, file);
      if (statSync(fullPath).isFile() && file.endsWith('.yaml')) {
        yamlFiles.push(fullPath);
      }
    }
    
    if (yamlFiles.length === 0) {
      throw new Error(`No YAML files found in ${fgdPath}`);
    }
    
    this.log('✓ Found FGD YAML files', { 
      fabricId: this.fabricId,
      files: yamlFiles.map(f => f.replace(projectRoot, '.')),
      count: yamlFiles.length
    });
    
    return yamlFiles;
  }

  copyFGDFiles(yamlFiles) {
    const includeDir = join(this.tempDir, 'include');
    mkdirSync(includeDir, { recursive: true });
    
    const copiedFiles = [];
    
    for (const sourcePath of yamlFiles) {
      const fileName = sourcePath.split('/').pop();
      const destPath = join(includeDir, fileName);
      
      try {
        copyFileSync(sourcePath, destPath);
        copiedFiles.push({
          source: sourcePath.replace(projectRoot, '.'),
          destination: destPath.replace(this.tempDir, '.')
        });
        this.log(`✓ Copied ${fileName}`);
      } catch (error) {
        this.error(`Failed to copy ${fileName}`, { error: error.message });
        return false;
      }
    }
    
    this.success('All FGD files copied successfully', {
      count: copiedFiles.length,
      files: copiedFiles
    });
    
    return true;
  }

  runValidation() {
    try {
      this.log('Running hhfab validate...');
      
      const result = execSync(`"${this.hhfabPath}" validate`, {
        cwd: this.tempDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      return {
        success: true,
        stdout: result,
        stderr: '',
        exitCode: 0
      };
      
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || '',
        exitCode: error.status || 1,
        error: error.message
      };
    }
  }

  parseValidationOutput(result) {
    const output = {
      success: result.success,
      exitCode: result.exitCode,
      errors: [],
      warnings: [],
      summary: '',
      details: result.stdout || ''
    };
    
    if (!result.success) {
      // Parse stderr for errors
      const stderr = result.stderr || '';
      const lines = stderr.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.toLowerCase().includes('error')) {
          output.errors.push(line.trim());
        } else if (line.toLowerCase().includes('warning')) {
          output.warnings.push(line.trim());
        }
      }
      
      // If no structured errors found, add the generic error
      if (output.errors.length === 0 && stderr) {
        output.errors.push(stderr.trim());
      }
    }
    
    // Parse stdout for summary information
    const stdout = result.stdout || '';
    const lines = stdout.split('\n');
    
    // Look for summary line or take last non-empty line
    const summaryLine = lines.reverse().find(line => 
      line.trim() && 
      (line.includes('validation') || 
       line.includes('success') || 
       line.includes('complete') ||
       line.includes('error'))
    );
    
    output.summary = summaryLine?.trim() || (result.success ? 'Validation completed successfully' : 'Validation failed');
    
    return output;
  }

  cleanup() {
    if (this.tempDir && existsSync(this.tempDir)) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true });
        this.log('✓ Cleaned up temporary directory');
      } catch (error) {
        this.error('Failed to cleanup temporary directory', { 
          tempDir: this.tempDir,
          error: error.message 
        });
      }
    }
  }

  async validate() {
    const startTime = Date.now();
    
    try {
      // Step 1: Create temp directory
      this.createTempDirectory();
      
      // Step 2: Initialize hhfab
      if (!this.initializeHHFab()) {
        throw new Error('Failed to initialize hhfab');
      }
      
      // Step 3: Find FGD files
      const yamlFiles = this.findFGDFiles();
      
      // Step 4: Copy FGD files to include directory
      if (!this.copyFGDFiles(yamlFiles)) {
        throw new Error('Failed to copy FGD files');
      }
      
      // Step 5: Run validation
      const result = this.runValidation();
      const parsed = this.parseValidationOutput(result);
      
      // Step 6: Report results
      const duration = Date.now() - startTime;
      
      if (parsed.success) {
        this.success(`PASS: Fabric validation successful`, {
          fabricId: this.fabricId,
          duration: `${duration}ms`,
          summary: parsed.summary,
          fileCount: yamlFiles.length
        });
        
        if (this.verbose && parsed.details) {
          console.log('\n--- Validation Details ---');
          console.log(parsed.details);
        }
        
        return { success: true, ...parsed };
      } else {
        this.error(`FAIL: Fabric validation failed`, {
          fabricId: this.fabricId,
          duration: `${duration}ms`,
          exitCode: parsed.exitCode,
          errors: parsed.errors,
          warnings: parsed.warnings
        });
        
        if (parsed.details && this.verbose) {
          console.log('\n--- Validation Output ---');
          console.log(parsed.details);
        }
        
        return { success: false, ...parsed };
      }
      
    } catch (error) {
      this.error('Validation process failed', {
        fabricId: this.fabricId,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      });
      
      return {
        success: false,
        error: error.message,
        exitCode: 1
      };
    } finally {
      this.cleanup();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const fabricId = args[0] || DEFAULT_FABRIC_ID;
  
  console.log(`🔍 HHFab Fabric Validation`);
  console.log(`📁 Fabric: ${fabricId}`);
  console.log('');
  
  const validator = new HHFabValidator(fabricId);
  const result = await validator.validate();
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

export { HHFabValidator };