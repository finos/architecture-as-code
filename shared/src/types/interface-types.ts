
export type CalmInterfaceTypeSchema = {
    'unique-id': string;
};

export type CalmNodeInterfaceSchema = {
    node: string;
    interfaces: string[];
};

export type CalmHostPortInterfaceSchema = CalmInterfaceTypeSchema & {
    host: string;
    port: number;
};

export type CalmHostnameInterfaceSchema = CalmInterfaceTypeSchema & {
    hostname: string;
};

export type CalmPathInterfaceSchema = CalmInterfaceTypeSchema & {
    path: string;
};

export type CalmOAuth2AudienceInterfaceSchema = CalmInterfaceTypeSchema & {
    audiences: string[];
};

export type CalmURLInterfaceSchema = CalmInterfaceTypeSchema & {
    url: string;
};

export type CalmRateLimitInterfaceSchema = CalmInterfaceTypeSchema & {
    key: CalmRateLimitKeySchema;
    time: number;
    'time-unit': 'Seconds' | 'Minutes' | 'Hours'; //TODO: change to use time-unit schema
    calls: number;
};

export type CalmContainerImageInterfaceSchema = CalmInterfaceTypeSchema & {
    image: string;
};

export type CalmPortInterfaceSchema = CalmInterfaceTypeSchema & {
    port: number;
};

export type CalmRateLimitKeySchema = {
    'key-type': 'User' | 'IP' | 'Global' | 'Header' | 'OAuth2Client';
    'static-value': string;
};
