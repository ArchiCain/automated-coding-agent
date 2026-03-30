# Project Analyzer Specification

The Project Analyzer scans and understands codebases, detecting tech stack, mapping structure, and generating initial memory to inform decomposition and execution.

## Core Responsibility

> Understand what a project is, how it's structured, what technologies it uses, and how its components relate to each other.

---

## Analysis Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROJECT ANALYZER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   DETECTION LAYER                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │  STACK   │  │FRAMEWORK │  │   BUILD  │  │    TEST    │  │ │
│  │  │ DETECTOR │  │ DETECTOR │  │ DETECTOR │  │  DETECTOR  │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   MAPPING LAYER                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │STRUCTURE │  │DEPENDENCY│  │  MODULE  │  │    API     │  │ │
│  │  │  MAPPER  │  │  MAPPER  │  │  MAPPER  │  │   MAPPER   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  EXTRACTION LAYER                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │ PATTERN  │  │  ENTITY  │  │ SUMMARY  │  │  CONTEXT   │  │ │
│  │  │EXTRACTOR │  │EXTRACTOR │  │GENERATOR │  │  BUILDER   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Analysis Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECT PATH PROVIDED                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. QUICK SCAN                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • List all files (respecting .gitignore)                       │
│  • Identify config files (package.json, tsconfig, etc.)         │
│  • Count files by extension                                     │
│  • Calculate project size                                       │
│  ~1-2 seconds                                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. STACK DETECTION                            │
│  ─────────────────────────────────────────────────────────────  │
│  • Parse package.json / requirements.txt / go.mod / etc.        │
│  • Identify languages, frameworks, libraries                    │
│  • Detect build tools, test frameworks                          │
│  • Determine project type (web app, API, library, etc.)         │
│  ~2-3 seconds                                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. STRUCTURE MAPPING                          │
│  ─────────────────────────────────────────────────────────────  │
│  • Identify key directories (src, tests, config, etc.)          │
│  • Map module boundaries                                        │
│  • Detect architectural patterns (MVC, hexagonal, etc.)         │
│  • Identify entry points                                        │
│  ~3-5 seconds                                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. DEPENDENCY ANALYSIS                        │
│  ─────────────────────────────────────────────────────────────  │
│  • Parse imports across files                                   │
│  • Build dependency graph                                       │
│  • Identify circular dependencies                               │
│  • Calculate module coupling                                    │
│  ~5-10 seconds                                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5. ENTITY EXTRACTION                          │
│  ─────────────────────────────────────────────────────────────  │
│  • Parse key files (services, controllers, entities)            │
│  • Extract class/function signatures                            │
│  • Generate summaries via LLM (batched)                         │
│  ~10-30 seconds (LLM dependent)                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    6. PATTERN EXTRACTION                         │
│  ─────────────────────────────────────────────────────────────  │
│  • Analyze representative files for patterns                    │
│  • Identify coding conventions                                  │
│  • Extract error handling patterns                              │
│  • Detect naming conventions                                    │
│  ~10-20 seconds (LLM dependent)                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    7. SUMMARY GENERATION                         │
│  ─────────────────────────────────────────────────────────────  │
│  • Generate architecture overview                               │
│  • Generate module summaries                                    │
│  • Document key decisions                                       │
│  ~10-20 seconds (LLM dependent)                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    8. CACHE & PERSIST                            │
│  ─────────────────────────────────────────────────────────────  │
│  • Write analysis to .rtslabs/analysis/                         │
│  • Populate memory system                                       │
│  • Record commit hash for invalidation                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Stack Detector

Identifies languages, frameworks, and tools.

```typescript
interface StackDetector {
  detect(projectPath: string): Promise<StackInfo>;
}

interface StackInfo {
  // Languages
  languages: {
    name: string;           // e.g., 'typescript', 'python'
    version?: string;       // e.g., '5.0'
    percentage: number;     // % of codebase
    config_file?: string;   // e.g., 'tsconfig.json'
  }[];

  // Frameworks
  frameworks: {
    name: string;           // e.g., 'nestjs', 'react'
    version: string;
    category: FrameworkCategory;
    config_file?: string;
  }[];

  // Build & tooling
  build: {
    tool: string;           // e.g., 'webpack', 'vite', 'turbo'
    version?: string;
    config_file: string;
  } | null;

  package_manager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;

  // Testing
  test: {
    framework: string;      // e.g., 'jest', 'vitest', 'pytest'
    version?: string;
    config_file?: string;
  } | null;

  // Database
  database: {
    type: string;           // e.g., 'postgresql', 'mongodb'
    orm?: string;           // e.g., 'typeorm', 'prisma'
  } | null;

  // Runtime
  runtime: {
    name: string;           // e.g., 'node', 'deno', 'bun'
    version?: string;
  } | null;

  // Project type inference
  project_type: ProjectType;

  // Monorepo detection
  monorepo: {
    detected: boolean;
    tool?: string;          // e.g., 'nx', 'turborepo', 'lerna'
    packages?: string[];
  };
}

type FrameworkCategory =
  | 'backend'
  | 'frontend'
  | 'fullstack'
  | 'testing'
  | 'orm'
  | 'validation'
  | 'auth'
  | 'utility';

type ProjectType =
  | 'web_app'
  | 'api'
  | 'cli'
  | 'library'
  | 'monorepo'
  | 'mobile_app'
  | 'desktop_app'
  | 'unknown';
```

**Detection Rules:**

```typescript
const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
  // NestJS
  {
    name: 'nestjs',
    category: 'backend',
    indicators: [
      { type: 'dependency', name: '@nestjs/core' },
      { type: 'file', pattern: '*.module.ts' },
      { type: 'file', pattern: 'nest-cli.json' }
    ],
    confidence_threshold: 0.7
  },
  // React
  {
    name: 'react',
    category: 'frontend',
    indicators: [
      { type: 'dependency', name: 'react' },
      { type: 'file', pattern: '*.tsx' },
      { type: 'content', pattern: /import.*from ['"]react['"]/ }
    ],
    confidence_threshold: 0.6
  },
  // TypeORM
  {
    name: 'typeorm',
    category: 'orm',
    indicators: [
      { type: 'dependency', name: 'typeorm' },
      { type: 'file', pattern: '*.entity.ts' },
      { type: 'content', pattern: /@Entity\(/ }
    ],
    confidence_threshold: 0.8
  },
  // Prisma
  {
    name: 'prisma',
    category: 'orm',
    indicators: [
      { type: 'dependency', name: '@prisma/client' },
      { type: 'file', pattern: 'schema.prisma' }
    ],
    confidence_threshold: 0.9
  },
  // Jest
  {
    name: 'jest',
    category: 'testing',
    indicators: [
      { type: 'dependency', name: 'jest' },
      { type: 'file', pattern: 'jest.config.*' },
      { type: 'file', pattern: '*.spec.ts' }
    ],
    confidence_threshold: 0.7
  }
  // ... more frameworks
];

async function detectFrameworks(projectPath: string): Promise<FrameworkInfo[]> {
  const detected: FrameworkInfo[] = [];
  const packageJson = await readPackageJson(projectPath);
  const files = await listFiles(projectPath);

  for (const signature of FRAMEWORK_SIGNATURES) {
    let confidence = 0;

    for (const indicator of signature.indicators) {
      switch (indicator.type) {
        case 'dependency':
          if (hasDependency(packageJson, indicator.name)) {
            confidence += 0.4;
          }
          break;
        case 'file':
          if (files.some(f => minimatch(f, indicator.pattern))) {
            confidence += 0.3;
          }
          break;
        case 'content':
          if (await hasContentMatch(projectPath, indicator.pattern)) {
            confidence += 0.3;
          }
          break;
      }
    }

    if (confidence >= signature.confidence_threshold) {
      detected.push({
        name: signature.name,
        version: getDependencyVersion(packageJson, signature.name),
        category: signature.category,
        confidence
      });
    }
  }

  return detected;
}
```

---

### 2. Structure Mapper

Maps the directory structure and identifies key areas.

```typescript
interface StructureMapper {
  map(projectPath: string, stackInfo: StackInfo): Promise<ProjectStructure>;
}

interface ProjectStructure {
  root: string;

  // Key directories
  directories: {
    path: string;
    type: DirectoryType;
    description: string;
    file_count: number;
    main_language?: string;
  }[];

  // Entry points
  entry_points: {
    path: string;
    type: 'main' | 'test' | 'build' | 'config';
    description: string;
  }[];

  // Module structure (for modular projects)
  modules: ModuleInfo[];

  // Architectural pattern
  architecture: {
    pattern: ArchitecturePattern;
    confidence: number;
    layers?: {
      name: string;
      directories: string[];
      description: string;
    }[];
  };

  // File statistics
  stats: {
    total_files: number;
    total_directories: number;
    by_extension: Record<string, number>;
    by_directory: Record<string, number>;
    largest_files: { path: string; lines: number }[];
  };
}

type DirectoryType =
  | 'source'
  | 'test'
  | 'config'
  | 'build'
  | 'docs'
  | 'assets'
  | 'scripts'
  | 'generated'
  | 'vendor'
  | 'unknown';

type ArchitecturePattern =
  | 'mvc'
  | 'hexagonal'
  | 'clean'
  | 'layered'
  | 'modular'
  | 'microservices'
  | 'monolith'
  | 'unknown';

interface ModuleInfo {
  name: string;
  path: string;
  type: 'feature' | 'shared' | 'core' | 'infrastructure';
  files: string[];
  exports: string[];
  dependencies: string[];  // Other module names
}
```

**Framework-Specific Structure Detection:**

```typescript
const STRUCTURE_PATTERNS: Record<string, StructurePattern> = {
  nestjs: {
    architecture: 'modular',
    directories: [
      { pattern: 'src/*/**.module.ts', type: 'feature_module' },
      { pattern: 'src/common/**', type: 'shared' },
      { pattern: 'src/config/**', type: 'config' }
    ],
    entry_points: [
      { pattern: 'src/main.ts', type: 'main' },
      { pattern: 'src/app.module.ts', type: 'root_module' }
    ]
  },
  react: {
    architecture: 'component_based',
    directories: [
      { pattern: 'src/components/**', type: 'components' },
      { pattern: 'src/pages/**', type: 'pages' },
      { pattern: 'src/hooks/**', type: 'hooks' },
      { pattern: 'src/stores/**', type: 'state' }
    ],
    entry_points: [
      { pattern: 'src/index.tsx', type: 'main' },
      { pattern: 'src/App.tsx', type: 'root_component' }
    ]
  }
};

async function detectArchitecture(
  projectPath: string,
  files: string[],
  stackInfo: StackInfo
): Promise<ArchitectureInfo> {
  // Try framework-specific patterns first
  for (const framework of stackInfo.frameworks) {
    const pattern = STRUCTURE_PATTERNS[framework.name];
    if (pattern) {
      const matchScore = calculatePatternMatch(files, pattern);
      if (matchScore > 0.7) {
        return {
          pattern: pattern.architecture,
          confidence: matchScore,
          source: `${framework.name} convention`
        };
      }
    }
  }

  // Fall back to generic detection
  return detectGenericArchitecture(files);
}
```

---

### 3. Dependency Mapper

Analyzes import relationships between files.

```typescript
interface DependencyMapper {
  map(projectPath: string, files: string[]): Promise<DependencyGraph>;
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];

  // Analysis
  circular_dependencies: string[][];
  external_dependencies: ExternalDependency[];
  orphan_files: string[];        // Files with no imports or exports

  // Metrics
  metrics: {
    avg_dependencies_per_file: number;
    max_dependencies: { file: string; count: number };
    coupling_score: number;      // 0-1, lower is better
    cohesion_by_module: Record<string, number>;
  };
}

interface DependencyNode {
  id: string;                    // File path
  type: 'file' | 'module' | 'external';
  exports: string[];             // What this file exports
  language: string;
}

interface DependencyEdge {
  from: string;                  // Source file
  to: string;                    // Target file/module
  type: 'import' | 'dynamic_import' | 're_export';
  imports: string[];             // Specific imports
}

interface ExternalDependency {
  name: string;
  version: string;
  used_by: string[];             // Files that import this
  import_count: number;
}
```

**Import Parsing:**

```typescript
async function parseImports(filePath: string, content: string): Promise<Import[]> {
  const imports: Import[] = [];
  const ext = path.extname(filePath);

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    // TypeScript/JavaScript imports
    const importRegex = /import\s+(?:(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+))(?:\s*,\s*)?)+\s+from\s+['"]([^'"]+)['"]/g;
    const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        source: match[4],
        type: 'static',
        specifiers: extractSpecifiers(match)
      });
    }

    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        type: 'dynamic',
        specifiers: []
      });
    }
  }

  // Resolve relative imports to absolute paths
  return imports.map(imp => ({
    ...imp,
    resolved: resolveImportPath(filePath, imp.source)
  }));
}

function detectCircularDependencies(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string, path: string[]): void {
    if (path.includes(node)) {
      // Found cycle
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }

    if (visited.has(node)) return;
    visited.add(node);

    const edges = graph.edges.filter(e => e.from === node);
    for (const edge of edges) {
      dfs(edge.to, [...path, node]);
    }
  }

  for (const node of graph.nodes) {
    dfs(node.id, []);
  }

  return cycles;
}
```

---

### 4. Entity Extractor

Parses files to extract entities (classes, functions, types).

```typescript
interface EntityExtractor {
  extract(projectPath: string, files: string[]): Promise<ExtractedEntity[]>;
}

interface ExtractedEntity {
  // Identity
  id: string;
  name: string;
  type: EntityType;
  path: string;
  line: number;

  // Code structure
  signature: string;           // Function signature or class declaration
  exports: boolean;
  async: boolean;

  // For classes
  methods?: {
    name: string;
    signature: string;
    visibility: 'public' | 'private' | 'protected';
    async: boolean;
  }[];
  properties?: {
    name: string;
    type: string;
    visibility: 'public' | 'private' | 'protected';
  }[];
  decorators?: string[];
  extends?: string;
  implements?: string[];

  // For functions
  parameters?: {
    name: string;
    type: string;
    optional: boolean;
    default?: string;
  }[];
  return_type?: string;

  // Documentation
  jsdoc?: string;
  summary?: string;            // LLM-generated
}

type EntityType =
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'function'
  | 'const'
  | 'variable';
```

**TypeScript Parsing:**

```typescript
import * as ts from 'typescript';

function extractEntitiesFromFile(filePath: string, content: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node): void {
    // Classes
    if (ts.isClassDeclaration(node) && node.name) {
      entities.push(extractClass(node, filePath, sourceFile));
    }

    // Interfaces
    if (ts.isInterfaceDeclaration(node)) {
      entities.push(extractInterface(node, filePath, sourceFile));
    }

    // Functions
    if (ts.isFunctionDeclaration(node) && node.name) {
      entities.push(extractFunction(node, filePath, sourceFile));
    }

    // Arrow functions assigned to const
    if (ts.isVariableStatement(node)) {
      const arrowFuncs = extractArrowFunctions(node, filePath, sourceFile);
      entities.push(...arrowFuncs);
    }

    // Type aliases
    if (ts.isTypeAliasDeclaration(node)) {
      entities.push(extractTypeAlias(node, filePath, sourceFile));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entities;
}

function extractClass(
  node: ts.ClassDeclaration,
  filePath: string,
  sourceFile: ts.SourceFile
): ExtractedEntity {
  const decorators = ts.getDecorators(node)?.map(d =>
    d.getText(sourceFile)
  ) || [];

  const methods = node.members
    .filter(ts.isMethodDeclaration)
    .map(m => ({
      name: m.name.getText(sourceFile),
      signature: getMethodSignature(m, sourceFile),
      visibility: getVisibility(m),
      async: m.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false
    }));

  return {
    id: generateEntityId(filePath, node.name!.text),
    name: node.name!.text,
    type: 'class',
    path: filePath,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    signature: getClassSignature(node, sourceFile),
    exports: hasExportModifier(node),
    async: false,
    methods,
    decorators,
    extends: node.heritageClauses?.find(h =>
      h.token === ts.SyntaxKind.ExtendsKeyword
    )?.types[0]?.getText(sourceFile),
    implements: node.heritageClauses?.find(h =>
      h.token === ts.SyntaxKind.ImplementsKeyword
    )?.types.map(t => t.getText(sourceFile))
  };
}
```

---

### 5. Pattern Extractor

Identifies coding patterns from the codebase.

```typescript
interface PatternExtractor {
  extract(
    projectPath: string,
    entities: ExtractedEntity[],
    stackInfo: StackInfo
  ): Promise<ExtractedPattern[]>;
}

interface ExtractedPattern {
  name: string;
  description: string;
  category: string;
  template: string;
  occurrences: {
    file: string;
    line: number;
    code: string;
  }[];
  confidence: number;
}
```

**Pattern Detection Strategies:**

```typescript
// 1. Framework-specific patterns
const FRAMEWORK_PATTERNS: Record<string, PatternTemplate[]> = {
  nestjs: [
    {
      name: 'Controller Endpoint',
      category: 'api_endpoint',
      detector: (entity) =>
        entity.type === 'class' &&
        entity.decorators?.some(d => d.includes('@Controller')),
      template_extractor: extractControllerPattern
    },
    {
      name: 'Injectable Service',
      category: 'service',
      detector: (entity) =>
        entity.type === 'class' &&
        entity.decorators?.some(d => d.includes('@Injectable')),
      template_extractor: extractServicePattern
    }
  ],
  typeorm: [
    {
      name: 'Entity Definition',
      category: 'database',
      detector: (entity) =>
        entity.decorators?.some(d => d.includes('@Entity')),
      template_extractor: extractEntityPattern
    }
  ]
};

// 2. Generic pattern detection via LLM
async function detectPatternsWithLLM(
  files: FileContent[],
  stackInfo: StackInfo
): Promise<ExtractedPattern[]> {
  const prompt = `
Analyze these code files and identify reusable patterns.

## Stack
${stackInfo.frameworks.map(f => f.name).join(', ')}

## Files
${files.map(f => `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n')}

## Instructions
Identify patterns that:
1. Appear multiple times across files
2. Follow consistent structure
3. Could be templated for reuse

Return JSON array of patterns with name, description, template, and occurrences.
`;

  const response = await llm.complete(prompt);
  return JSON.parse(response).patterns;
}

// 3. Structural pattern detection
function detectStructuralPatterns(entities: ExtractedEntity[]): ExtractedPattern[] {
  const patterns: ExtractedPattern[] = [];

  // Error handling pattern
  const tryCatchMethods = entities
    .filter(e => e.type === 'class')
    .flatMap(e => e.methods || [])
    .filter(m => m.signature.includes('try') || m.signature.includes('catch'));

  if (tryCatchMethods.length > 3) {
    patterns.push(analyzeErrorHandlingPattern(tryCatchMethods));
  }

  // Async/await pattern
  const asyncMethods = entities
    .filter(e => e.type === 'class')
    .flatMap(e => e.methods || [])
    .filter(m => m.async);

  if (asyncMethods.length > 5) {
    patterns.push(analyzeAsyncPattern(asyncMethods));
  }

  return patterns;
}
```

---

### 6. Summary Generator

Creates high-level summaries using LLM.

```typescript
interface SummaryGenerator {
  generateArchitectureSummary(analysis: ProjectAnalysis): Promise<Summary>;
  generateModuleSummary(module: ModuleInfo, entities: ExtractedEntity[]): Promise<Summary>;
  generateEntitySummary(entity: ExtractedEntity): Promise<string>;
}
```

**Architecture Summary Prompt:**

```markdown
Generate an architecture overview for this project.

## Project Info
**Type:** {{analysis.stack.project_type}}
**Languages:** {{analysis.stack.languages | map("name") | join(", ")}}
**Frameworks:** {{analysis.stack.frameworks | map("name") | join(", ")}}

## Structure
{{#each analysis.structure.directories}}
- **{{this.path}}** ({{this.type}}): {{this.file_count}} files
{{/each}}

## Modules
{{#each analysis.structure.modules}}
### {{this.name}}
- Path: {{this.path}}
- Dependencies: {{this.dependencies | join(", ")}}
- Exports: {{this.exports | join(", ")}}
{{/each}}

## Key Files
{{#each analysis.key_entities}}
- **{{this.name}}** ({{this.path}}): {{this.type}}
{{/each}}

## Instructions
Write a 2-3 paragraph architecture overview that:
1. Explains what this project does
2. Describes the high-level architecture
3. Identifies key components and their relationships
4. Notes any architectural patterns used

Also provide:
- 5-7 key points as bullet points
- Any architectural concerns or technical debt observed

## Response Format
```json
{
  "summary": "string (2-3 paragraphs)",
  "key_points": ["string", ...],
  "concerns": ["string", ...] | null,
  "architecture_pattern": "string",
  "confidence": 0.0-1.0
}
```
```

---

## Analysis Output

Stored in `.rtslabs/analysis/`:

```
.rtslabs/
└── analysis/
    ├── stack.json           # Stack detection results
    ├── structure.json       # Project structure map
    ├── dependencies.json    # Dependency graph
    ├── entities.jsonl       # Extracted entities
    ├── patterns.jsonl       # Detected patterns
    └── meta.json            # Analysis metadata
```

**meta.json:**
```json
{
  "version": 1,
  "analyzed_at": "2024-01-15T10:00:00Z",
  "commit_hash": "abc123def",
  "duration_ms": 45000,
  "stats": {
    "files_scanned": 234,
    "entities_extracted": 156,
    "patterns_detected": 12,
    "summaries_generated": 8
  },
  "next_refresh": "2024-01-22T10:00:00Z"
}
```

---

## Incremental Analysis

For efficiency, support incremental updates:

```typescript
interface IncrementalAnalyzer {
  // Check if re-analysis needed
  needsRefresh(projectPath: string): Promise<RefreshCheck>;

  // Incremental update
  updateAnalysis(
    projectPath: string,
    changedFiles: string[]
  ): Promise<AnalysisUpdate>;
}

interface RefreshCheck {
  needed: boolean;
  reason?: 'no_analysis' | 'commit_changed' | 'files_changed' | 'config_changed' | 'stale';
  changed_files?: string[];
  current_commit?: string;
  analyzed_commit?: string;
}

interface AnalysisUpdate {
  // What changed
  entities_added: string[];
  entities_modified: string[];
  entities_removed: string[];
  patterns_affected: string[];

  // Updated analyses
  affected_modules: string[];
  summaries_regenerated: string[];
}
```

**Incremental Update Logic:**

```typescript
async function updateAnalysis(
  projectPath: string,
  changedFiles: string[]
): Promise<AnalysisUpdate> {
  const existingAnalysis = await loadAnalysis(projectPath);
  const update: AnalysisUpdate = {
    entities_added: [],
    entities_modified: [],
    entities_removed: [],
    patterns_affected: [],
    affected_modules: [],
    summaries_regenerated: []
  };

  // Determine affected scope
  const affectedModules = new Set<string>();
  for (const file of changedFiles) {
    const module = findModuleForFile(file, existingAnalysis.structure);
    if (module) affectedModules.add(module.name);
  }

  // Re-extract entities for changed files
  for (const file of changedFiles) {
    const exists = await fileExists(file);

    if (!exists) {
      // File deleted
      const oldEntities = existingAnalysis.entities.filter(e => e.path === file);
      update.entities_removed.push(...oldEntities.map(e => e.id));
      await removeEntities(oldEntities.map(e => e.id));
    } else {
      // File added or modified
      const newEntities = await extractEntitiesFromFile(file);
      const oldEntities = existingAnalysis.entities.filter(e => e.path === file);

      // Diff old vs new
      const { added, modified, removed } = diffEntities(oldEntities, newEntities);
      update.entities_added.push(...added.map(e => e.id));
      update.entities_modified.push(...modified.map(e => e.id));
      update.entities_removed.push(...removed.map(e => e.id));

      await updateEntities(file, newEntities);
    }
  }

  // Update dependency graph
  await updateDependencies(changedFiles);

  // Check if patterns affected
  for (const patternId of existingAnalysis.patterns.map(p => p.id)) {
    const pattern = await getPattern(patternId);
    if (pattern.occurrences.some(o => changedFiles.includes(o.file))) {
      update.patterns_affected.push(patternId);
      // Re-validate pattern
      await revalidatePattern(patternId, changedFiles);
    }
  }

  // Regenerate affected summaries
  for (const moduleName of affectedModules) {
    await regenerateModuleSummary(moduleName);
    update.summaries_regenerated.push(moduleName);
    update.affected_modules.push(moduleName);
  }

  // Update metadata
  await updateAnalysisMetadata(projectPath);

  return update;
}
```

---

## Integration Points

### With Memory System
- Entities → EntityKnowledge
- Patterns → Pattern memory
- Summaries → Summary memory

### With Decomposition Engine
- Provides project context
- Provides relevant file information
- Provides stack info for task generation

### With Execution Engine
- Provides file context for workers
- Identifies affected areas

### With Web UI
- Shows project overview
- Visualizes dependency graph
- Displays architecture diagram

---

## Configuration

```json
// .rtslabs/config.json
{
  "analyzer": {
    "auto_analyze": true,
    "refresh_interval_days": 7,
    "max_files_to_parse": 500,
    "max_file_size_kb": 100,
    "exclude_patterns": [
      "node_modules/**",
      "dist/**",
      "*.min.js"
    ],
    "entity_extraction": {
      "include_private": false,
      "generate_summaries": true,
      "max_entities_per_file": 50
    },
    "pattern_detection": {
      "min_occurrences": 2,
      "use_llm": true
    }
  }
}
```

---

## CLI Commands

```bash
# Full analysis
rtslabs analyze [--full] [--path <project-path>]

# Quick scan (no LLM)
rtslabs analyze --quick

# Show analysis results
rtslabs analyze show [stack|structure|dependencies|entities|patterns]

# Visualize dependency graph
rtslabs analyze deps [--output graph.svg]

# Check if refresh needed
rtslabs analyze status

# Clear analysis cache
rtslabs analyze clear
```

---

## Metrics

```typescript
interface AnalyzerMetrics {
  // Performance
  last_full_analysis_ms: number;
  last_incremental_analysis_ms: number;
  avg_file_parse_ms: number;

  // Coverage
  files_analyzed: number;
  files_skipped: number;
  entities_extracted: number;
  patterns_detected: number;

  // Quality
  summaries_generated: number;
  llm_tokens_used: number;

  // Project stats
  total_lines_of_code: number;
  language_distribution: Record<string, number>;
  framework_count: number;
  circular_dependencies: number;
  coupling_score: number;
}
```
