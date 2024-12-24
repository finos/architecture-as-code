export type Metadata = {
  [k: string]: unknown;
}[];
export type Metadata1 = {
  [k: string]: unknown;
}[];

export interface Core {
  nodes?: Node[];
  relationships?: Relationship[];
  metadata?: Metadata;
  controls?: Controls;
  flows?: Flow[];
  [k: string]: unknown;
}
export interface Node {
  "unique-id": string;
  "node-type":
    | "actor"
    | "ecosystem"
    | "system"
    | "service"
    | "database"
    | "network"
    | "ldap"
    | "webclient"
    | "data-assset";
  name: string;
  description: string;
  "detailed-architecture"?: string;
  "data-classification"?: "Public" | "Confidential" | "Highly Restricted" | "MNPI" | "PII";
  "run-as"?: string;
  instance?: string;
  interfaces?: InterfaceType[];
  controls?: Controls;
  metadata?: Metadata;
  [k: string]: unknown;
}
export interface InterfaceType {
  "unique-id": string;
  [k: string]: unknown;
}
export interface Controls {
  /**
   * This interface was referenced by `Controls`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9-]+$".
   */
  [k: string]: {
    /**
     * A description of a control and how it applies to a given architecture
     */
    description: string;
    requirements: ControlDetail[];
    [k: string]: unknown;
  };
}
export interface ControlDetail {
  /**
   * The requirement schema that specifies how a control should be defined
   */
  "control-requirement-url": string;
  /**
   * The configuration of how the control requirement schema is met
   */
  "control-config-url"?: string;
  [k: string]: unknown;
}
export interface Relationship {
  "unique-id": string;
  description?: string;
  "relationship-type": {
    interacts?: InteractsType;
    connects?: ConnectsType;
    "deployed-in"?: DeployedInType;
    "composed-of"?: ComposedOfType;
    [k: string]: unknown;
  };
  protocol?:
    | "HTTP"
    | "HTTPS"
    | "FTP"
    | "SFTP"
    | "JDBC"
    | "WebSocket"
    | "SocketIO"
    | "LDAP"
    | "AMQP"
    | "TLS"
    | "mTLS"
    | "TCP";
  authentication?: "Basic" | "OAuth2" | "Kerberos" | "SPNEGO" | "Certificate";
  metadata?: Metadata;
  controls?: Controls;
  [k: string]: unknown;
}
export interface InteractsType {
  actor: string;
  /**
   * @minItems 1
   */
  nodes: [string, ...string[]];
  [k: string]: unknown;
}
export interface ConnectsType {
  source: NodeInterface;
  destination: NodeInterface;
  [k: string]: unknown;
}
export interface NodeInterface {
  node: string;
  interfaces?: string[];
  [k: string]: unknown;
}
export interface DeployedInType {
  container?: string;
  /**
   * @minItems 1
   */
  nodes?: [string, ...string[]];
  [k: string]: unknown;
}
export interface ComposedOfType {
  container: string;
  /**
   * @minItems 1
   */
  nodes: [string, ...string[]];
  [k: string]: unknown;
}
export interface Flow {
  /**
   * Unique identifier for the flow
   */
  "unique-id": string;
  /**
   * Descriptive name for the business flow
   */
  name: string;
  /**
   * Detailed description of the flow's purpose
   */
  description: string;
  /**
   * Link to a detailed requirement document
   */
  "requirement-url"?: string;
  transitions: Transition[];
  controls?: Controls;
  metadata?: Metadata1;
  [k: string]: unknown;
}
export interface Transition {
  /**
   * Unique identifier for the relationship in the architecture
   */
  "relationship-unique-id"?: string;
  /**
   * Indicates the sequence of the relationship in the flow
   */
  "sequence-number"?: number;
  /**
   * Functional summary of what is happening in the transition
   */
  summary?: string;
  direction?: "source-to-destination" | "destination-to-source";
  required?: ["relationship-unique-id", "sequence-number", "summary"];
  [k: string]: unknown;
}
