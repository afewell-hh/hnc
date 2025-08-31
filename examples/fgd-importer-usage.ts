/**
 * FGD Importer Usage Examples
 * 
 * This file demonstrates how to use the FGD importer to reverse-engineer
 * FabricSpec from existing fabric deployments.
 */

import { importFromFGD, ImportError } from '../src/domain/fgd-importer';
import * as path from 'path';

async function basicImportExample() {
  console.log('=== Basic FGD Import Example ===\n');
  
  try {
    // Import from an existing FGD directory
    const fgdPath = path.resolve('./fgd/golden-path-fabric');
    const result = await importFromFGD(fgdPath);
    
    if (result.validation.isValid) {
      console.log('✅ Import successful!');
      console.log(`Fabric Name: ${result.fabricSpec.name}`);
      console.log(`Spine Model: ${result.fabricSpec.spineModelId}`);
      console.log(`Leaf Model: ${result.fabricSpec.leafModelId}`);
      console.log(`Topology Type: ${result.provenance.detectedPatterns.topologyType}`);
      console.log(`Uplinks per Leaf: ${result.fabricSpec.uplinksPerLeaf}`);
      console.log(`Total Servers: ${result.fabricSpec.endpointCount}`);
      
      // Check provenance information
      console.log('\n📋 Detected Patterns:');
      console.log(`- Spine Count: ${result.provenance.detectedPatterns.spineCount}`);
      console.log(`- Leaf Count: ${result.provenance.detectedPatterns.leafCount}`);
      console.log(`- Server Types: ${Array.from(result.provenance.detectedPatterns.serverTypes).join(', ')}`);
      
      // Show any warnings or assumptions
      if (result.provenance.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.provenance.warnings.forEach(warning => console.log(`- ${warning}`));
      }
      
      if (result.provenance.assumptions.length > 0) {
        console.log('\n💭 Assumptions Made:');
        result.provenance.assumptions.forEach(assumption => console.log(`- ${assumption}`));
      }
      
    } else {
      console.log('❌ Import completed with validation errors:');
      result.validation.errors.forEach(error => console.log(`- ${error}`));
    }
    
  } catch (error) {
    if (error instanceof ImportError) {
      console.error('❌ Import failed:', error.message);
    } else {
      console.error('❌ Unexpected error:', error);
    }
  }
}

async function multiClassImportExample() {
  console.log('\n=== Multi-Class FGD Import Example ===\n');
  
  try {
    const fgdPath = path.resolve('./fgd/multi-class-test');
    const result = await importFromFGD(fgdPath);
    
    console.log(`Fabric: ${result.fabricSpec.name}`);
    console.log(`Topology: ${result.provenance.detectedPatterns.topologyType}`);
    
    if (result.fabricSpec.leafClasses) {
      console.log('\n🏗️  Detected Leaf Classes:');
      result.fabricSpec.leafClasses.forEach((leafClass, index) => {
        console.log(`${index + 1}. ${leafClass.name}`);
        console.log(`   - ID: ${leafClass.id}`);
        console.log(`   - Uplinks: ${leafClass.uplinksPerLeaf}`);
        console.log(`   - Endpoint Profiles:`);
        leafClass.endpointProfiles.forEach(profile => {
          console.log(`     * ${profile.name}: ${profile.count} servers, ${profile.portsPerEndpoint} ports each`);
        });
      });
    } else {
      console.log('📦 Single-class topology using legacy format');
      console.log(`   - Uplinks per Leaf: ${result.fabricSpec.uplinksPerLeaf}`);
      console.log(`   - Endpoint Profile: ${result.fabricSpec.endpointProfile?.name}`);
      console.log(`   - Total Endpoints: ${result.fabricSpec.endpointCount}`);
    }
    
  } catch (error) {
    console.error('❌ Multi-class import failed:', error instanceof Error ? error.message : error);
  }
}

async function capacityValidationExample() {
  console.log('\n=== Capacity Validation Example ===\n');
  
  try {
    // Try importing a large fabric that might have capacity issues
    const fgdPath = path.resolve('./fgd/large-test');
    const result = await importFromFGD(fgdPath);
    
    console.log(`Fabric: ${result.fabricSpec.name}`);
    console.log(`Validation Status: ${result.validation.isValid ? '✅ Valid' : '❌ Has Issues'}`);
    
    if (result.validation.errors.length > 0) {
      console.log('\n🚨 Capacity Errors:');
      result.validation.errors.forEach(error => console.log(`- ${error}`));
    }
    
    if (result.validation.warnings.length > 0) {
      console.log('\n⚠️  Capacity Warnings:');
      result.validation.warnings.forEach(warning => console.log(`- ${warning}`));
    }
    
    // Show topology metrics
    console.log('\n📊 Topology Metrics:');
    console.log(`- Detected ${result.provenance.detectedPatterns.spineCount} spine(s)`);
    console.log(`- Detected ${result.provenance.detectedPatterns.leafCount} leaf/leaves`);
    console.log(`- Total server types: ${result.provenance.detectedPatterns.serverTypes.size}`);
    
  } catch (error) {
    console.error('❌ Large fabric import failed:', error instanceof Error ? error.message : error);
  }
}

async function provenanceTrackingExample() {
  console.log('\n=== Provenance Tracking Example ===\n');
  
  try {
    const fgdPath = path.resolve('./fgd/golden-path-fabric');
    const result = await importFromFGD(fgdPath);
    
    console.log('🔍 Detailed Provenance Information:');
    console.log(`- Source: ${result.provenance.source}`);
    console.log(`- Original Path: ${result.provenance.originalPath}`);
    console.log(`- Imported At: ${result.provenance.importedAt.toISOString()}`);
    console.log(`- Original Generated At: ${result.fabricSpec.metadata?.originalGeneratedAt}`);
    
    console.log('\n🔗 Connection Patterns:');
    result.provenance.detectedPatterns.uplinkPatterns.forEach((uplinks, leafId) => {
      console.log(`- ${leafId}: ${uplinks} uplinks`);
    });
    
    console.log('\n📈 Metadata Preserved:');
    if (result.fabricSpec.metadata) {
      Object.entries(result.fabricSpec.metadata).forEach(([key, value]) => {
        console.log(`- ${key}: ${value}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Provenance example failed:', error instanceof Error ? error.message : error);
  }
}

async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===\n');
  
  // Try to import from non-existent directory
  try {
    await importFromFGD('./non-existent-fgd');
  } catch (error) {
    if (error instanceof ImportError) {
      console.log('✅ Correctly caught ImportError:', error.message);
    }
  }
  
  // Try to import from directory with missing files
  try {
    await importFromFGD('./fgd'); // Directory exists but missing required files
  } catch (error) {
    if (error instanceof ImportError) {
      console.log('✅ Correctly caught missing files error:', error.message);
    }
  }
  
  console.log('🛡️  Error handling working as expected');
}

// Main execution
async function main() {
  console.log('FGD Importer Usage Examples');
  console.log('============================\n');
  
  await basicImportExample();
  await multiClassImportExample();
  await capacityValidationExample();
  await provenanceTrackingExample();
  await errorHandlingExample();
  
  console.log('\n✨ All examples completed!');
}

// Export for use in other files
export {
  basicImportExample,
  multiClassImportExample,
  capacityValidationExample,
  provenanceTrackingExample,
  errorHandlingExample
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}