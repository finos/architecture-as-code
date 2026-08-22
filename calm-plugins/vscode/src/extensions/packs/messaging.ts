// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { messagingIcons } from '../icons/messaging.js';

const messagingColor: PackColor = {
	bg: '#f0fdfa',
	border: '#0d9488',
	stroke: '#0f766e',
	badge: '[MSG]',
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
		icon: messagingIcons[iconKey] ?? messagingIcons['message-broker']!,
		color: messagingColor,
		description,
	};
}

export const messagingPack: PackDefinition = {
	id: 'messaging',
	label: 'Messaging',
	version: '1.0.0',
	color: messagingColor,
	nodes: [
		node(
			'messaging:message-broker',
			'Message Broker',
			'message-broker',
			'Message broker for routing and delivering messages between systems',
		),
		node(
			'messaging:event-stream',
			'Event Stream',
			'event-stream',
			'Distributed event streaming platform for high-throughput data pipelines',
		),
		node(
			'messaging:message-queue',
			'Message Queue',
			'message-queue',
			'Point-to-point asynchronous message queue',
		),
		node(
			'messaging:pub-sub',
			'Pub/Sub',
			'pub-sub',
			'Publish-subscribe messaging system for fan-out delivery',
		),
		node(
			'messaging:event-bus',
			'Event Bus',
			'event-bus',
			'Application-level event bus for decoupled communication',
		),
		node(
			'messaging:stream-processor',
			'Stream Processor',
			'stream-processor',
			'Real-time event stream processing engine',
		),
		node(
			'messaging:schema-registry',
			'Schema Registry',
			'schema-registry',
			'Message schema registry and compatibility service',
		),
		node(
			'messaging:notification-service',
			'Notification Service',
			'notification-service',
			'Push notification and alerting service',
		),
	],
};
