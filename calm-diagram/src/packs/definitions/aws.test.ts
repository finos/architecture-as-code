// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { awsPack } from './aws.js';
import { awsIcons } from '../icons/aws.js';

describe('awsPack', () => {
	it('contains the app integration, analytics and serverless types', () => {
		const typeIds = awsPack.nodes.map((n) => n.typeId);
		for (const typeId of ['aws:fargate', 'aws:redshift', 'aws:cognito', 'aws:sqs', 'aws:sns', 'aws:eventbridge', 'aws:step-functions', 'aws:kinesis']) {
			expect(typeIds).toContain(typeId);
		}
	});

	it('gives each type other than EC2 its own icon, not the EC2 fallback', () => {
		for (const node of awsPack.nodes.filter((n) => n.typeId !== 'aws:ec2')) {
			expect(node.icon, node.typeId).not.toBe(awsIcons['ec2']);
		}
	});
});
