import type { Workspace } from '@/server/workspace';
type Serialized<T> = T extends Date
  ? string
  : T extends bigint
    ? string
    : T extends readonly (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;
export type WorkspaceData = Serialized<Workspace>;
export type MemberData = WorkspaceData['members'][number];
export type MembershipData = MemberData['memberships'][number];
export type SaleData = WorkspaceData['sales'][number];
