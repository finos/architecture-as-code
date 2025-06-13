import { Adr } from './adr.js';

export interface AdrMeta {
    namespace: string;
    id: number;
    revision: number;
    adr: Adr;
}
