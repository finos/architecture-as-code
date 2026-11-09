// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for AWS services (16x16 viewBox, stroke-based).
// These are original creative works, NOT copies of official AWS icons.

/** SVG icon strings for AWS service node types. */
export const awsIcons: Record<string, string> = {
  lambda: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 13L6 3l2.5 5L11 3l3 10" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9.5h5" stroke-linecap="round"/></svg>`,

  s3: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2L14 5v6L8 14L2 11V5L8 2Z" stroke-linejoin="round"/><ellipse cx="8" cy="5" rx="3" ry="1.2"/><path d="M5 5v6M11 5v6" stroke-linecap="round"/></svg>`,

  dynamodb: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4"/><path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"/></svg>`,

  ecs: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>`,

  eks: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><polygon points="8,2 14,5.5 14,10.5 8,14 2,10.5 2,5.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.5"/><path d="M8 2v3.5M8 10.5V14M2 5.5l3 2M11 8.5l3 2M14 5.5l-3 2M5 8.5l-3 2"/></svg>`,

  sqs: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="4" width="14" height="8" rx="1.5"/><path d="M4 8h2M7 8h2M10 8h2" stroke-linecap="round"/><path d="M13 4V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v1"/></svg>`,

  sns: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="3"/><path d="M8 5V2M11 6l2-2M12 9l2 1M8 11v3M5 10l-2 2M4 7L2 6" stroke-linecap="round"/></svg>`,

  'api-gateway': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="5" width="14" height="6" rx="1.5"/><path d="M5 8h6M3 8v0M13 8v0" stroke-linecap="round"/><path d="M7 5V3M9 5V3M7 11v2M9 11v2" stroke-linecap="round"/></svg>`,

  rds: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2"/></svg>`,

  aurora: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2"/><path d="M6 6.5l1.5 1.5L10 5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  cloudfront: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="2.5" ry="6"/><path d="M2 8h12M3 5h10M3 11h10" stroke-linecap="round"/></svg>`,

  route53: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6"/><path d="M5 3.5Q8 6 8 8t-3 4.5M11 3.5Q8 6 8 8t3 4.5" stroke-linecap="round"/><path d="M2 8h12" stroke-linecap="round"/></svg>`,

  iam: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="5" r="2.5"/><path d="M3 14c0-3 2.2-5 5-5s5 2 5 5" stroke-linecap="round"/><path d="M8 9v3M6.5 11.5h3" stroke-linecap="round"/></svg>`,

  vpc: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 2"><rect x="2" y="2" width="12" height="12" rx="2"/></svg>`,

  ec2: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M1 6h2M1 10h2M13 6h2M13 10h2M6 1v2M10 1v2M6 13v2M10 13v2" stroke-linecap="round"/></svg>`,

  fargate: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M6 6h4M6 8h4M6 10h2" stroke-linecap="round"/><circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/></svg>`,

  eventbridge: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 8h3l2-4 2 8 2-4h3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'step-functions': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="5" height="3" rx="0.8"/><rect x="9" y="6" width="5" height="3" rx="0.8"/><rect x="2" y="10" width="5" height="3" rx="0.8"/><path d="M4.5 5l4.5 1M11.5 9l-4.5 1" stroke-linecap="round"/></svg>`,

  cognito: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="5.5" r="2.5"/><path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="3" cy="5.5" r="1.5"/><path d="M1 11.5c0-1.5 1-2.5 2-2.5"/><circle cx="13" cy="5.5" r="1.5"/><path d="M15 11.5c0-1.5-1-2.5-2-2.5"/></svg>`,

  elasticache: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M6 8l1.5 1.5L11 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  kinesis: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 4l4 4-4 4M6 8h8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="8" r="1.5"/></svg>`,

  redshift: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="4.5" rx="5" ry="2"/><path d="M3 4.5v7c0 1.1 2.24 2 5 2s5-.9 5-2v-7"/><path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2"/><path d="M6 6h4" stroke-linecap="round"/></svg>`,

  sagemaker: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="5" width="12" height="7" rx="1.5"/><path d="M5 5V3.5a3 3 0 0 1 6 0V5"/><circle cx="8" cy="8.5" r="1.5"/></svg>`,

  glue: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="4" cy="8" r="2"/><circle cx="12" cy="8" r="2"/><path d="M6 8h4"/><path d="M4 6V3M4 11v3M12 6V3M12 11v3" stroke-linecap="round"/></svg>`,

  'secrets-manager': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/><circle cx="8" cy="10.5" r="1.2"/><path d="M8 11.7v1.3" stroke-linecap="round"/></svg>`,

  cloudwatch: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l3 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  waf: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2L14 4.5V9C14 12 11.5 14.5 8 15 4.5 14.5 2 12 2 9V4.5L8 2Z" stroke-linejoin="round"/><path d="M5.5 8l2 2 3.5-3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  kms: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="6" cy="7" r="3"/><path d="M8.5 9.5l5 5" stroke-linecap="round"/><path d="M11 12l1.5-1.5M13 10.5l1-1" stroke-linecap="round"/></svg>`,

  elb: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="2.5"/><path d="M1 8h4.5M10.5 8H15"/><path d="M8 1v4.5M8 10.5V15"/><path d="M3 3l3.2 3.2M9.8 9.8l3.2 3.2M3 13l3.2-3.2M9.8 6.2L13 3" stroke-linecap="round"/></svg>`,

  efs: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 6h12v4H2z" rx="1"/><path d="M5 6V4M8 6V4M11 6V4M5 10v2M8 10v2M11 10v2" stroke-linecap="round"/><path d="M2 8h12" stroke-linecap="round"/></svg>`,

  subnet: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke-dasharray="3 1.5"/><path d="M2 6h12M2 10h12" stroke-dasharray="2 1.5"/></svg>`,

  'internet-gateway': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11M2.5 8h11" stroke-linecap="round"/><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" opacity="0.4"/></svg>`,

  'nat-gateway': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h3l-1.5-2M8 8l1.5 2H6" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 6v4" stroke-linecap="round"/></svg>`,

  'route-table': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 5.5h12M2 9h12M6 5.5v8.5" stroke-linecap="round"/></svg>`,
};
