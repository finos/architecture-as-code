# CALM Interface Examples (JSON – release/1.0-rc1)

These examples show how to define and apply structured interface definitions in CALM, using schema extensions. Interfaces are modular and reusable components that define how nodes expose or consume communication endpoints.

---

## 🎛️ Kafka Interface Example

### ✅ Interface Definition Schema
URL: https://calm.finos.org/release/1.0-rc1/prototype/interfaces/kafka-topic.json

### ✅ Interface Applied to Node
```json
{
  "unique-id": "int-kafka-001",
  "interface-definition-url": "https://calm.finos.org/release/1.0-rc1/prototype/interfaces/kafka-topic.json",
  "configuration": {
    "topic": "trade-events",
    "host": "kafka.internal.local",
    "port": 9092
  }
}
```

---

## 🛰️ gRPC Service Interface Example

### ✅ Interface Definition Schema
URL: https://calm.finos.org/release/1.0-rc1/prototype/interfaces/grpc-service.json

### ✅ Interface Applied to Node
```json
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
      },
      {
        "name": "GetTradeStatus",
        "input-type": "TradeStatusRequest",
        "output-type": "TradeStatusResponse"
      }
    ]
  }
}
```

---

## 🌐 HTTP Hostname Interface (Flat)

This is a flat interface without a reference schema, using minimal inline configuration.

### ✅ Interface Applied to Node
```json
{
  "unique-id": "int-http-001",
  "hostname": "trading.example.com"
}
```
