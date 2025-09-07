# Block Architecture Widget - Comprehensive Test Fixtures

This directory contains organized test fixtures for testing all functionality of the block-architecture widget, with particular focus on the new `focus-interfaces` and `focus-controls` options.

## Test Suite Structure

### 🎯 Focus Options Test Suites

#### 1. focus-interfaces/
Tests the new interface-based focusing functionality:
- **basic-interface-focus.json** - Basic interface matching by unique-id and properties
- **complex-interface-matching.json** - Advanced property matching with rich metadata
- Test cases include matching by protocol, port, path, version, authentication method

#### 2. focus-controls/
Tests the new control-based focusing functionality:
- **basic-control-focus.json** - Controls at node and relationship levels
- **multi-level-controls.json** - Controls at context, node, and relationship levels
- **control-inheritance.json** - Complex control scenarios with compliance requirements
- Test cases include matching by control ID, category, compliance standards, requirement URLs

#### 3. focus-nodes/
Tests node-based focusing:
- **basic-node-focus.json** - Basic node focusing in microservices architecture
- **node-type-combinations.json** - Node focusing combined with type filtering
- **hierarchical-nodes.json** - Node focusing with container hierarchies

#### 4. focus-relationships/
Tests relationship-based focusing:
- **basic-relationship-focus.json** - Basic relationship focusing by unique-id
- **relationship-types.json** - Different relationship types (connects, interacts, deployed-in, composed-of)
- **protocol-based-relationships.json** - Protocol and metadata-based filtering

### 🧪 Test Usage Examples

#### Interface Focus Examples:
```javascript
// Match by interface unique-id
{ 'focus-interfaces': 'rest-api-v1' }

// Match by protocol property
{ 'focus-interfaces': 'HTTP,WebSocket' }

// Match by port property
{ 'focus-interfaces': '8080' }

// Match by authentication method
{ 'focus-interfaces': 'OAuth2,JWT' }
```

#### Control Focus Examples:
```javascript
// Match by control ID
{ 'focus-controls': 'security-hardening' }

// Match by category
{ 'focus-controls': 'security,compliance' }

// Match by compliance standard
{ 'focus-controls': 'GDPR,PCI' }

// Match by requirement URL pattern
{ 'focus-controls': 'https://company.com/security' }
```

#### Combined Focus Examples:
```javascript
// Combine multiple focus options
{ 
  'focus-interfaces': 'rest-api',
  'focus-controls': 'security',
  'edges': 'seeded'
}

// Focus with expansion options
{
  'focus-nodes': 'api-gateway',
  'include-children': 'direct',
  'direction': 'out'
}
```

## 🔍 Testing Strategy

### Flexible Property Matching
The new focus-interfaces and focus-controls strategies support flexible matching:
- **Exact matches**: Unique-id exact matching (case-sensitive)
- **Case-insensitive**: Unique-id case-insensitive matching  
- **Property matching**: Partial matching on any property (case-insensitive)
- **Deep property search**: Searches nested objects and arrays

### Multi-Level Control Search
The focus-controls strategy searches controls at all levels:
- **Context-level controls**: Global/enterprise controls
- **Node-level controls**: Controls specific to individual nodes
- **Relationship-level controls**: Controls on connections/integrations

### Relationship Integration
Both new strategies properly integrate with relationship filtering:
- **Interface relationships**: Only shows relationships using focused interfaces
- **Control relationships**: Includes relationships with matching controls
- **Node collection**: Collects all nodes that use matching interfaces/controls

## 🚀 Running Tests

Use these fixtures to test various scenarios:

1. **Single focus option**: Test each focus option independently
2. **Combined options**: Test multiple focus options together  
3. **Edge cases**: Empty matches, partial matches, case sensitivity
4. **Performance**: Large datasets with complex filtering
5. **Integration**: Combining with existing options like edges, containers, children

Each test fixture is designed to be self-contained and can be used independently or combined with others for comprehensive testing.
