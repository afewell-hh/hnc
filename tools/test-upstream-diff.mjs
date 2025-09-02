#!/usr/bin/env node

/**
 * Test Suite for UP-WATCH Upstream Diff Detector
 * 
 * Tests all functionality including:
 * - Basic diff detection
 * - CRD change analysis  
 * - Schema version tracking
 * - Report generation
 * - GitHub integration
 */

import { UpstreamDiffDetector } from './upstream-diff.mjs';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

class UpstreamDiffTester {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  }

  log(message, level = 'info') {
    if (level === 'verbose' && !this.verbose) return;
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'verbose' ? '🔍' : 'ℹ️';
    console.log(`${prefix} ${message}`);
  }

  async runTests() {
    this.log('🧪 Starting UP-WATCH Diff Detector Test Suite...');

    try {
      // Test 1: Basic Initialization
      await this.testBasicInitialization();
      
      // Test 2: Configuration Loading
      await this.testConfigurationLoading();
      
      // Test 3: Dry Run Mode
      await this.testDryRunMode();
      
      // Test 4: Format Options
      await this.testFormatOptions();
      
      // Test 5: File Type Detection
      await this.testFileTypeDetection();
      
      // Test 6: Git Operations
      await this.testGitOperations();
      
      // Test 7: Report Generation
      await this.testReportGeneration();
      
      // Test 8: GitHub Integration (if token available)
      await this.testGitHubIntegration();

      this.printSummary();

    } catch (error) {
      this.log(`💥 Test suite failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async testBasicInitialization() {
    this.log('Testing basic initialization...', 'verbose');
    
    try {
      const detector = new UpstreamDiffDetector({ dryRun: true });
      
      this.assert(detector.dryRun === true, 'Should initialize with dry run mode');
      this.assert(detector.format === 'markdown', 'Should default to markdown format');
      this.assert(detector.createGitHubIssue === false, 'Should default to no GitHub issue');
      
      this.recordTest('Basic Initialization', true);
    } catch (error) {
      this.recordTest('Basic Initialization', false, error.message);
    }
  }

  async testConfigurationLoading() {
    this.log('Testing configuration loading...', 'verbose');
    
    try {
      const detector = new UpstreamDiffDetector({ dryRun: true });
      await detector.loadCurrentState();
      
      this.assert(detector.upstreamConfig !== undefined, 'Should load upstream config');
      this.assert(detector.currentSnapshot !== undefined, 'Should load current snapshot');
      this.assert(Object.keys(detector.upstreamConfig.upstream).length > 0, 'Should have upstream repositories');
      
      this.recordTest('Configuration Loading', true);
    } catch (error) {
      this.recordTest('Configuration Loading', false, error.message);
    }
  }

  async testDryRunMode() {
    this.log('Testing dry run mode...', 'verbose');
    
    try {
      const detector = new UpstreamDiffDetector({ dryRun: true });
      await detector.loadCurrentState();
      
      // Mock the analysis to avoid actual git operations
      detector.changes.summary.hasChanges = false;
      detector.calculateSummary();
      
      // This should not create any files
      const reportPath = join(ROOT_DIR, 'upstream-diff-report.md');
      const existsBefore = existsSync(reportPath);
      
      await detector.generateReport();
      
      const existsAfter = existsSync(reportPath);
      
      this.assert(existsBefore === existsAfter, 'Should not create files in dry run mode');
      
      this.recordTest('Dry Run Mode', true);
    } catch (error) {
      this.recordTest('Dry Run Mode', false, error.message);
    }
  }

  async testFormatOptions() {
    this.log('Testing format options...', 'verbose');
    
    try {
      const markdownDetector = new UpstreamDiffDetector({ format: 'markdown', dryRun: true });
      const jsonDetector = new UpstreamDiffDetector({ format: 'json', dryRun: true });
      
      this.assert(markdownDetector.format === 'markdown', 'Should set markdown format');
      this.assert(jsonDetector.format === 'json', 'Should set JSON format');
      
      this.recordTest('Format Options', true);
    } catch (error) {
      this.recordTest('Format Options', false, error.message);
    }
  }

  async testFileTypeDetection() {
    this.log('Testing file type detection...', 'verbose');
    
    try {
      const detector = new UpstreamDiffDetector({ dryRun: true });
      const mockConfig = { sync_paths: ['config/crd', 'examples'] };
      
      // Test CRD detection
      this.assert(
        detector.determineFileType('config/crd/bases/fabric.githedgehog.com_switches.yaml', mockConfig) === 'crd',
        'Should detect CRD files'
      );
      
      // Test switch profile detection  
      this.assert(
        detector.determineFileType('config/switches/ds2000.yaml', mockConfig) === 'switchProfile',
        'Should detect switch profile files'
      );
      
      // Test example detection
      this.assert(
        detector.determineFileType('examples/fabric-configs/simple.yaml', mockConfig) === 'example',
        'Should detect example files'
      );
      
      // Test non-relevant files
      this.assert(
        detector.determineFileType('README.md', mockConfig) === null,
        'Should ignore non-relevant files'
      );
      
      this.recordTest('File Type Detection', true);
    } catch (error) {
      this.recordTest('File Type Detection', false, error.message);
    }
  }

  async testGitOperations() {
    this.log('Testing Git operations...', 'verbose');
    
    try {
      const detector = new UpstreamDiffDetector({ dryRun: true });
      
      // Test with fabric repository
      const fabricPath = join(ROOT_DIR, '.upstream/fabric');
      
      if (existsSync(fabricPath)) {
        const commit = detector.getGitCommit(fabricPath, 'HEAD');
        this.assert(commit && commit.length === 40, 'Should get valid commit hash');
        
        // Test getting changed files (empty since we're comparing HEAD to HEAD)
        const changedFiles = detector.getChangedFiles(fabricPath, commit, commit);
        this.assert(Array.isArray(changedFiles), 'Should return array of changed files');
        
        this.recordTest('Git Operations', true);
      } else {
        this.recordTest('Git Operations', false, 'Fabric repository not found');
      }
    } catch (error) {
      this.recordTest('Git Operations', false, error.message);
    }
  }

  async testReportGeneration() {
    this.log('Testing report generation...', 'verbose');
    
    try {
      const detector = new UpstreamDiffDetector({ dryRun: true });
      
      // Mock some changes
      detector.changes.crds.added.push({
        repository: 'test-repo',
        file: 'test.crd.yaml',
        crdName: 'test.example.com',
        kind: 'TestResource'
      });
      
      detector.changes.summary.totalChanges = 1;
      detector.changes.summary.hasChanges = true;
      
      // Test markdown generation
      detector.format = 'markdown';
      await detector.generateMarkdownReport();
      
      // Test JSON generation
      detector.format = 'json';
      await detector.generateJsonReport();
      
      this.recordTest('Report Generation', true);
    } catch (error) {
      this.recordTest('Report Generation', false, error.message);
    }
  }

  async testGitHubIntegration() {
    this.log('Testing GitHub integration...', 'verbose');
    
    try {
      const hasToken = !!process.env.GITHUB_TOKEN;
      const detector = new UpstreamDiffDetector({ 
        createGitHubIssue: true,
        dryRun: true 
      });
      
      // Mock changes to test issue creation
      detector.changes.summary.hasChanges = true;
      detector.changes.summary.totalChanges = 1;
      detector.changes.crds.added.push({
        repository: 'test',
        crdName: 'test.example.com'
      });
      
      const issueBody = await detector.generateGitHubIssueBody();
      this.assert(issueBody.includes('Upstream Changes Detected'), 'Should generate issue body');
      this.assert(issueBody.includes('test.example.com'), 'Should include CRD details');
      
      if (hasToken) {
        this.log('GitHub token available - testing issue creation (dry run)', 'verbose');
        await detector.createGitHubIssueIfRequested();
      } else {
        this.log('No GitHub token - skipping issue creation test', 'verbose');
      }
      
      this.recordTest('GitHub Integration', true);
    } catch (error) {
      this.recordTest('GitHub Integration', false, error.message);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  recordTest(testName, passed, error = null) {
    this.totalTests++;
    if (passed) {
      this.passedTests++;
      this.log(`✅ ${testName}`, 'success');
    } else {
      this.log(`❌ ${testName}: ${error}`, 'error');
    }
    
    this.testResults.push({ testName, passed, error });
  }

  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    
    if (this.passedTests === this.totalTests) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed!');
      process.exit(1);
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new UpstreamDiffTester();
  tester.runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { UpstreamDiffTester };