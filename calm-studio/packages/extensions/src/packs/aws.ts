// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { awsIcons } from '../icons/aws.js';

// AWS service category colors — matching official AWS Architecture Icon color families
const compute: PackColor = { bg: '#fff3e0', border: '#ec7211', stroke: '#d45b07', badge: '[AWS]' };
const storage: PackColor = { bg: '#e8f5e9', border: '#3f8624', stroke: '#2d6a1a', badge: '[AWS]' };
const database: PackColor = { bg: '#e3f2fd', border: '#2e73b8', stroke: '#1a5a9e', badge: '[AWS]' };
const networking: PackColor = { bg: '#f3e5f5', border: '#8c4fff', stroke: '#6b3bbf', badge: '[AWS]' };
const security: PackColor = { bg: '#fce4ec', border: '#dd344c', stroke: '#b22a3e', badge: '[AWS]' };
const appIntegration: PackColor = { bg: '#fce4ec', border: '#e7157b', stroke: '#c01067', badge: '[AWS]' };
const analytics: PackColor = { bg: '#e3f2fd', border: '#4464e3', stroke: '#2f4cc7', badge: '[AWS]' };
const ml: PackColor = { bg: '#e8f5e9', border: '#01a88d', stroke: '#008070', badge: '[AWS]' };
const mgmt: PackColor = { bg: '#fce4ec', border: '#e7157b', stroke: '#c01067', badge: '[AWS]' };

// Pack-level default (AWS orange)
const awsDefault: PackColor = { bg: '#fff3e0', border: '#ff9900', stroke: '#e67e00', badge: '[AWS]' };

function node(
  typeId: string,
  label: string,
  iconKey: string,
  description: string,
  color: PackColor = compute,
  isContainer = false,
): PackDefinition['nodes'][number] {
  return {
    typeId,
    label,
    icon: awsIcons[iconKey] ?? awsIcons['ec2']!,
    color,
    description,
    ...(isContainer ? { isContainer: true } : {}),
  };
}

export const awsPack: PackDefinition = {
  id: 'aws',
  label: 'AWS',
  version: '1.0.0',
  color: awsDefault,
  nodes: [
    // Compute
    node('aws:lambda', 'Lambda', 'lambda', 'Serverless function compute service', compute),
    node('aws:ec2', 'EC2', 'ec2', 'Elastic Compute Cloud virtual machine service', compute),
    node('aws:ecs', 'ECS', 'ecs', 'Elastic Container Service for Docker workloads', compute),
    node('aws:eks', 'EKS', 'eks', 'Managed Kubernetes service', compute),
    node('aws:fargate', 'Fargate', 'fargate', 'Serverless compute engine for containers', compute),
    // Storage
    node('aws:s3', 'S3', 's3', 'Scalable object storage service', storage),
    node('aws:efs', 'EFS', 'efs', 'Elastic File System for shared network storage', storage),
    // Database
    node('aws:dynamodb', 'DynamoDB', 'dynamodb', 'Managed NoSQL database service', database),
    node('aws:rds', 'RDS', 'rds', 'Relational Database Service for managed SQL databases', database),
    node('aws:aurora', 'Aurora', 'aurora', 'High-performance managed relational database', database),
    node('aws:elasticache', 'ElastiCache', 'elasticache', 'Managed in-memory caching service (Redis/Memcached)', database),
    node('aws:redshift', 'Redshift', 'redshift', 'Managed petabyte-scale data warehouse', database),
    // Networking & CDN
    node('aws:vpc', 'VPC', 'vpc', 'Virtual Private Cloud network isolation', networking, true),
    node('aws:subnet', 'Subnet', 'subnet', 'VPC subnet (public or private)', networking, true),
    node('aws:internet-gateway', 'Internet Gateway', 'internet-gateway', 'VPC internet gateway for public access', networking),
    node('aws:nat-gateway', 'NAT Gateway', 'nat-gateway', 'Network address translation for private subnets', networking),
    node('aws:route-table', 'Route Table', 'route-table', 'VPC route table for network routing', networking),
    node('aws:cloudfront', 'CloudFront', 'cloudfront', 'Content Delivery Network service', networking),
    node('aws:route53', 'Route 53', 'route53', 'Scalable DNS and domain registration service', networking),
    node('aws:elb', 'ELB', 'elb', 'Elastic Load Balancer for traffic distribution', networking),
    node('aws:api-gateway', 'API Gateway', 'api-gateway', 'Managed API Gateway for REST and WebSocket APIs', networking),
    // Security & Identity
    node('aws:iam', 'IAM', 'iam', 'Identity and Access Management for AWS resources', security),
    node('aws:cognito', 'Cognito', 'cognito', 'User authentication and identity management', security),
    node('aws:waf', 'WAF', 'waf', 'Web Application Firewall for traffic filtering', security),
    node('aws:kms', 'KMS', 'kms', 'Key Management Service for encryption keys', security),
    node('aws:secrets-manager', 'Secrets Manager', 'secrets-manager', 'Managed service for storing application secrets', security),
    // App Integration
    node('aws:sqs', 'SQS', 'sqs', 'Simple Queue Service for message queuing', appIntegration),
    node('aws:sns', 'SNS', 'sns', 'Simple Notification Service for pub/sub messaging', appIntegration),
    node('aws:eventbridge', 'EventBridge', 'eventbridge', 'Serverless event bus for application integration', appIntegration),
    node('aws:step-functions', 'Step Functions', 'step-functions', 'Serverless workflow orchestration service', appIntegration),
    // Analytics
    node('aws:kinesis', 'Kinesis', 'kinesis', 'Real-time data streaming and processing', analytics),
    node('aws:glue', 'Glue', 'glue', 'Serverless ETL and data integration service', analytics),
    // ML
    node('aws:sagemaker', 'SageMaker', 'sagemaker', 'Managed machine learning platform', ml),
    // Management
    node('aws:cloudwatch', 'CloudWatch', 'cloudwatch', 'Monitoring and observability service', mgmt),
  ],
};
