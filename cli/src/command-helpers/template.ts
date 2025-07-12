import * as path from 'path';
import * as fs from 'node:fs';
import { CalmCoreSchema, CalmNodeSchema } from '@finos/calm-shared/src/types/core-types.js';
import { CalmControlsSchema, CalmControlSchema } from '@finos/calm-shared/src/types/control-types.js';

// Type for architecture data with additional resolved properties
interface ArchitectureData extends CalmCoreSchema {
    _nodes?: Record<string, CalmNodeSchema>;
}

// Type for control data structure
interface ControlData {
    [key: string]: unknown;
}

// Type for configuration data
interface ConfigData {
    [key: string]: unknown;
}

// Extended control type with resolved requirements
interface ExtendedControlSchema extends CalmControlSchema {
    _resolvedRequirements?: unknown[];
}

/**
 * Process bracket notation in template content to resolve property access
 * Converts: architecture.nodes['api-gateway'].controls['cbom']
 * To: direct property access that Handlebars can understand
 */
function processBracketNotation(templateContent: string, architectureData: ArchitectureData): string {
    // Flatten array access by creating indexed properties in the data structure FIRST
    flattenArrayAccess(architectureData);
    
    // Create a flattened structure for easy access AFTER flattening arrays
    const resolvedNodes: Record<string, CalmNodeSchema> = {};
    
    if (architectureData.nodes) {
        architectureData.nodes.forEach((node: CalmNodeSchema) => {
            const nodeId = node['unique-id'];
            if (nodeId) {
                resolvedNodes[nodeId] = node;
            }
        });
    }
    
    // Add resolved nodes to architecture data
    architectureData._nodes = resolvedNodes;
    
    // Replace bracket notation with dot notation that Handlebars understands
    // Handle both node bracket notation and general array indexing
    let processedContent = templateContent;
    
    // First handle the main bracket notation pattern
    const bracketPattern = /architecture\.nodes\['([^']+)'\](?:\.([a-zA-Z0-9_-]+)(?:\['([^']+)'\])?)?/g;
    
    processedContent = processedContent.replace(bracketPattern, (match, nodeId, property, subProperty) => {
        let replacement = `architecture._nodes.${nodeId}`;
        
        if (property) {
            replacement += `.${property}`;
            
            if (subProperty) {
                replacement += `.${subProperty}`;
            }
        }
        
        return replacement;
    });
    
    // Then handle any remaining array indexing patterns
    const arrayIndexPattern = /([a-zA-Z0-9_.-]+)\[([0-9]+)\]/g;
    
    processedContent = processedContent.replace(arrayIndexPattern, (match, basePath, arrayIndex) => {
        // Extract the property name from the base path
        const pathParts = basePath.split('.');
        const propertyName = pathParts[pathParts.length - 1];
        const basePathWithoutProperty = pathParts.slice(0, -1).join('.');
        
        // Convert to flattened property name (e.g., requirements[0] -> requirements_0)
        return `${basePathWithoutProperty}.${propertyName}_${arrayIndex}`;
    });
    
    // Finally handle any remaining string bracket notation patterns
    const stringBracketPattern = /([a-zA-Z0-9_.-]+)\['([^']+)'\]/g;
    
    processedContent = processedContent.replace(stringBracketPattern, (match, basePath, property) => {
        return `${basePath}.${property}`;
    });
    
    return processedContent;
}

/**
 * Flatten array access by creating indexed properties in the data structure
 * This allows bracket notation like [0] to work as ._0 in Handlebars
 */
function flattenArrayAccess(architectureData: ArchitectureData): void {
    if (!architectureData.nodes || !Array.isArray(architectureData.nodes)) {
        return;
    }

    // Process each node
    for (const node of architectureData.nodes) {
        if (node.controls && typeof node.controls === 'object') {
            // Process each control
            for (const [_controlKey, controlValue] of Object.entries(node.controls)) {
                if (controlValue && typeof controlValue === 'object') {
                    flattenObjectArrays(controlValue as ControlData);
                }
            }
        }
    }

    // Also flatten arrays in the _nodes structure
    if (architectureData._nodes) {
        for (const [_nodeId, nodeData] of Object.entries(architectureData._nodes)) {
            if (nodeData && typeof nodeData === 'object') {
                flattenObjectArrays(nodeData as ControlData);
            }
        }
    }
}

/**
 * Recursively flatten arrays in an object by creating indexed properties
 */
function flattenObjectArrays(obj: ControlData): void {
    if (!obj || typeof obj !== 'object') {
        return;
    }

    // Create a copy of keys to avoid modifying object while iterating
    const keys = Object.keys(obj);
    
    for (const key of keys) {
        const value = obj[key];
        
        if (Array.isArray(value)) {
            // Create indexed properties for array elements
            value.forEach((item, index) => {
                obj[`${key}_${index}`] = item;
                
                // Also recursively flatten the array item if it's an object
                if (item && typeof item === 'object') {
                    flattenObjectArrays(item as ControlData);
                }
            });
            
            // Special handling for resolved requirements - copy resolved data to flattened elements
            if (key === '_resolvedRequirements' && obj['_resolvedRequirements']) {
                (obj['_resolvedRequirements'] as unknown[]).forEach((resolvedItem: unknown, index: number) => {
                    const resolvedObj = resolvedItem as { 
                        _schemaProperties?: unknown; 
                        _configValues?: unknown;
                        _resolvedSchema?: unknown;
                        _resolvedConfig?: unknown;
                    };
                    if (resolvedObj._schemaProperties && resolvedObj._configValues) {
                        // Copy resolved schema data to the flattened requirements
                        const flattenedKey = `requirements_${index}`;
                        if (obj[flattenedKey]) {
                            const flattenedObj = obj[flattenedKey] as ControlData;
                            flattenedObj._schemaProperties = resolvedObj._schemaProperties;
                            flattenedObj._configValues = resolvedObj._configValues;
                            flattenedObj._resolvedSchema = resolvedObj._resolvedSchema;
                            flattenedObj._resolvedConfig = resolvedObj._resolvedConfig;
                        }
                    }
                });
            }
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively process nested objects
            flattenObjectArrays(value as ControlData);
        }
    }
}

/**
 * Resolve control schemas by fetching requirement and configuration data
 * and augmenting the architecture data with resolved schema information
 */
async function resolveControlSchemas(architectureData: ArchitectureData): Promise<void> {
    if (!architectureData.nodes || !Array.isArray(architectureData.nodes)) {
        return;
    }

    for (const node of architectureData.nodes) {
        if (node.controls && typeof node.controls === 'object') {
            await resolveNodeControlSchemas(node.controls);
        }
    }
}

/**
 * Resolve schemas for all controls in a node
 */
async function resolveNodeControlSchemas(controls: CalmControlsSchema): Promise<void> {
    for (const [_controlKey, controlValue] of Object.entries(controls)) {
        if (controlValue && typeof controlValue === 'object' && (controlValue as CalmControlSchema).requirements) {
            await resolveControlRequirements(controlValue as ExtendedControlSchema);
        }
    }
}

/**
 * Resolve requirements for a single control
 */
async function resolveControlRequirements(control: ExtendedControlSchema): Promise<void> {
    if (!control.requirements || !Array.isArray(control.requirements)) {
        return;
    }

    const resolvedRequirements = [];
    
    for (const req of control.requirements) {
        try {
            const schemaData = await fetchJsonFromUrl(req['control-requirement']);
            const configData = await fetchConfigData(req['control-config']);
            
            if (schemaData && configData) {
                const resolvedReq = {
                    ...req,
                    _resolvedSchema: schemaData,
                    _resolvedConfig: configData,
                    _schemaProperties: extractSchemaProperties(schemaData),
                    _configValues: extractConfigValues(configData, schemaData)
                };
                resolvedRequirements.push(resolvedReq);
            } else {
                resolvedRequirements.push(req); // Keep original if resolution fails
            }
        } catch (error) {
            console.warn('Failed to resolve control requirement:', error);
            resolvedRequirements.push(req); // Keep original if resolution fails
        }
    }
    
    control._resolvedRequirements = resolvedRequirements;
}

/**
 * Fetch JSON data from URL
 */
async function fetchJsonFromUrl(url: string): Promise<unknown> {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.warn(`Failed to fetch JSON from ${url}:`, error);
        return null;
    }
}

/**
 * Fetch configuration data (URL or inline object)
 */
async function fetchConfigData(config: string | ConfigData): Promise<ConfigData | null> {
    if (!config) {
        return null;
    }
    
    // If config is already an object (inline), return it
    if (typeof config === 'object') {
        return config;
    }
    
    // If config is a URL string, fetch it
    if (typeof config === 'string') {
        const result = await fetchJsonFromUrl(config);
        return result as ConfigData | null;
    }
    
    return null;
}

/**
 * Extract properties from JSON schema
 */
function extractSchemaProperties(schema: unknown): string[] {
    if (!schema || typeof schema !== 'object' || schema === null || !('properties' in schema)) {
        return [];
    }
    
    const schemaObj = schema as { properties: Record<string, unknown>; required?: string[] };
    const allProperties = Object.keys(schemaObj.properties);
    const requiredProperties = schemaObj.required || [];
    
    // Sort to show required properties first, then others
    return [
        ...requiredProperties.filter((prop: string) => allProperties.includes(prop)),
        ...allProperties.filter((prop: string) => !requiredProperties.includes(prop))
    ];
}

/**
 * Extract configuration values matching schema properties
 */
function extractConfigValues(config: ConfigData, schema: unknown): Record<string, unknown> {
    if (!config || !schema || typeof schema !== 'object' || schema === null || !('properties' in schema)) {
        return {};
    }
    
    const schemaObj = schema as { properties: Record<string, unknown> };
    const values: Record<string, unknown> = {};
    const properties = Object.keys(schemaObj.properties);
    
    for (const prop of properties) {
        values[prop] = config[prop] !== undefined ? config[prop] : 'N/A';
    }
    
    return values;
}

export function getUrlToLocalFileMap(urlToLocalFileMapping?: string): Map<string, string> {
    if (!urlToLocalFileMapping) {
        return new Map<string, string>();
    }

    try {
        const basePath = path.dirname(urlToLocalFileMapping);
        const mappingJson = JSON.parse(fs.readFileSync(urlToLocalFileMapping, 'utf-8'));

        return new Map(
            Object.entries(mappingJson).map(([url, relativePath]) => [
                url,
                path.resolve(basePath, String(relativePath))
            ])
        );
    } catch (err) {
        console.error(`Error reading url to local file mapping file: ${urlToLocalFileMapping}`, err);
        process.exit(1);
    }
}

/**
 * Process a simple template file with calm-widgets helpers
 * @param inputPath Path to the CALM architecture JSON file
 * @param templatePath Path to the template file
 * @param outputPath Path to the output file
 * @param localDirectory URL to local file mapping
 */
export async function processSimpleTemplate(
    inputPath: string,
    templatePath: string,
    outputPath: string,
    _localDirectory: Map<string, string>
): Promise<void> {
    try {
        // Read the architecture data
        const architectureData: ArchitectureData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
        
        // Read the template file
        let templateContent = fs.readFileSync(templatePath, 'utf-8');
        
        // Pre-process bracket notation for intuitive property access
        templateContent = processBracketNotation(templateContent, architectureData);
        
        // Pre-fetch and resolve control schemas for proper table generation
        await resolveControlSchemas(architectureData);
        
        // Import Handlebars and calm-widgets
        const Handlebars = await import('handlebars');
        const { registerCalmWidgetsWithInstance } = await import('@finos/calm-widgets');
        
        // Create a new Handlebars instance
        const handlebars = Handlebars.create();
        
        // Register calm-widgets helpers
        registerCalmWidgetsWithInstance(handlebars);
        
        // Register widget partials (controls, metadata, etc.)
        const widgetPartials = {
            'controls': fs.readFileSync(path.resolve(__dirname, '../../calm-widgets/dist/widgets/controls.hbs'), 'utf-8'),
            'metadata': fs.readFileSync(path.resolve(__dirname, '../../calm-widgets/dist/widgets/metadata.hbs'), 'utf-8'),
            'list': fs.readFileSync(path.resolve(__dirname, '../../calm-widgets/dist/widgets/list.hbs'), 'utf-8'),
            'table': fs.readFileSync(path.resolve(__dirname, '../../calm-widgets/dist/widgets/table.hbs'), 'utf-8')
        };
        
        Object.entries(widgetPartials).forEach(([name, content]) => {
            handlebars.registerPartial(name, content);
        });
        
        // Add utility helper for current date
        handlebars.registerHelper('currentDate', () => {
            return new Date().toISOString().split('T')[0];
        });
        
        // Add missing Handlebars built-in helpers needed by widgets
        handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
        handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
        handlebars.registerHelper('lt', (a: unknown, b: unknown) => a < b);
        handlebars.registerHelper('gt', (a: unknown, b: unknown) => a > b);
        handlebars.registerHelper('lte', (a: unknown, b: unknown) => a <= b);
        handlebars.registerHelper('gte', (a: unknown, b: unknown) => a >= b);
        handlebars.registerHelper('and', (a: unknown, b: unknown) => a && b);
        handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b);
        handlebars.registerHelper('not', (a: unknown) => !a);
        
        // Compile the template
        const template = handlebars.compile(templateContent);
        
        // Generate the output
        const output = template({ architecture: architectureData });
        
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Write the output file
        fs.writeFileSync(outputPath, output, 'utf-8');
        
        console.log(`✅ Template processed successfully: ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Error processing template:', error);
        process.exit(1);
    }
}
