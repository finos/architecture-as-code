# CALM Schema v1.1 Release Notes

CALM v1.1 is a minor revision of 1.0, fixing the definition of flows.

## Key Updates

### Flows

The schema for business flows has been revised to correct an error in the 1.0 definition.

Whilst not strictly backwards compatible, the changes are minor and should be straightforward to implement.

Specific changes are:

* Flows may not have any additional properties beyond those defined in the schema.
  * Users may make use of metadata for extensibility.
* Flow transitions MUST contain `relationship-unique-id`, `sequence-number`, and `description` properties.
  * This requirement was incorrect coded in the 1.0 schema.

## Question and Feedback

For questions or feedback, please engage with the CALM community through the appropriate channels.