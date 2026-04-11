// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
//
// Icons are hand-crafted abstract designs — NOT Microsoft Azure official icons.
// See src/icons/azure.ts for licensing notes.

import type { PackDefinition, PackColor } from '../types.js';
import { azureIcons } from '../icons/azure.js';

const azureColor: PackColor = {
  bg: '#f0f5ff',
  border: '#0078d4',
  stroke: '#005a9e',
  badge: '[Azure]',
};

function node(
  typeId: string,
  label: string,
  iconKey: string,
  description: string,
): PackDefinition['nodes'][number] {
  return {
    typeId,
    label,
    icon: azureIcons[iconKey] ?? azureIcons['functions']!,
    color: azureColor,
    description,
  };
}

export const azurePack: PackDefinition = {
  id: 'azure',
  label: 'Azure',
  version: '1.0.0',
  color: azureColor,
  nodes: [
    node('azure:functions', 'Functions', 'functions', 'Serverless event-driven compute service'),
    node('azure:app-service', 'App Service', 'app-service', 'Fully managed platform for web applications'),
    node('azure:aks', 'AKS', 'aks', 'Azure Kubernetes Service managed cluster'),
    node('azure:sql-database', 'SQL Database', 'sql-database', 'Fully managed relational database as a service'),
    node('azure:cosmos-db', 'Cosmos DB', 'cosmos-db', 'Globally distributed multi-model NoSQL database'),
    node('azure:service-bus', 'Service Bus', 'service-bus', 'Enterprise message broker with queues and topics'),
    node('azure:blob-storage', 'Blob Storage', 'blob-storage', 'Massively scalable object storage for unstructured data'),
    node('azure:front-door', 'Front Door', 'front-door', 'Global CDN and application delivery network'),
    node('azure:api-management', 'API Management', 'api-management', 'Full lifecycle API management platform'),
    node('azure:key-vault', 'Key Vault', 'key-vault', 'Managed secrets and cryptographic key storage'),
    node('azure:active-directory', 'Active Directory', 'active-directory', 'Cloud identity and access management'),
    node('azure:cognitive-services', 'Cognitive Services', 'cognitive-services', 'AI APIs for vision, speech, language, and decision'),
    node('azure:event-hub', 'Event Hub', 'event-hub', 'Big data streaming platform and event ingestion'),
    node('azure:redis-cache', 'Redis Cache', 'redis-cache', 'Managed Redis in-memory data store'),
    node('azure:container-instances', 'Container Instances', 'container-instances', 'On-demand serverless container execution'),
  ],
};
