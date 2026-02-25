/**
 * Monaco Editor Configuration
 * Configures Monaco to use local files instead of CDN for CSP compliance
 */

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco to use the local installation
loader.config({ monaco });

// Set the worker paths to use local files from node_modules
// This is handled automatically by Vite when importing from monaco-editor

export default loader;
