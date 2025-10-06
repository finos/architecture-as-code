import { CalmAdrMeta } from '@finos/calm-shared/src/view-model/adr.js';
import {
    CalmArchitectureSchema,
    CalmPatternSchema,
} from '../../../calm-models/src/types/core-types.js';
import { CalmFlowSchema } from '../../../calm-models/src/types/flow-types.js';

export type Namespace = string;
export type PatternID = string;
export type Pattern = CalmPatternSchema;
export type Architecture = CalmArchitectureSchema;
export type ArchitectureID = string;
export type FlowID = string;
export type AdrID = string;
export type Flow = CalmFlowSchema;
export type Version = string;
export type Revision = string;
export type Adr = CalmAdrMeta;
export type CalmType = 'Architectures' | 'Patterns' | 'Flows' | 'ADRs';

export type Data =
    | {
          id: string;
          version: string;
          name: Namespace;
          data: Architecture | undefined;
          calmType: 'Architectures';
      }
    | {
          id: string;
          version: string;
          name: Namespace;
          data: Pattern | undefined;
          calmType: 'Patterns';
      }
    | {
          id: string;
          version: string;
          name: Namespace;
          data: Flow | undefined;
          calmType: 'Flows';
      }
    | {
          id: string;
          version: string;
          name: Namespace;
          data: Adr | undefined;
          calmType: 'ADRs';
      };
