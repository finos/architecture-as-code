import {
    CalmContainerImageInterfaceSchema,
    CalmHostnameInterfaceSchema,
    CalmHostPortInterfaceSchema,
    CalmInterfaceTypeSchema,
    CalmNodeInterfaceSchema,
    CalmOAuth2AudienceInterfaceSchema,
    CalmPathInterfaceSchema, CalmPortInterfaceSchema,
    CalmRateLimitInterfaceSchema, CalmRateLimitKeySchema,
    CalmURLInterfaceSchema
} from '../types/interface-types.js';

export class CalmInterface {
    constructor(public uniqueId: string) {}

    static fromJson(data: CalmInterfaceTypeSchema): CalmInterface {
        if ('host' in data && 'port' in data) {
            return CalmHostPortInterface.fromJson(data as CalmHostPortInterfaceSchema);
        } else if ('hostname' in data) {
            return CalmHostnameInterface.fromJson(data as CalmHostnameInterfaceSchema);
        } else if ('path' in data) {
            return CalmPathInterface.fromJson(data as CalmPathInterfaceSchema);
        } else if ('audiences' in data) {
            return CalmOAuth2AudienceInterface.fromJson(data as CalmOAuth2AudienceInterfaceSchema);
        } else if ('url' in data) {
            return CalmURLInterface.fromJson(data as CalmURLInterfaceSchema);
        } else if ('key' in data) {
            return CalmRateLimitInterface.fromJson(data as CalmRateLimitInterfaceSchema);
        } else if ('image' in data) {
            return CalmContainerImageInterface.fromJson(data as CalmContainerImageInterfaceSchema);
        } else if ('port' in data) {
            return CalmPortInterface.fromJson(data as CalmPortInterfaceSchema);
        } else {
            throw new Error('Unknown interface type');
        }
    }
}

export class CalmNodeInterface {
    constructor(public node: string, public interfaces: string[]) {}

    static fromJson(data: CalmNodeInterfaceSchema): CalmNodeInterface {
        return new CalmNodeInterface(data.node, data.interfaces);
    }
}

export class CalmHostPortInterface extends CalmInterface {
    constructor(public uniqueId: string, public host: string, public port: number) {
        super(uniqueId);
    }

    static fromJson(data: CalmHostPortInterfaceSchema): CalmHostPortInterface {
        return new CalmHostPortInterface(data['unique-id'], data.host, data.port);
    }
}

export class CalmHostnameInterface extends CalmInterface {
    constructor(public uniqueId: string, public hostname: string) {
        super(uniqueId);
    }

    static fromJson(data: CalmHostnameInterfaceSchema): CalmHostnameInterface {
        return new CalmHostnameInterface(data['unique-id'], data.hostname);
    }
}

export class CalmPathInterface extends CalmInterface {
    constructor(public uniqueId: string, public path: string) {
        super(uniqueId);
    }

    static fromJson(data: CalmPathInterfaceSchema): CalmPathInterface {
        return new CalmPathInterface(data['unique-id'], data.path);
    }
}

export class CalmOAuth2AudienceInterface extends CalmInterface {
    constructor(public uniqueId: string, public audiences: string[]) {
        super(uniqueId);
    }

    static fromJson(data: CalmOAuth2AudienceInterfaceSchema): CalmOAuth2AudienceInterface {
        return new CalmOAuth2AudienceInterface(data['unique-id'], data.audiences);
    }
}

export class CalmURLInterface extends CalmInterface {
    constructor(public uniqueId: string, public url: string) {
        super(uniqueId);
    }

    static fromJson(data: CalmURLInterfaceSchema): CalmURLInterface {
        return new CalmURLInterface(data['unique-id'], data.url);
    }
}

export class CalmRateLimitInterface extends CalmInterface {
    constructor(
        public uniqueId: string,
        public key: CalmRateLimitKey,
        public time: number,
        public timeUnit: 'Seconds' | 'Minutes' | 'Hours',
        public calls: number
    ) {
        super(uniqueId);
    }

    static fromJson(data: CalmRateLimitInterfaceSchema): CalmRateLimitInterface {
        return new CalmRateLimitInterface(
            data['unique-id'],
            CalmRateLimitKey.fromJson(data.key),
            data.time,
            data['time-unit'],
            data.calls
        );
    }
}

export class CalmContainerImageInterface extends CalmInterface {
    constructor(public uniqueId: string, public image: string) {
        super(uniqueId);
    }

    static fromJson(data: CalmContainerImageInterfaceSchema): CalmContainerImageInterface {
        return new CalmContainerImageInterface(data['unique-id'], data.image);
    }
}

export class CalmPortInterface extends CalmInterface {
    constructor(public uniqueId: string, public port: number) {
        super(uniqueId);
    }

    static fromJson(data: CalmPortInterfaceSchema): CalmPortInterface {
        return new CalmPortInterface(data['unique-id'], data.port);
    }
}

export class CalmRateLimitKey {
    constructor(public keyType: 'User' | 'IP' | 'Global' | 'Header' | 'OAuth2Client', public staticValue: string) {}

    static fromJson(data: CalmRateLimitKeySchema): CalmRateLimitKey {
        return new CalmRateLimitKey(data['key-type'], data['static-value']);
    }
}
