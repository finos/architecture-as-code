# CALM Relationship Examples (JSON – release/1.0-rc1)

Relationships define the structural or behavioral connections between nodes. Each relationship includes:
- `unique-id`
- `description`
- A `relationship-type`, such as `connects`, `interacts`, `composed-of`, or `deployed-in`.

---

## 🔗 Example 1: Web Frontend → Trading API (HTTPS)
```json
{
  "unique-id": "rel-web-to-grpc",
  "description": "Web frontend calls trading API",
  "relationship-type": {
    "connects": {
      "source": {
        "node": "web-service"
      },
      "destination": {
        "node": "grpc-service"
      }
    }
  },
  "protocol": "HTTPS",
  "authentication": "OAuth2"
}
```

---

## 🔁 Example 2: Trading API → Kafka Service (TCP)
```json
{
  "unique-id": "rel-grpc-to-kafka",
  "description": "Trading API publishes events to Kafka",
  "relationship-type": {
    "connects": {
      "source": {
        "node": "grpc-service"
      },
      "destination": {
        "node": "kafka-service"
      }
    }
  },
  "protocol": "TCP"
}
```

---

## 🗃️ Example 3: Kafka → Trade Database (TCP)
```json
{
  "unique-id": "rel-kafka-to-db",
  "description": "Kafka sends trade data to the trade database",
  "relationship-type": {
    "connects": {
      "source": {
        "node": "kafka-service"
      },
      "destination": {
        "node": "trade-database"
      }
    }
  },
  "protocol": "TCP"
}
```

---

Use `relationship-type.connects` for technical integrations, `interacts` for actor interactions, and `composed-of` for structural containment.