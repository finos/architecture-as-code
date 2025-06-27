# CALM Metadata Examples (JSON – release/1.0-rc1)

These examples show how to include metadata in various CALM constructs to enrich your architecture models.

---

## 🟦 Node with Metadata
```json
{
  "unique-id": "node-trading-platform",
  "node-type": "system",
  "name": "Trading API System",
  "description": "Core system handling trade submission and validation",
  "metadata": {
    "version": "2.3.1",
    "owner": "Platform Team",
    "deployed-on": "Kubernetes",
    "last-reviewed": "2025-06-15"
  }
}
```

---

## 🟧 Interface with Metadata
```json
{
  "unique-id": "int-grpc-001",
  "interface-definition-url": "https://calm.finos.org/release/1.0-rc1/prototype/interfaces/grpc-service.json",
  "configuration": {
    "service-name": "TradeService",
    "host": "api.internal.local",
    "port": 8080
  },
  "metadata": {
    "version": "v1",
    "owner": "API Team",
    "availability": "99.9%",
    "last-updated": "2025-05-20"
  }
}
```

---

## 🟥 Relationship with Metadata
```json
{
  "unique-id": "rel-grpc-to-kafka",
  "description": "Trading API publishes events to Kafka",
  "relationship-type": {
    "connects": {
      "source": { "node": "grpc-service" },
      "destination": { "node": "kafka-service" }
    }
  },
  "protocol": "TCP",
  "metadata": {
    "bandwidth": "1Gbps",
    "encryption": "TLSv1.3",
    "last-tested": "2025-06-10"
  }
}
```

---

## 🟩 Flow with Metadata
```json
{
  "unique-id": "flow-tradeexec-to-settlement",
  "name": "Trade Execution to Settlement",
  "description": "Flow of trade data after submission",
  "transitions": [
    {
      "relationship-unique-id": "rel-grpc-to-kafka",
      "sequence-number": 1,
      "summary": "API publishes event to Kafka",
      "direction": "source-to-destination"
    }
  ],
  "metadata": {
    "business-owner": "Trade Operations",
    "sla": "2 seconds",
    "last-audited": "2025-06-12"
  }
}
```

---

## 🟪 Control with Metadata
```json
{
  "control-id": "ctrl-validate-trade",
  "name": "Validate Trade Control",
  "description": "Ensures that all trades pass validation rules",
  "metadata": {
    "compliance": "FINRA",
    "priority": "high",
    "review-date": "2025-06-18"
  }
}
```
