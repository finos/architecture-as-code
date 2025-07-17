var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/infrastructure-transformer.ts
var infrastructure_transformer_exports = {};
__export(infrastructure_transformer_exports, {
  default: () => InfrastructureTransformer
});
module.exports = __toCommonJS(infrastructure_transformer_exports);

// src/model/interface.ts
var CalmInterface = class {
  constructor(uniqueId) {
    this.uniqueId = uniqueId;
  }
  static fromJson(data) {
    if ("host" in data && "port" in data) {
      return CalmHostPortInterface.fromJson(data);
    } else if ("hostname" in data) {
      return CalmHostnameInterface.fromJson(data);
    } else if ("path" in data) {
      return CalmPathInterface.fromJson(data);
    } else if ("audiences" in data) {
      return CalmOAuth2AudienceInterface.fromJson(data);
    } else if ("url" in data) {
      return CalmURLInterface.fromJson(data);
    } else if ("key" in data) {
      return CalmRateLimitInterface.fromJson(data);
    } else if ("image" in data) {
      return CalmContainerImageInterface.fromJson(data);
    } else if ("port" in data) {
      return CalmPortInterface.fromJson(data);
    } else {
      throw new Error("Unknown interface type");
    }
  }
};
var CalmNodeInterface = class _CalmNodeInterface {
  constructor(node, interfaces) {
    this.node = node;
    this.interfaces = interfaces;
  }
  static fromJson(data) {
    return new _CalmNodeInterface(data.node, data.interfaces);
  }
};
var CalmHostPortInterface = class _CalmHostPortInterface extends CalmInterface {
  constructor(uniqueId, host, port) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.host = host;
    this.port = port;
  }
  static fromJson(data) {
    return new _CalmHostPortInterface(data["unique-id"], data.host, data.port);
  }
};
var CalmHostnameInterface = class _CalmHostnameInterface extends CalmInterface {
  constructor(uniqueId, hostname) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.hostname = hostname;
  }
  static fromJson(data) {
    return new _CalmHostnameInterface(data["unique-id"], data.hostname);
  }
};
var CalmPathInterface = class _CalmPathInterface extends CalmInterface {
  constructor(uniqueId, path) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.path = path;
  }
  static fromJson(data) {
    return new _CalmPathInterface(data["unique-id"], data.path);
  }
};
var CalmOAuth2AudienceInterface = class _CalmOAuth2AudienceInterface extends CalmInterface {
  constructor(uniqueId, audiences) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.audiences = audiences;
  }
  static fromJson(data) {
    return new _CalmOAuth2AudienceInterface(data["unique-id"], data.audiences);
  }
};
var CalmURLInterface = class _CalmURLInterface extends CalmInterface {
  constructor(uniqueId, url) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.url = url;
  }
  static fromJson(data) {
    return new _CalmURLInterface(data["unique-id"], data.url);
  }
};
var CalmRateLimitInterface = class _CalmRateLimitInterface extends CalmInterface {
  constructor(uniqueId, key, time, timeUnit, calls) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.key = key;
    this.time = time;
    this.timeUnit = timeUnit;
    this.calls = calls;
  }
  static fromJson(data) {
    return new _CalmRateLimitInterface(
        data["unique-id"],
        CalmRateLimitKey.fromJson(data.key),
        data.time,
        data["time-unit"],
        data.calls
    );
  }
};
var CalmContainerImageInterface = class _CalmContainerImageInterface extends CalmInterface {
  constructor(uniqueId, image) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.image = image;
  }
  static fromJson(data) {
    return new _CalmContainerImageInterface(data["unique-id"], data.image);
  }
};
var CalmPortInterface = class _CalmPortInterface extends CalmInterface {
  constructor(uniqueId, port) {
    super(uniqueId);
    this.uniqueId = uniqueId;
    this.port = port;
  }
  static fromJson(data) {
    return new _CalmPortInterface(data["unique-id"], data.port);
  }
};
var CalmRateLimitKey = class _CalmRateLimitKey {
  constructor(keyType, staticValue) {
    this.keyType = keyType;
    this.staticValue = staticValue;
  }
  static fromJson(data) {
    return new _CalmRateLimitKey(data["key-type"], data["static-value"]);
  }
};

// src/model/control.ts
var CalmControlDetail = class _CalmControlDetail {
  constructor(controlRequirementUrl, controlConfigUrl) {
    this.controlRequirementUrl = controlRequirementUrl;
    this.controlConfigUrl = controlConfigUrl;
  }
  static fromJson(data) {
    return new _CalmControlDetail(
        data["control-requirement-url"],
        data["control-config-url"]
    );
  }
};
var CalmControl = class _CalmControl {
  constructor(controlId, description, requirements) {
    this.controlId = controlId;
    this.description = description;
    this.requirements = requirements;
  }
  static fromJson(data) {
    if (!data) return [];
    return Object.entries(data).map(
        ([controlId, controlData]) => new _CalmControl(
            controlId,
            controlData.description,
            controlData.requirements.map(CalmControlDetail.fromJson)
        )
    );
  }
};

// src/model/metadata.ts
var CalmMetadata = class _CalmMetadata {
  constructor(data) {
    this.data = data;
  }
  static fromJson(data) {
    if (!data) return new _CalmMetadata({});
    const flattenedData = data.reduce((acc, curr) => {
      return { ...acc, ...curr };
    }, {});
    return new _CalmMetadata(flattenedData);
  }
};

// src/model/node.ts
var CalmNodeDetails = class _CalmNodeDetails {
  constructor(detailedArchitecture, requiredPattern) {
    this.detailedArchitecture = detailedArchitecture;
    this.requiredPattern = requiredPattern;
  }
  static fromJson(data) {
    return new _CalmNodeDetails(
        data["detailed-architecture"],
        data["required-pattern"]
    );
  }
};
var CalmNode = class _CalmNode {
  constructor(uniqueId, nodeType, name, description, details, interfaces, controls, metadata, dataClassification, runAs) {
    this.uniqueId = uniqueId;
    this.nodeType = nodeType;
    this.name = name;
    this.description = description;
    this.details = details;
    this.interfaces = interfaces;
    this.controls = controls;
    this.metadata = metadata;
    this.dataClassification = dataClassification;
    this.runAs = runAs;
  }
  static fromJson(data) {
    return new _CalmNode(
        data["unique-id"],
        data["node-type"],
        data.name,
        data.description,
        data.details ? CalmNodeDetails.fromJson(data.details) : new CalmNodeDetails("", ""),
        data.interfaces ? data.interfaces.map(CalmInterface.fromJson) : [],
        data.controls ? CalmControl.fromJson(data.controls) : [],
        data.metadata ? CalmMetadata.fromJson(data.metadata) : new CalmMetadata({}),
        data["data-classification"],
        data["run-as"]
    );
  }
};

// src/model/relationship.ts
var CalmRelationship = class _CalmRelationship {
  constructor(uniqueId, relationshipType, metadata, controls, description, protocol, authentication) {
    this.uniqueId = uniqueId;
    this.relationshipType = relationshipType;
    this.metadata = metadata;
    this.controls = controls;
    this.description = description;
    this.protocol = protocol;
    this.authentication = authentication;
  }
  static fromJson(data) {
    return new _CalmRelationship(
        data["unique-id"],
        _CalmRelationship.deriveRelationshipType(data["relationship-type"]),
        data.metadata ? CalmMetadata.fromJson(data.metadata) : new CalmMetadata({}),
        CalmControl.fromJson(data.controls),
        data.description,
        data.protocol,
        data.authentication
    );
  }
  static deriveRelationshipType(data) {
    if (data.interacts) {
      return CalmInteractsType.fromJson(data.interacts);
    } else if (data.connects) {
      return CalmConnectsType.fromJson(data.connects);
    } else if (data["deployed-in"]) {
      return CalmDeployedInType.fromJson(data["deployed-in"]);
    } else if (data["composed-of"]) {
      return CalmComposedOfType.fromJson(data["composed-of"]);
    } else if (data.options) {
      return CalmOptionsRelationshipType.fromJson(data.options);
    } else {
      throw new Error("Invalid relationship type data");
    }
  }
};
var CalmRelationshipType = class {
};
var CalmInteractsType = class _CalmInteractsType extends CalmRelationshipType {
  constructor(actor, nodes) {
    super();
    this.actor = actor;
    this.nodes = nodes;
  }
  static fromJson(data) {
    return new _CalmInteractsType(data.actor, data.nodes);
  }
};
var CalmConnectsType = class _CalmConnectsType extends CalmRelationshipType {
  constructor(source, destination) {
    super();
    this.source = source;
    this.destination = destination;
  }
  static fromJson(data) {
    return new _CalmConnectsType(
        CalmNodeInterface.fromJson(data.source),
        CalmNodeInterface.fromJson(data.destination)
    );
  }
};
var CalmDeployedInType = class _CalmDeployedInType extends CalmRelationshipType {
  constructor(container, nodes) {
    super();
    this.container = container;
    this.nodes = nodes;
  }
  static fromJson(data) {
    return new _CalmDeployedInType(data.container, data.nodes);
  }
};
var CalmComposedOfType = class _CalmComposedOfType extends CalmRelationshipType {
  constructor(container, nodes) {
    super();
    this.container = container;
    this.nodes = nodes;
  }
  static fromJson(data) {
    return new _CalmComposedOfType(data.container, data.nodes);
  }
};
var CalmOptionType = class _CalmOptionType {
  constructor(description, nodes, relationships) {
    this.description = description;
    this.nodes = nodes;
    this.relationships = relationships;
  }
  static fromJson(data) {
    return new _CalmOptionType(data.description, data.nodes, data.relationships);
  }
};
var CalmOptionsRelationshipType = class _CalmOptionsRelationshipType extends CalmRelationshipType {
  constructor(options) {
    super();
    this.options = options;
  }
  static fromJson(data) {
    return new _CalmOptionsRelationshipType(data.map((calmOptionData) => CalmOptionType.fromJson(calmOptionData)));
  }
};

// src/model/flow.ts
var CalmFlow = class _CalmFlow {
  constructor(uniqueId, name, description, transitions, requirementUrl, controls, metadata) {
    this.uniqueId = uniqueId;
    this.name = name;
    this.description = description;
    this.transitions = transitions;
    this.requirementUrl = requirementUrl;
    this.controls = controls;
    this.metadata = metadata;
  }
  static fromJson(data) {
    return new _CalmFlow(
        data["unique-id"],
        data.name,
        data.description,
        data.transitions.map(CalmFlowTransition.fromJson),
        data["requirement-url"],
        CalmControl.fromJson(data.controls),
        CalmMetadata.fromJson(data.metadata)
    );
  }
};
var CalmFlowTransition = class _CalmFlowTransition {
  constructor(relationshipUniqueId, sequenceNumber, summary, direction = "source-to-destination") {
    this.relationshipUniqueId = relationshipUniqueId;
    this.sequenceNumber = sequenceNumber;
    this.summary = summary;
    this.direction = direction;
  }
  static fromJson(data) {
    return new _CalmFlowTransition(
        data["relationship-unique-id"],
        data["sequence-number"],
        data.summary,
        data.direction || "source-to-destination"
    );
  }
};

// src/model/core.ts
var CalmCore = class _CalmCore {
  constructor(nodes, relationships, metadata, controls, flows) {
    this.nodes = nodes;
    this.relationships = relationships;
    this.metadata = metadata;
    this.controls = controls;
    this.flows = flows;
  }
  static fromJson(data) {
    return new _CalmCore(
        data.nodes ? data.nodes.map(CalmNode.fromJson) : [],
        data.relationships ? data.relationships.map(CalmRelationship.fromJson) : [],
        data.metadata ? CalmMetadata.fromJson(data.metadata) : new CalmMetadata({}),
        data.controls ? CalmControl.fromJson(data.controls) : [],
        data.flows ? data.flows.map(CalmFlow.fromJson) : []
    );
  }
};

// src/infrastructure-transformer.ts
var InfrastructureTransformer = class {
  registerTemplateHelpers() {
    return {};
  }
  getTransformedModel(calmJson) {
    const calmSchema = JSON.parse(calmJson);
    const calmCore = CalmCore.fromJson(calmSchema);
    let namespaceName;
    let databaseName;
    let databasePort;
    let applicationName;
    let applicationPort;
    let lbHost;
    let lbPort;
    let applicationImage;
    let secure;
    namespaceName = calmCore.metadata.data["kubernetes"]["namespace"];
    calmCore.nodes.forEach((node) => {
      if (node.nodeType === "system") {
        const microSegControl = node.controls.find(
            (control) => control.requirements?.some(
                (req) => req.controlConfigUrl["$id"].includes("micro-segmentation")
            )
        );
        if (microSegControl) {
          secure = true;
        }
      } else if (node.nodeType === "database") {
        databaseName = node.uniqueId;
        databasePort = node.interfaces.find(
            (interfaceObj) => interfaceObj instanceof CalmPortInterface
        )?.port;
      } else if (node.nodeType === "service") {
        applicationName = node.uniqueId;
        applicationPort = node.interfaces.find(
            (interfaceObj) => interfaceObj instanceof CalmPortInterface
        )?.port;
        applicationImage = node.interfaces.find(
            (interfaceObj) => interfaceObj instanceof CalmContainerImageInterface
        )?.image;
      } else if (node.nodeType === "network") {
        const hostPort = node.interfaces.find(
            (interfaceObj) => interfaceObj instanceof CalmHostPortInterface
        );
        lbHost = hostPort?.host;
        lbPort = hostPort?.port;
      }
    });
    return { document: {
        "namespaceName": namespaceName,
        "databaseName": databaseName,
        "appName": applicationName,
        "applicationPort": applicationPort,
        "applicationImage": applicationImage,
        "lbPort": lbPort,
        "databasePort": databasePort,
        "secure": secure
      } };
  }
};
module.exports = InfrastructureTransformer;
