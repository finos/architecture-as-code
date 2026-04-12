// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { gcpIcons } from '../icons/gcp.js';

const gcpColor: PackColor = {
  bg: '#f0f9f4',
  border: '#34a853',
  stroke: '#1e8e3e',
  badge: '[GCP]',
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
    icon: gcpIcons[iconKey] ?? gcpIcons['cloud-run']!,
    color: gcpColor,
    description,
  };
}

export const gcpPack: PackDefinition = {
  id: 'gcp',
  label: 'GCP',
  version: '1.0.0',
  color: gcpColor,
  nodes: [
    node('gcp:cloud-run', 'Cloud Run', 'cloud-run', 'Fully managed serverless container platform'),
    node('gcp:cloud-functions', 'Cloud Functions', 'cloud-functions', 'Event-driven serverless function execution'),
    node('gcp:gke', 'GKE', 'gke', 'Google Kubernetes Engine managed cluster'),
    node('gcp:cloud-sql', 'Cloud SQL', 'cloud-sql', 'Fully managed relational database service'),
    node('gcp:bigquery', 'BigQuery', 'bigquery', 'Serverless multi-petabyte data warehouse'),
    node('gcp:pub-sub', 'Pub/Sub', 'pub-sub', 'Asynchronous messaging and event streaming'),
    node('gcp:cloud-storage', 'Cloud Storage', 'cloud-storage', 'Scalable unified object storage'),
    node('gcp:firestore', 'Firestore', 'firestore', 'Serverless NoSQL document database'),
    node('gcp:spanner', 'Spanner', 'spanner', 'Globally distributed strongly consistent database'),
    node('gcp:cloud-cdn', 'Cloud CDN', 'cloud-cdn', 'Content delivery network for fast content serving'),
    node('gcp:cloud-dns', 'Cloud DNS', 'cloud-dns', 'Scalable reliable Domain Name System service'),
    node('gcp:cloud-armor', 'Cloud Armor', 'cloud-armor', 'DDoS protection and web application firewall'),
    node('gcp:vertex-ai', 'Vertex AI', 'vertex-ai', 'Unified AI platform for ML model training and serving'),
    node('gcp:cloud-endpoints', 'Cloud Endpoints', 'cloud-endpoints', 'API management and gateway service'),
    node('gcp:memorystore', 'Memorystore', 'memorystore', 'Managed in-memory data store for Redis/Memcached'),
  ],
};
