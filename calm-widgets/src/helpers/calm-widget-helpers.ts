import { PathExtractor } from '../utils/path-extractor.js';
import { TableFormatter } from '../formatters/table-formatter.js';
import { CalmArchitecture, TableOptions, PathExtractionOptions, CalmWidgetHelper } from '../types/index.js';

/**
 * Collection of Handlebars helpers for CALM widgets
 */
export class CalmWidgetHelpers {
  /**
   * Get all available helpers
   */
  static getHelpers(): Record<string, CalmWidgetHelper> {
    return {
      // Table widget helper
      table: this.tableHelper.bind(this),
      

      

      
      // Additional helpers for templates
      getColumns: this.getColumnsHelper.bind(this),
      getValue: this.getValueHelper.bind(this),
      formatTableValue: this.formatTableValueHelper.bind(this),
      getListItemValue: this.getListItemValueHelper.bind(this),
      formatMetadataValue: this.formatMetadataValueHelper.bind(this),
      formatControlValue: this.formatControlValueHelper.bind(this),
      
      // Node lookup helper
      node: this.nodeHelper.bind(this),
    };
  }

  /**
   * Table helper - renders data as a table with simplified filtering
   * Usage: {{table architecture.nodes}}
   * Usage: {{table architecture.nodes filter='node-type:service'}}
   * Usage: {{table architecture.nodes filter='node-type:service' columns='unique-id,name'}}
   */
  private static tableHelper(data: any, options?: any): string {
    const context = options?.hash || {};
    
    let tableData = data;
    
    // Apply filter if provided
    if (Array.isArray(data) && context.filter) {
      const filters = Array.isArray(context.filter) ? context.filter : [context.filter];
      
      tableData = data.filter((item: any) => {
        return filters.every((filter: string) => {
          // Parse filter like "node-type:service" or "node-type==service"
          const colonMatch = filter.match(/^([^:]+):(.+)$/);
          const equalsMatch = filter.match(/^([^=]+)==?(.+)$/);
          
          if (colonMatch) {
            const [, key, value] = colonMatch;
            return item[key] === value;
          } else if (equalsMatch) {
            const [, key, value] = equalsMatch;
            return item[key] === value;
          }
          return true;
        });
      });
    }
    
    // If no data after filtering, return empty message
    if (!tableData || (Array.isArray(tableData) && tableData.length === 0)) {
      return context.emptyMessage || '_No data found._';
    }
    
    // Auto-detect controls and metadata objects and format them appropriately
    if (tableData && typeof tableData === 'object' && !Array.isArray(tableData)) {
      // Check if this looks like a controls object
      if (this.isControlsObject(tableData)) {
        return this.formatControlsAsTable(tableData, context);
      }
      
      // Check if this looks like a single control requirement (from array indexing)
      if (this.isSingleControlRequirement(tableData)) {
        return this.formatSingleControlRequirementAsTable(tableData, context);
      }
      
      // Check if this looks like a metadata object
      if (this.isMetadataObject(tableData)) {
        return this.formatMetadataAsTable(tableData, context);
      }
      
      // Convert single object to array for table processing
      tableData = [tableData];
    }

    const tableOptions: TableOptions = {
      format: (context.format || 'markdown') as 'markdown' | 'html',
      includeHeaders: context.headers !== false,
      emptyMessage: context.emptyMessage,
      columns: context.columns ? this.parseColumns(context.columns) : undefined
    };

    if (tableOptions.format === 'html') {
      return TableFormatter.formatHtmlTable(tableData, tableOptions);
    } else {
      return TableFormatter.formatMarkdownTable(tableData, tableOptions);
    }
  }



  /**
   * Count helper - counts items in data
   * Usage: {{count architecture.nodes}}
   */
  private static countHelper(data: any): number {
    if (Array.isArray(data)) {
      return data.length;
    }
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length;
    }
    return 0;
  }

  /**
   * HasData helper - checks if data exists and is not empty
   * Usage: {{#if (hasData architecture.nodes)}}...{{/if}}
   */
  private static hasDataHelper(data: any): boolean {
    if (Array.isArray(data)) {
      return data.length > 0;
    }
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length > 0;
    }
    return data !== null && data !== undefined && data !== '';
  }

  /**
   * Format metadata helper - formats CALM metadata array
   * Usage: {{formatMetadata node.metadata}}
   */
  private static formatMetadataHelper(metadata: Record<string, any>[], options?: any): string {
    if (!Array.isArray(metadata) || metadata.length === 0) {
      return options?.hash?.emptyMessage || '_No metadata_';
    }

    const format = options?.hash?.format || 'markdown';
    const items: string[] = [];

    for (const item of metadata) {
      for (const [key, value] of Object.entries(item)) {
        const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        items.push(`${key}: ${formattedValue}`);
      }
    }

    if (format === 'html') {
      return '<ul>\n' + items.map(item => `  <li>${item}</li>`).join('\n') + '\n</ul>';
    } else {
      return items.map(item => `- ${item}`).join('\n');
    }
  }

  /**
   * Format controls helper - formats CALM controls object
   * Usage: {{formatControls node.controls}}
   */
  private static formatControlsHelper(controls: Record<string, any>, options?: any): string {
    if (!controls || typeof controls !== 'object' || Object.keys(controls).length === 0) {
      return options?.hash?.emptyMessage || '_No controls_';
    }

    const format = options?.hash?.format || 'markdown';
    const items: string[] = [];

    for (const [controlId, controlData] of Object.entries(controls)) {
      if (controlData && typeof controlData === 'object') {
        const description = controlData.description || 'No description';
        items.push(`${controlId}: ${description}`);
      } else {
        items.push(`${controlId}: ${String(controlData)}`);
      }
    }

    if (format === 'html') {
      return '<ul>\n' + items.map(item => `  <li>${item}</li>`).join('\n') + '\n</ul>';
    } else {
      return items.map(item => `- ${item}`).join('\n');
    }
  }

  /**
   * Get columns helper - returns columns for table
   * Usage: {{getColumns data columns}}
   */
  private static getColumnsHelper(data: any, columns?: any): any[] {
    if (columns) {
      return this.parseColumns(columns);
    }
    
    // Infer columns from data if not provided
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      const keys = Object.keys(firstItem);
      return keys.map(key => ({
        key,
        label: this.keyToLabel(key)
      }));
    }
    
    return [];
  }

  /**
   * Convert a key to a human-readable label
   */
  private static keyToLabel(key: string): string {
    return key
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get value helper - returns value from object
   * Usage: {{getValue object "key"}}
   */
  private static getValueHelper(object: any, key: string): any {
    return PathExtractor.extract({ 'unique-id': 'temp', root: object } as { 'unique-id': string, root: any }, `root.${key}`)[0];
  }

  /**
   * Format table value helper - formats value for table
   * Usage: {{formatTableValue value}}
   */
  private static formatTableValueHelper(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Get list item value helper - returns value for list item
   * Usage: {{getListItemValue item "key"}}
   */
  private static getListItemValueHelper(item: any, key?: string): any {
    if (key) {
      return PathExtractor.extract({ 'unique-id': 'temp', root: item } as { 'unique-id': string, root: any }, `root.${key}`)[0] || item;
    }
    return typeof item === 'object' ? (item.name || item['unique-id'] || JSON.stringify(item)) : String(item);
  }

  /**
   * Format metadata value helper - formats value for metadata
   * Usage: {{formatMetadataValue value}}
   */
  private static formatMetadataValueHelper(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Format control value helper - formats value for control
   * Usage: {{formatControlValue value}}
   */
  private static formatControlValueHelper(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Node helper - finds a node by unique-id for intuitive property access
   * Usage: {{> controls data=(node architecture 'api-gateway').controls}}
   * Usage: {{> metadata data=(node architecture 'my-service').metadata}}
   */
  private static nodeHelper(architecture: any, uniqueId: string): any {
    if (!architecture || !architecture.nodes || !Array.isArray(architecture.nodes)) {
      return null;
    }
    
    return architecture.nodes.find((node: any) => node['unique-id'] === uniqueId) || null;
  }

  /**
   * Check if an object looks like a controls object
   */
  private static isControlsObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    // Check for common control properties
    return obj.hasOwnProperty('description') || 
           obj.hasOwnProperty('requirements') ||
           obj.hasOwnProperty('cbom') ||
           Object.keys(obj).some(key => typeof obj[key] === 'object' && obj[key].description);
  }

  /**
   * Check if an object looks like a metadata object
   */
  private static isMetadataObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    // Metadata is typically an array or object with key-value pairs
    return Array.isArray(obj) || 
           (typeof obj === 'object' && !obj.hasOwnProperty('description') && !obj.hasOwnProperty('requirements'));
  }

  /**
   * Check if an object looks like a single control requirement (from array indexing)
   */
  private static isSingleControlRequirement(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    // Check for common control requirement properties
    return obj.hasOwnProperty('control-requirement') || 
           obj.hasOwnProperty('control-config') ||
           (obj.hasOwnProperty('_resolvedSchema') && obj.hasOwnProperty('_resolvedConfig')) ||
           // Also check if this looks like a resolved control requirement with config values
           (obj.hasOwnProperty('_schemaProperties') && obj.hasOwnProperty('_configValues'));
  }

  /**
   * Format a single control requirement as a key-value table
   */
  private static formatSingleControlRequirementAsTable(requirement: any, context: any): string {
    const format = context.format || 'markdown';
    
    // If this is a resolved requirement with schema data, use that
    if (requirement._schemaProperties && requirement._configValues) {
      const headers = ['Property', 'Value'];
      const rows: string[][] = [];
      
      // Add each property-value pair as a row
      for (const prop of requirement._schemaProperties) {
        const value = requirement._configValues[prop];
        const displayValue = value !== undefined ? String(value) : 'N/A';
        rows.push([this.keyToLabel(prop), displayValue]);
      }
      
      return this.formatAsMarkdownTable(headers, rows, format);
    }
    
    // Otherwise, format the basic requirement properties
    const headers = ['Property', 'Value'];
    const rows: string[][] = [];
    
    // Add common control requirement properties
    if (requirement['control-requirement']) {
      rows.push(['Control Requirement', requirement['control-requirement']]);
    }
    if (requirement['control-config']) {
      rows.push(['Control Config', requirement['control-config']]);
    }
    
    // Add any other properties
    Object.entries(requirement).forEach(([key, value]: [string, any]) => {
      if (key !== 'control-requirement' && key !== 'control-config' && !key.startsWith('_')) {
        rows.push([this.keyToLabel(key), String(value)]);
      }
    });
    
    if (rows.length === 0) {
      return context.emptyMessage || '_No control requirement data found._';
    }
    
    return this.formatAsMarkdownTable(headers, rows, format);
  }

  /**
   * Format controls object as a table
   * Handles CALM controls structure with requirements and configurations
   */
  private static formatControlsAsTable(controls: any, context: any): string {
    const format = context.format || 'markdown';
    
    // Check if this is a single control with requirements array
    if (controls.requirements && Array.isArray(controls.requirements)) {
      return this.formatSingleControlAsTable(controls, format, context);
    }
    
    // Check if this is a controls collection (multiple controls)
    const controlEntries = Object.entries(controls);
    if (controlEntries.length > 0 && controlEntries.some(([key, value]: [string, any]) => 
        typeof value === 'object' && (value.requirements || value.description))) {
      return this.formatMultipleControlsAsTable(controls, format, context);
    }
    
    // Fallback to simple key-value formatting
    if (format === 'html') {
      let html = '<ul>';
      Object.entries(controls).forEach(([key, value]: [string, any]) => {
        html += `<li><strong>${key}:</strong> ${this.formatControlValueHelper(value)}</li>`;
      });
      html += '</ul>';
      return html;
    } else {
      let markdown = '';
      Object.entries(controls).forEach(([key, value]: [string, any]) => {
        markdown += `- **${key}:** ${this.formatControlValueHelper(value)}\n`;
      });
      return markdown;
    }
  }

  /**
   * Format a single control with requirements as a table
   * Uses resolved schema data from CLI preprocessing
   */
  private static formatSingleControlAsTable(control: any, format: string, context: any): string {
    if (!control.requirements || !Array.isArray(control.requirements)) {
      return context.emptyMessage || '_No control requirements found._';
    }

    // Check if we have resolved requirements from CLI preprocessing
    if (control._resolvedRequirements && Array.isArray(control._resolvedRequirements)) {
      return this.formatResolvedControlTable(control._resolvedRequirements, format);
    }

    // Fallback to simple format if no resolved data available
    return this.formatSimpleControlTable(control, format);
  }

  /**
   * Format resolved control requirements as a key-value table
   * Uses property-value pairs for better readability and flexibility
   */
  private static formatResolvedControlTable(resolvedRequirements: any[], format: string): string {
    if (resolvedRequirements.length === 0) {
      return '_No control requirements found._';
    }

    // For multiple requirements, show each as a separate section
    let output = '';
    
    for (let i = 0; i < resolvedRequirements.length; i++) {
      const req = resolvedRequirements[i];
      
      if (req._schemaProperties && req._configValues) {
        // Add requirement header if multiple requirements
        if (resolvedRequirements.length > 1) {
          output += `\n### Requirement ${i + 1}\n\n`;
        }
        
        // Create key-value table
        const headers = ['Property', 'Value'];
        const rows: string[][] = [];
        
        // Add each property-value pair as a row
        for (const prop of req._schemaProperties) {
          const value = req._configValues[prop];
          const displayValue = value !== undefined ? String(value) : 'N/A';
          rows.push([this.keyToLabel(prop), displayValue]);
        }
        
        output += this.formatAsMarkdownTable(headers, rows, format);
        
        if (i < resolvedRequirements.length - 1) {
          output += '\n';
        }
      }
    }
    
    return output || this.formatSimpleControlTable({ requirements: resolvedRequirements }, format);
  }

  /**
   * Fetch schema from URL
   */
  private static async fetchSchema(url: string): Promise<any> {
    if (!url) return null;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Failed to fetch schema from ${url}:`, error);
      return null;
    }
  }

  /**
   * Fetch configuration from URL or return inline config
   */
  private static async fetchConfig(config: string | object): Promise<any> {
    if (!config) return null;
    
    // If config is already an object (inline), return it
    if (typeof config === 'object') {
      return config;
    }
    
    // If config is a URL string, fetch it
    if (typeof config === 'string') {
      try {
        const response = await fetch(config);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.warn(`Failed to fetch config from ${config}:`, error);
        return null;
      }
    }
    
    return null;
  }

  /**
   * Extract column headers from JSON schema properties
   */
  private static extractSchemaHeaders(schema: any): string[] {
    if (!schema || !schema.properties) {
      return [];
    }
    
    // Get property names from schema, prioritizing required fields first
    const allProperties = Object.keys(schema.properties);
    const requiredProperties = schema.required || [];
    
    // Sort to show required properties first, then others
    const sortedProperties = [
      ...requiredProperties.filter((prop: string) => allProperties.includes(prop)),
      ...allProperties.filter((prop: string) => !requiredProperties.includes(prop))
    ];
    
    // Convert property names to human-readable headers
    return sortedProperties.map((prop: string) => this.keyToLabel(prop));
  }

  /**
   * Extract values from configuration matching schema properties
   */
  private static extractConfigValues(config: any, headers: string[]): string[] {
    if (!config) {
      return headers.map(() => 'N/A');
    }
    
    return headers.map(header => {
      // Convert header back to property key
      const propKey = this.labelToKey(header);
      const value = config[propKey];
      
      if (value === undefined || value === null) {
        return 'N/A';
      }
      
      // Format value appropriately
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      
      return String(value);
    });
  }

  /**
   * Convert label back to property key (reverse of keyToLabel)
   */
  private static labelToKey(label: string): string {
    return label.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Fallback simple control table format
   */
  private static formatSimpleControlTable(control: any, format: string): string {
    const headers = ['Requirement', 'Configuration', 'Description'];
    const rows = control.requirements.map((req: any) => {
      return [
        req['control-requirement'] ? this.extractUrlFilename(req['control-requirement']) : 'N/A',
        req['control-config'] ? this.extractUrlFilename(req['control-config']) : 'N/A',
        control.description || 'N/A'
      ];
    });

    return this.formatAsMarkdownTable(headers, rows, format);
  }

  /**
   * Format multiple controls as a table
   */
  private static formatMultipleControlsAsTable(controls: any, format: string, context: any): string {
    const headers = ['Control', 'Description', 'Requirements'];
    const rows = Object.entries(controls).map(([key, value]: [string, any]) => {
      const description = value.description || 'N/A';
      const reqCount = value.requirements ? value.requirements.length : 0;
      return [key, description, reqCount.toString()];
    });

    return this.formatAsMarkdownTable(headers, rows, format);
  }

  /**
   * Extract filename from URL for display
   */
  private static extractUrlFilename(url: string): string {
    try {
      return url.split('/').pop()?.replace('.json', '') || url;
    } catch {
      return url;
    }
  }

  /**
   * Format data as markdown table
   */
  private static formatAsMarkdownTable(headers: string[], rows: string[][], format: string): string {
    if (format === 'html') {
      let html = '<table><thead><tr>';
      headers.forEach(header => {
        html += `<th>${header}</th>`;
      });
      html += '</tr></thead><tbody>';
      rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
          html += `<td>${cell}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      return html;
    } else {
      let markdown = '| ' + headers.join(' | ') + ' |\n';
      markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
      rows.forEach(row => {
        markdown += '| ' + row.join(' | ') + ' |\n';
      });
      return markdown;
    }
  }

  /**
   * Format metadata object as a table
   */
  private static formatMetadataAsTable(metadata: any, context: any): string {
    const format = context.format || 'markdown';
    
    if (Array.isArray(metadata)) {
      if (metadata.length === 0) {
        return context.emptyMessage || '_No metadata_';
      }
      
      if (format === 'html') {
        let html = '<ul>';
        metadata.forEach((item: any) => {
          Object.entries(item).forEach(([key, value]: [string, any]) => {
            html += `<li><strong>${key}:</strong> ${this.formatMetadataValueHelper(value)}</li>`;
          });
        });
        html += '</ul>';
        return html;
      } else {
        let markdown = '';
        metadata.forEach((item: any) => {
          Object.entries(item).forEach(([key, value]: [string, any]) => {
            markdown += `- **${key}:** ${this.formatMetadataValueHelper(value)}\n`;
          });
        });
        return markdown;
      }
    } else {
      if (format === 'html') {
        let html = '<ul>';
        Object.entries(metadata).forEach(([key, value]: [string, any]) => {
          html += `<li><strong>${key}:</strong> ${this.formatMetadataValueHelper(value)}</li>`;
        });
        html += '</ul>';
        return html;
      } else {
        let markdown = '';
        Object.entries(metadata).forEach(([key, value]: [string, any]) => {
          markdown += `- **${key}:** ${this.formatMetadataValueHelper(value)}\n`;
        });
        return markdown;
      }
    }
  }

  /**
   * Parse column definitions from string or array
   */
  private static parseColumns(columns: any): any[] {
    if (typeof columns === 'string') {
      return columns.split(',').map(col => ({
        key: col.trim(),
        label: col.trim()
      }));
    }
    return columns;
  }
}
