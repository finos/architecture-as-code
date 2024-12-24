/**
 * Schema for defining evidence for control requirements within the Common Architecture Language Model.
 */
export interface Evidence {
  evidence: {
    /**
     * CALM unique-id for future linking and uniquely defining this evidence
     */
    "unique-id": string;
    /**
     * Paths to the evidence relating to a specific control
     */
    "evidence-paths": string[];
    /**
     * URI for the control configuration this evidence relates to
     */
    "control-configuration-url": string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
