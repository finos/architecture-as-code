# Patterns with Placeholders

Defining more detailed patterns is a unique opportunity in the CALM model.
The level of detail allows us to create re-usable patterns with different configuration depending on the business case.
The API Gateway pattern is a good example of this, where an API Consumer is routing via an API Gateway to an API Producer.
In each instantiation of the pattern unique values will be required for:

* The `host`, `port`, and `path` of the API hosted on the API Gateway
* The OAuth2 well known endpoint to validate a JWT token
* The audience of a given API
* The `host`, `port`, and `path` of the downstream service

![Gateway Pattern](gateway-pattern.svg)

As an architect, I would like to provide patterns with mandatory placeholders that need to be supplied by the implementer, so that I can ensure pattern conformance within an opinionated architecture.

### Options for Implementation

It is my opinion that we need to consider patterns with placeholders.
There are several approaches that we could take:
1. Patterns could be modelled as JSON Schemas that extend the CALM model 
   * Pros
      * It is what needs to be supplied and has a mechanism of type checking/completion
   * Cons
      * Difficult for pattern author
      * Limitations within JSON schema for variables and inheritance (though I am far from an expert here)
1. Patterns are JSON/YAML documents that use the CALM schema.
Architects design their pattern and provide placeholder values.
This approach becomes a capability where CALM models can be incomplete.
   * Pros
      * Easy to work with for architects and developers
   * Cons
      * Tooling would need to check that all placeholder values are supplied

