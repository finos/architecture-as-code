import {
    CalmInterface,
    CalmHostPortInterface,
    CalmHostnameInterface,
    CalmPathInterface,
    CalmOAuth2AudienceInterface,
    CalmURLInterface,
    CalmRateLimitInterface,
    CalmContainerImageInterface,
    CalmPortInterface,
    CalmRateLimitKey
} from './interface.js';
import {
    CalmHostPortInterfaceSchema,
    CalmHostnameInterfaceSchema,
    CalmPathInterfaceSchema,
    CalmOAuth2AudienceInterfaceSchema,
    CalmURLInterfaceSchema,
    CalmRateLimitInterfaceSchema,
    CalmContainerImageInterfaceSchema,
    CalmPortInterfaceSchema,
    CalmRateLimitKeySchema
} from '../types/interface-types.js';

const hostPortData: CalmHostPortInterfaceSchema = {
    'unique-id': 'host-port-001',
    host: 'localhost',
    port: 8080
};

const hostnameData: CalmHostnameInterfaceSchema = {
    'unique-id': 'hostname-001',
    hostname: 'example.com'
};

const rateLimitKeyData: CalmRateLimitKeySchema = {
    'key-type': 'User',
    'static-value': 'user123'
};

const rateLimitData: CalmRateLimitInterfaceSchema = {
    'unique-id': 'rate-limit-001',
    key: rateLimitKeyData,
    time: 60,
    'time-unit': 'Seconds',
    calls: 100
};

describe('CalmInterface', () => {
    it('should create a CalmHostPortInterface from JSON data', () => {
        const calmInterface: CalmInterface = CalmInterface.fromJson(hostPortData);

        expect(calmInterface).toBeInstanceOf(CalmHostPortInterface);
        const hostPortInterface = calmInterface as CalmHostPortInterface;
        expect(hostPortInterface.uniqueId).toBe('host-port-001');
        expect(hostPortInterface.host).toBe('localhost');
        expect(hostPortInterface.port).toBe(8080);
    });

    it('should create a CalmHostnameInterface from JSON data', () => {
        const hostnameInterface = CalmInterface.fromJson(hostnameData);

        expect(hostnameInterface).toBeInstanceOf(CalmHostnameInterface);
        const hostInterface = hostnameInterface as CalmHostnameInterface;
        expect(hostInterface.uniqueId).toBe('hostname-001');
        expect(hostInterface.hostname).toBe('example.com');
    });

    it('should create a CalmRateLimitInterface from JSON data', () => {
        const rateLimitInterface = CalmInterface.fromJson(rateLimitData);

        expect(rateLimitInterface).toBeInstanceOf(CalmRateLimitInterface);
        const limitInterface = rateLimitInterface as CalmRateLimitInterface;
        expect(limitInterface.uniqueId).toBe('rate-limit-001');
        expect(limitInterface.key).toBeInstanceOf(CalmRateLimitKey);
        expect(limitInterface.time).toBe(60);
        expect(limitInterface.timeUnit).toBe('Seconds');
        expect(limitInterface.calls).toBe(100);
    });
});

describe('CalmRateLimitKey', () => {
    it('should create a CalmRateLimitKey from JSON data', () => {
        const rateLimitKey = CalmRateLimitKey.fromJson(rateLimitKeyData);

        expect(rateLimitKey).toBeInstanceOf(CalmRateLimitKey);
        expect(rateLimitKey.keyType).toBe('User');
        expect(rateLimitKey.staticValue).toBe('user123');
    });
});

describe('CalmPortInterface', () => {
    it('should create a CalmPortInterface from JSON data', () => {
        const portInterfaceData: CalmPortInterfaceSchema = {
            'unique-id': 'port-001',
            port: 8080
        };
        const portInterface = CalmInterface.fromJson(portInterfaceData);

        expect(portInterface).toBeInstanceOf(CalmPortInterface);
        const port = portInterface as CalmPortInterface;
        expect(port.uniqueId).toBe('port-001');
        expect(port.port).toBe(8080);
    });
});

describe('CalmOAuth2AudienceInterface', () => {
    it('should create a CalmOAuth2AudienceInterface from JSON data', () => {
        const oauth2AudienceData: CalmOAuth2AudienceInterfaceSchema = {
            'unique-id': 'oauth2-001',
            audiences: ['audience1', 'audience2']
        };
        const oauth2AudienceInterface = CalmInterface.fromJson(oauth2AudienceData);

        expect(oauth2AudienceInterface).toBeInstanceOf(CalmOAuth2AudienceInterface);
        const oauth2Interface = oauth2AudienceInterface as CalmOAuth2AudienceInterface;
        expect(oauth2Interface.uniqueId).toBe('oauth2-001');
        expect(oauth2Interface.audiences).toEqual(['audience1', 'audience2']);
    });
});

describe('CalmContainerImageInterface', () => {
    it('should create a CalmContainerImageInterface from JSON data', () => {
        const containerImageData: CalmContainerImageInterfaceSchema = {
            'unique-id': 'container-001',
            image: 'docker/image-name'
        };
        const containerImageInterface = CalmInterface.fromJson(containerImageData);

        expect(containerImageInterface).toBeInstanceOf(CalmContainerImageInterface);
        const containerInterface = containerImageInterface as CalmContainerImageInterface;
        expect(containerInterface.uniqueId).toBe('container-001');
        expect(containerInterface.image).toBe('docker/image-name');
    });
});

describe('CalmPathInterface', () => {
    it('should create a CalmPathInterface from JSON data', () => {
        const pathInterfaceData: CalmPathInterfaceSchema = {
            'unique-id': 'path-001',
            path: '/api/v1/resource'
        };
        const pathInterface = CalmInterface.fromJson(pathInterfaceData);

        expect(pathInterface).toBeInstanceOf(CalmPathInterface);
        const path = pathInterface as CalmPathInterface;
        expect(path.uniqueId).toBe('path-001');
        expect(path.path).toBe('/api/v1/resource');
    });
});

describe('CalmURLInterface', () => {
    it('should create a CalmURLInterface from JSON data', () => {
        const urlInterfaceData: CalmURLInterfaceSchema = {
            'unique-id': 'url-001',
            url: 'https://example.com'
        };
        const urlInterface = CalmInterface.fromJson(urlInterfaceData);

        expect(urlInterface).toBeInstanceOf(CalmURLInterface);
        const url = urlInterface as CalmURLInterface;
        expect(url.uniqueId).toBe('url-001');
        expect(url.url).toBe('https://example.com');
    });
});
