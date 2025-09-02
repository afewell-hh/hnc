#!/usr/bin/env node

/**
 * Upstream CRD and Schema Extraction Tool
 * 
 * Extracts CRDs (wiring+VPC) & switch profiles from upstream repositories
 * Generates JSON snapshots + TypeScript types, collects example YAMLs
 * 
 * Usage: node tools/upstream-extract.mjs [--verbose] [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import jsyaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

class UpstreamExtractor {
  constructor() {
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
    
    // Priority CRDs for wiring and VPC
    this.priorityCrds = [
      'connections.wiring.githedgehog.com',
      'switches.wiring.githedgehog.com',
      'switchprofiles.wiring.githedgehog.com',
      'servers.wiring.githedgehog.com',
      'serverprofiles.wiring.githedgehog.com',
      'vpcs.vpc.githedgehog.com',
      'vpcattachments.vpc.githedgehog.com',
      'vpcpeerings.vpc.githedgehog.com',
      'externals.vpc.githedgehog.com',
      'externalattachments.vpc.githedgehog.com',
      'externalpeerings.vpc.githedgehog.com'
    ];

    this.extractedData = {
      crds: {},
      switchProfiles: {},
      examples: {},
      metadata: {
        extracted_at: new Date().toISOString(),
        priority_crds: this.priorityCrds,
        sources: {
          fabricator: '.upstream/fabricator/config/crd/bases',
          fabric: '.upstream/fabric/config/crd/bases',
          docs: '.upstream/docs'
        }
      }
    };
  }

  log(message) {
    if (this.verbose) {
      console.log(`[EXTRACT] ${message}`);
    }
  }

  ensureOutputDirs() {
    const dirs = [
      join(ROOT_DIR, 'src/upstream'),
      join(ROOT_DIR, 'src/upstream/crd'),
      join(ROOT_DIR, 'src/upstream/types'),
      join(ROOT_DIR, 'src/upstream/examples')
    ];

    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        if (!this.dryRun) {
          mkdirSync(dir, { recursive: true });
        }
        this.log(`Created directory: ${dir}`);
      }
    });
  }

  loadYamlFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      return jsyaml.load(content);
    } catch (error) {
      this.log(`Failed to load YAML ${filePath}: ${error.message}`);
      return null;
    }
  }

  extractCrdsFromRepo(repoPath, repoName) {
    const crdBasesPath = join(ROOT_DIR, repoPath);
    
    if (!existsSync(crdBasesPath)) {
      this.log(`CRD directory not found: ${crdBasesPath}`);
      return;
    }

    this.log(`Extracting CRDs from ${repoName}: ${crdBasesPath}`);
    
    const files = readdirSync(crdBasesPath);
    let extracted = 0;
    
    files.forEach(file => {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) return;
      
      const filePath = join(crdBasesPath, file);
      const crd = this.loadYamlFile(filePath);
      
      if (!crd || crd.kind !== 'CustomResourceDefinition') {
        this.log(`Skipping non-CRD file: ${file}`);
        return;
      }

      const crdName = crd.metadata?.name;
      if (!crdName) {
        this.log(`CRD missing name in metadata: ${file}`);
        return;
      }

      // Check if this is a priority CRD or extract all
      const isPriority = this.priorityCrds.includes(crdName);
      
      this.extractedData.crds[crdName] = {
        source: repoName,
        file: file,
        priority: isPriority,
        kind: crd.spec?.names?.kind,
        group: crd.spec?.group,
        versions: crd.spec?.versions?.map(v => v.name) || [],
        scope: crd.spec?.scope,
        schema: crd,
        extracted_at: new Date().toISOString()
      };

      // Write individual CRD file
      const outputPath = join(ROOT_DIR, 'src/upstream/crd', `${crdName}.json`);
      if (!this.dryRun) {
        writeFileSync(outputPath, JSON.stringify(crd, null, 2));
      }
      
      extracted++;
      this.log(`Extracted CRD: ${crdName} (${isPriority ? 'priority' : 'standard'})`);
    });
    
    this.log(`Extracted ${extracted} CRDs from ${repoName}`);
  }

  extractSwitchProfiles() {
    this.log('Extracting switch profiles from CRDs');
    
    const switchProfileCrd = this.extractedData.crds['switchprofiles.wiring.githedgehog.com'];
    if (!switchProfileCrd) {
      this.log('No switch profiles CRD found');
      return;
    }

    // Extract switch profile schema for type generation
    const schema = switchProfileCrd.schema;
    const versions = schema.spec?.versions || [];
    
    versions.forEach(version => {
      if (version.schema?.openAPIV3Schema) {
        const profileSchema = version.schema.openAPIV3Schema;
        
        this.extractedData.switchProfiles[version.name] = {
          version: version.name,
          schema: profileSchema,
          properties: this.extractSchemaProperties(profileSchema),
          extracted_at: new Date().toISOString()
        };
        
        this.log(`Extracted switch profile schema for version: ${version.name}`);
      }
    });
  }

  extractSchemaProperties(schema) {
    const properties = {};
    
    if (schema.properties?.spec?.properties) {
      const specProps = schema.properties.spec.properties;
      
      // Extract key properties for switch profiles
      ['displayName', 'otherNames', 'ports', 'portGroups', 'portBreakouts'].forEach(prop => {
        if (specProps[prop]) {
          properties[prop] = {
            type: specProps[prop].type,
            description: specProps[prop].description,
            format: specProps[prop].format,
            items: specProps[prop].items
          };
        }
      });
    }

    return properties;
  }

  collectExampleYamls() {
    this.log('Collecting example YAMLs from docs');
    
    const docsPath = join(ROOT_DIR, '.upstream/docs/docs');
    if (!existsSync(docsPath)) {
      this.log('Docs directory not found');
      return;
    }

    this.collectYamlsRecursive(docsPath, 'docs');
  }

  collectYamlsRecursive(dirPath, category) {
    if (!existsSync(dirPath)) return;
    
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      
      entries.forEach(entry => {
        const fullPath = join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          this.collectYamlsRecursive(fullPath, category);
        } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
          this.collectExampleYaml(fullPath, category);
        }
      });
    } catch (error) {
      this.log(`Failed to read directory ${dirPath}: ${error.message}`);
    }
  }

  collectExampleYaml(filePath, category) {
    const content = this.loadYamlFile(filePath);
    if (!content) return;

    const relativePath = filePath.replace(join(ROOT_DIR, '.upstream/'), '');
    const filename = basename(filePath);
    
    // Check if it's a relevant example (contains our priority CRDs)
    const isRelevant = this.isRelevantExample(content);
    
    if (isRelevant || this.verbose) {
      this.extractedData.examples[relativePath] = {
        file: filename,
        category: category,
        relevant: isRelevant,
        kind: content.kind,
        apiVersion: content.apiVersion,
        content: content,
        extracted_at: new Date().toISOString()
      };
      
      this.log(`Collected example: ${filename} (${isRelevant ? 'relevant' : 'general'})`);
    }
  }

  isRelevantExample(content) {
    if (!content.apiVersion) return false;
    
    // Check if it's one of our priority API groups
    return content.apiVersion.includes('wiring.githedgehog.com') ||
           content.apiVersion.includes('vpc.githedgehog.com') ||
           content.apiVersion.includes('fabricator.githedgehog.com');
  }

  generateTypeScriptTypes() {
    this.log('Generating TypeScript types from CRD schemas');
    
    let typeDefinitions = `// Generated TypeScript types from upstream CRDs
// DO NOT EDIT - Generated by tools/upstream-extract.mjs
// Generated at: ${new Date().toISOString()}

export interface K8sMetadata {
  name?: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: K8sMetadata;
}

`;

    // Generate types for priority CRDs
    Object.entries(this.extractedData.crds).forEach(([crdName, crdData]) => {
      if (!crdData.priority) return;
      
      const typeName = crdData.kind;
      const schema = crdData.schema;
      
      if (schema.spec?.versions?.[0]?.schema?.openAPIV3Schema) {
        const openApiSchema = schema.spec.versions[0].schema.openAPIV3Schema;
        const typeStr = this.generateTypeFromSchema(typeName, openApiSchema);
        typeDefinitions += typeStr + '\n\n';
        
        this.log(`Generated TypeScript type for: ${typeName}`);
      }
    });

    // Write TypeScript definitions
    const outputPath = join(ROOT_DIR, 'src/upstream/types/generated.d.ts');
    if (!this.dryRun) {
      writeFileSync(outputPath, typeDefinitions);
    }
    
    this.log(`TypeScript types written to: src/upstream/types/generated.d.ts`);
  }

  generateTypeFromSchema(typeName, schema) {
    let typeStr = `export interface ${typeName} extends K8sResource {\n`;
    
    // Add spec if it exists
    if (schema.properties?.spec) {
      typeStr += `  spec: {\n`;
      typeStr += this.generatePropertiesType(schema.properties.spec, '    ');
      typeStr += `  };\n`;
    }
    
    // Add status if it exists
    if (schema.properties?.status) {
      typeStr += `  status?: {\n`;
      typeStr += this.generatePropertiesType(schema.properties.status, '    ');
      typeStr += `  };\n`;
    }
    
    typeStr += `}`;
    
    return typeStr;
  }

  generatePropertiesType(propSchema, indent = '') {
    let propsStr = '';
    
    if (propSchema.properties) {
      Object.entries(propSchema.properties).forEach(([propName, propDef]) => {
        const isRequired = propSchema.required?.includes(propName) ? '' : '?';
        const propType = this.getTypeScriptType(propDef);
        
        if (propDef.description) {
          propsStr += `${indent}/** ${propDef.description} */\n`;
        }
        propsStr += `${indent}${propName}${isRequired}: ${propType};\n`;
      });
    }
    
    return propsStr;
  }

  getTypeScriptType(propDef) {
    switch (propDef.type) {
      case 'string':
        return 'string';
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        if (propDef.items) {
          const itemType = this.getTypeScriptType(propDef.items);
          return `${itemType}[]`;
        }
        return 'any[]';
      case 'object':
        if (propDef.additionalProperties === false && propDef.properties) {
          let objStr = '{\n';
          Object.entries(propDef.properties).forEach(([key, val]) => {
            objStr += `    ${key}: ${this.getTypeScriptType(val)};\n`;
          });
          objStr += '  }';
          return objStr;
        }
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }

  createJsonSnapshots() {
    this.log('Creating JSON snapshots');
    
    // Main extraction snapshot
    const snapshotPath = join(ROOT_DIR, 'src/upstream/extraction-snapshot.json');
    if (!this.dryRun) {
      writeFileSync(snapshotPath, JSON.stringify(this.extractedData, null, 2));
    }
    
    // Summary snapshot
    const summary = {
      extracted_at: this.extractedData.metadata.extracted_at,
      stats: {
        total_crds: Object.keys(this.extractedData.crds).length,
        priority_crds: Object.values(this.extractedData.crds).filter(c => c.priority).length,
        switch_profiles: Object.keys(this.extractedData.switchProfiles).length,
        examples: Object.keys(this.extractedData.examples).length,
        relevant_examples: Object.values(this.extractedData.examples).filter(e => e.relevant).length
      },
      priority_crds: this.priorityCrds,
      generated_types: true
    };
    
    const summaryPath = join(ROOT_DIR, 'src/upstream/extraction-summary.json');
    if (!this.dryRun) {
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    }
    
    this.log(`JSON snapshots created: ${Object.keys(this.extractedData.crds).length} CRDs extracted`);
  }

  async run() {
    this.log('Starting upstream extraction');
    
    if (this.dryRun) {
      this.log('DRY RUN MODE - No files will be written');
    }

    this.ensureOutputDirs();
    
    // Extract CRDs from both repositories
    this.extractCrdsFromRepo('.upstream/fabricator/config/crd/bases', 'fabricator');
    this.extractCrdsFromRepo('.upstream/fabric/config/crd/bases', 'fabric');
    
    // Extract switch profiles
    this.extractSwitchProfiles();
    
    // Collect examples
    this.collectExampleYamls();
    
    // Generate TypeScript types
    this.generateTypeScriptTypes();
    
    // Create JSON snapshots
    this.createJsonSnapshots();
    
    this.log(`Extraction completed: ${Object.keys(this.extractedData.crds).length} CRDs, ${Object.keys(this.extractedData.switchProfiles).length} switch profile schemas, ${Object.keys(this.extractedData.examples).length} examples`);
  }
}

// Run extraction
if (import.meta.url === `file://${process.argv[1]}`) {
  const extractor = new UpstreamExtractor();
  await extractor.run();
}