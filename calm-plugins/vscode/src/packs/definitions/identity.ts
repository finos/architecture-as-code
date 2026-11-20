// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { identityIcons } from '../icons/identity.js';

const identityColor: PackColor = {
	bg: '#fff1f2',
	border: '#e11d48',
	stroke: '#be123c',
	badge: '[IAM]',
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
		icon: identityIcons[iconKey] ?? identityIcons['identity-provider']!,
		color: identityColor,
		description,
	};
}

export const identityPack: PackDefinition = {
	id: 'identity',
	label: 'Identity & Access',
	version: '1.0.0',
	color: identityColor,
	nodes: [
		node(
			'identity:identity-provider',
			'Identity Provider',
			'identity-provider',
			'Central identity provider (IdP) for authentication',
		),
		node(
			'identity:oauth-server',
			'OAuth Server',
			'oauth-server',
			'OAuth 2.0 authorization server',
		),
		node(
			'identity:oidc-provider',
			'OIDC Provider',
			'oidc-provider',
			'OpenID Connect identity provider',
		),
		node(
			'identity:saml-provider',
			'SAML Provider',
			'saml-provider',
			'SAML federation identity/service provider',
		),
		node(
			'identity:certificate-authority',
			'Certificate Authority',
			'certificate-authority',
			'PKI certificate authority for certificate lifecycle',
		),
		node(
			'identity:token-service',
			'Token Service',
			'token-service',
			'Security Token Service (STS) for token issuance',
		),
		node(
			'identity:mfa-service',
			'MFA Service',
			'mfa-service',
			'Multi-factor authentication service',
		),
		node(
			'identity:policy-engine',
			'Policy Engine',
			'policy-engine',
			'Access policy decision engine (OPA-style)',
		),
	],
};
