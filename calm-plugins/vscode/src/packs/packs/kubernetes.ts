// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { k8sIcons } from '../icons/k8s.js';

const k8sColor: PackColor = {
  bg: '#f0f4ff',
  border: '#326ce5',
  stroke: '#2054c8',
  badge: '[K8s]',
};

function node(
  typeId: string,
  label: string,
  iconKey: string,
  description: string,
  isContainer = false,
): PackDefinition['nodes'][number] {
  return {
    typeId,
    label,
    icon: k8sIcons[iconKey] ?? k8sIcons['pod']!,
    color: k8sColor,
    description,
    ...(isContainer ? { isContainer: true } : {}),
  };
}

export const kubernetesPack: PackDefinition = {
  id: 'k8s',
  label: 'Kubernetes',
  version: '1.0.0',
  color: k8sColor,
  nodes: [
    node('k8s:pod', 'Pod', 'pod', 'The smallest deployable unit in Kubernetes'),
    node('k8s:deployment', 'Deployment', 'deployment', 'Manages a set of identical pods with rolling updates'),
    node('k8s:statefulset', 'StatefulSet', 'statefulset', 'Manages stateful applications with stable storage'),
    node('k8s:daemonset', 'DaemonSet', 'daemonset', 'Ensures a pod copy runs on each cluster node'),
    node('k8s:job', 'Job', 'job', 'Runs pods to completion for batch workloads'),
    node('k8s:cronjob', 'CronJob', 'cronjob', 'Schedules jobs on a recurring time basis'),
    node('k8s:service', 'Service', 'service', 'Exposes a set of pods as a stable network endpoint'),
    node('k8s:ingress', 'Ingress', 'ingress', 'Manages external HTTP/S access to cluster services'),
    node('k8s:configmap', 'ConfigMap', 'configmap', 'Stores non-sensitive configuration data'),
    node('k8s:secret', 'Secret', 'secret', 'Stores sensitive configuration such as credentials'),
    node('k8s:persistent-volume', 'Persistent Volume', 'persistent-volume', 'Cluster-wide storage resource provisioning'),
    node('k8s:pvc', 'PVC', 'pvc', 'Persistent Volume Claim — a pod request for storage'),
    node('k8s:namespace', 'Namespace', 'namespace', 'Virtual cluster partition for resource isolation', true),
    node('k8s:hpa', 'HPA', 'hpa', 'Horizontal Pod Autoscaler — scales pods based on load'),
  ],
};
