# CALM Node Examples (JSON – release/1.0-rc1)

Each node includes all required fields according to the CALM schema.

---

## 🟦 Service Node Example
```json
{
  "unique-id": "node-kafka-service",
  "node-type": "service",
  "name": "Kafka Event Service",
  "description": "Handles event streaming for the application",
  "interfaces": [
    {
      "unique-id": "int-kafka-001",
      "interface-definition-url": "https://calm.finos.org/release/1.0-rc1/prototype/interfaces/kafka-topic.json",
      "configuration": {
        "topic": "trade-events",
        "host": "kafka.internal.local",
        "port": 9092
      }
    }
  ]
}
```

---

## 🟧 Database Node Example
```json
{
  "unique-id": "node-trade-database",
  "node-type": "database",
  "name": "TradeDatabase",
  "description": "Primary storage for trade records",
  "data-classification": "non-sensitive",
  "run-as": "postgres_user"
}
```

---

## 🟩 System Node with Details
```json
{
  "unique-id": "node-trading-platform",
  "node-type": "system",
  "name": "Trading API System",
  "description": "Core system handling trade submission and validation",
  "details": {
    "detailed-architecture": "https://internal.design/docs/trading-platform-arch",
    "required-pattern": "https://calm.finos.org/patterns/financial-system"
  },
  "controls": [
    {
      "control-id": "security-002",
      "name": "Permitted Connection",
      "description": "Allows only approved protocols on this system"
    }
  ],
  "interfaces": [
    {
      "unique-id": "int-grpc-001",
      "interface-definition-url": "https://calm.finos.org/release/1.0-rc1/prototype/interfaces/grpc-service.json",
      "configuration": {
        "service-name": "TradeService",
        "host": "api.internal.local",
        "port": 8080,
        "proto-file": "trading.proto",
        "methods": [
          {
            "name": "SubmitTrade",
            "input-type": "TradeRequest",
            "output-type": "TradeResponse"
          }
        ]
      }
    }
  ]
}
```
