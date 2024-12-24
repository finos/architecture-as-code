/**
 * Schema for defining control requirements within the Common Architecture Language Model.
 */
export interface ControlRequirement {
  /**
   * The unique identifier of this control, which has the potential to be used for linking evidence
   */
  "control-id": string;
  /**
   * The name of the control requirement that provides contextual meaning within a given domain
   */
  name: string;
  /**
   * A more detailed description of the control and information on what a developer needs to consider
   */
  description: string;
  [k: string]: unknown;
}
