# CALM Flow Examples (JSON – release/1.0-rc1)

Flows describe business-level movement of data or actions across your architecture, mapping to existing relationships.

Each flow must include:
- `unique-id`
- `name`
- `description`
- At least one `transition` referencing a `relationship-unique-id`.

---

## 🔁 Example: Trade Execution to Settlement Flow

```json
{
  "unique-id": "flow-tradeexec-to-settlement",
  "name": "Trade Execution to Settlement",
  "description": "This flow outlines how a trade moves from the trading API to the settlement system after being submitted.",
  "transitions": [
    {
      "relationship-unique-id": "grpc-to-kafka",
      "sequence-number": 1,
      "summary": "The Trading API publishes the trade event to Kafka",
      "direction": "source-to-destination"
    },
    {
      "relationship-unique-id": "kafka-to-settlement",
      "sequence-number": 2,
      "summary": "Kafka streams the event to the Settlement Engine",
      "direction": "source-to-destination"
    }
  ]
}
```

Each `transition` represents a step and maps to a defined `relationship` in your architecture.

Ensure the `relationship-unique-id` used in transitions matches actual relationships defined in your model.