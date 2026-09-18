// The CALM meta-schemas the lab validates against, imported straight from calm/ in this repo so
// they can never drift, keyed by $id for the in-memory document loader.
import calm from '../../calm/release/1.2/meta/calm.json';
import core from '../../calm/release/1.2/meta/core.json';
import iface from '../../calm/release/1.2/meta/interface.json';
import control from '../../calm/release/1.2/meta/control.json';
import controlRequirement from '../../calm/release/1.2/meta/control-requirement.json';
import evidence from '../../calm/release/1.2/meta/evidence.json';
import flow from '../../calm/release/1.2/meta/flow.json';
import units from '../../calm/release/1.2/meta/units.json';
import decorators from '../../calm/release/1.2/meta/decorators.json';
import timeline from '../../calm/release/1.2/meta/timeline.json';
import calmTimeline from '../../calm/release/1.2/meta/calm-timeline.json';
// draft/2025-03 set: documents that declare the draft $schema (e.g. the TraderX sample) validate
// against their declared schema rather than falling back to the 1.2 release.
import draftCalm from '../../calm/draft/2025-03/meta/calm.json';
import draftCore from '../../calm/draft/2025-03/meta/core.json';
import draftInterface from '../../calm/draft/2025-03/meta/interface.json';
import draftControl from '../../calm/draft/2025-03/meta/control.json';
import draftControlRequirement from '../../calm/draft/2025-03/meta/control-requirement.json';
import draftEvidence from '../../calm/draft/2025-03/meta/evidence.json';
import draftFlow from '../../calm/draft/2025-03/meta/flow.json';
import draftUnits from '../../calm/draft/2025-03/meta/units.json';

const ALL = [
    calm, core, iface, control, controlRequirement, evidence, flow, units, decorators, timeline, calmTimeline,
    draftCalm, draftCore, draftInterface, draftControl, draftControlRequirement, draftEvidence, draftFlow, draftUnits,
] as Array<{ $id: string }>;

export const SCHEMAS: Record<string, object> = Object.fromEntries(ALL.map((schema) => [schema.$id, schema]));
