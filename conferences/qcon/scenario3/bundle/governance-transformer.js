import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

/**
 * Governance Transformer for CALM Architecture
 * 
 * This transformer validates runtime infrastructure compliance and architecture controls
 * before allowing deployment. It checks:
 * - Cluster type and profile configuration
 * - Cluster running status
 * - Presence of required architecture controls (micro-segmentation, permitted-connection, mcp-guardrail)
 * 
 * The transformer extracts governance metadata that is then used by the deployer template
 * to make deployment decisions.
 */
export default class GovernanceTransformer {
  /**
   * Register any Handlebars helpers (required by CALM CLI)
   */
  registerTemplateHelpers() {
    return {};
  }

  /**
   * Main transformation function called by the CALM CLI
   * @param {Object} calmJson - Wrapped CALM architecture document
   * @returns {Object} Transformed data with governance checks
   */
  getTransformedModel(calmJson) {
    const architecture = calmJson.originalJson ?? calmJson;
    const k8sCluster = this._findK8sCluster(architecture);
    const clusterType = this._getClusterType(k8sCluster);
    const isMinikube = clusterType === 'minikube';
    
    // Check if secure profile is running
    const secureProfile = this._checkSecureProfile();
    
    const hasMicroSegmentation = this._checkMicroSegmentation(k8sCluster);
    const hasPermittedConnections = this._checkPermittedConnections(architecture);
    const mcpGuardrail = this._checkMcpGuardrail(architecture);
    
    const allChecks = 
      isMinikube &&
      secureProfile.isRunning &&
      hasMicroSegmentation &&
      hasPermittedConnections &&
      mcpGuardrail.present;
    
    return {
      document: {
        isMinikube,
        secureProfile: secureProfile.profile,
        secureProfileRunning: secureProfile.isRunning,
        hasMicroSegmentation,
        hasPermittedConnections,
        hasMcpGuardrail: mcpGuardrail.present,
        deniedSymbols: mcpGuardrail.deniedSymbols,
        deploymentReady: allChecks
      }
    };
  }

  /**
   * Find the Kubernetes cluster node
   * @param {Object} architecture - The CALM architecture
   * @returns {Object} The k8s-cluster node
   */
  _findK8sCluster(architecture) {
    return architecture.nodes.find(n => n['unique-id'] === 'k8s-cluster');
  }

  /**
   * Get cluster type from interfaces
   * @param {Object} k8sCluster - The k8s-cluster node
   * @returns {string} Cluster type value
   */
  _getClusterType(k8sCluster) {
    const clusterTypeInterface = k8sCluster.interfaces?.find(
      i => i['unique-id'] === 'cluster-type'
    );
    return clusterTypeInterface?.value || 'unknown';
  }

  /**
   * Check if the secure Minikube profile is running AND active
   * Verifies both existence/running status and that it's the current context
   * @returns {Object} { isRunning: boolean, profile: string }
   */
  _checkSecureProfile() {
    const targetProfile = 'secure';
    try {
      // Check if secure profile exists and is running
      const statusOutput = execSync(`minikube status --profile ${targetProfile} 2>&1`, { encoding: 'utf-8' });
      const isRunning = statusOutput.includes('host: Running');
      
      if (!isRunning) {
        return { isRunning: false, profile: targetProfile };
      }
      
      // Check if secure is the active profile (prevents false positive when both clusters running)
      const activeProfile = execSync('minikube profile 2>&1', { encoding: 'utf-8' })
        .trim()
        .replace(/^\*\s*/, ''); // Strip asterisk prefix if present
      
      const isActive = activeProfile === targetProfile;
      return { isRunning: isActive, profile: targetProfile };
    } catch (err) {
      // Profile doesn't exist or isn't running
      return { isRunning: false, profile: targetProfile };
    }
  }

  /**
   * Check if cluster has micro-segmentation control
   * @param {Object} k8sCluster - The k8s-cluster node
   * @returns {boolean} True if control is present
   */
  _checkMicroSegmentation(k8sCluster) {
    const controls = k8sCluster.controls?.security?.requirements || [];
    return controls.some(req => 
      req['requirement-url']?.includes('micro-segmentation')
    );
  }

  /**
   * Check if all connects relationships have permitted-connection controls
   * @param {Object} architecture - The CALM architecture
   * @returns {boolean} True if all connects have controls
   */
  _checkPermittedConnections(architecture) {
    const connectsRelationships = architecture.relationships.filter(r =>
      r['relationship-type']?.connects
    );
    
    if (connectsRelationships.length === 0) return true;
    
    return connectsRelationships.every(rel => {
      const requirements = rel.controls?.security?.requirements || [];
      return requirements.some(req =>
        req['requirement-url']?.includes('permitted-connection')
      );
    });
  }

  /**
   * Check if MCP server has guardrail control and extract denied symbols
   * @param {Object} architecture - The CALM architecture
   * @returns {Object} { present: boolean, deniedSymbols: Array }
   */
  _checkMcpGuardrail(architecture) {
    const mcpServer = architecture.nodes.find(n => 
      n['unique-id'] === 'mcp-server'
    );
    
    if (!mcpServer) {
      return { present: false, deniedSymbols: [] };
    }
    
    const guardrailControl = mcpServer.controls?.['mcp-guardrail'];
    if (!guardrailControl) {
      return { present: false, deniedSymbols: [] };
    }
    
    const requirements = guardrailControl.requirements || [];
    const configUrl = requirements[0]?.['config-url'];
    
    const deniedSymbols = configUrl ? this._extractDeniedSymbols(configUrl) : [];
    
    return {
      present: true,
      deniedSymbols
    };
  }

  /**
   * Extract denied symbols from MCP Guardrail control config.
   * @param {string} configUrl - URL to the control config
   * @returns {Array<string>} Array of denied symbols
   */
  _extractDeniedSymbols(configUrl) {
    try {
      // Extract filename from URL
      const filename = configUrl.split('/').pop();
      
      // Try to read from local controls directory
      const configPath = `calm/controls/${filename}`;
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        return config['denied-symbols'] || [];
      }
    } catch (err) {
      console.warn('Could not read control config:', err.message);
    }
    return [];
  }
}
