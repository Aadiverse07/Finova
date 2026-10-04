/**
 * Local mirror of the role constants in `@quikit/shared` (packages/shared/lib/constants.ts).
 * Do NOT invent new role strings; replace this file with the shared import once available.
 * `admin` survives only as a legacy fallback for rows seeded before the rename to `org_admin`.
 */
export const MEMBERSHIP_ROLES = ['super_admin', 'org_admin', 'app_admin', 'member'] as const;
export const ADMIN_TIER_ROLES: readonly string[] = ['super_admin', 'org_admin', 'admin'];

export function isAdminTier(orgRole: string | null | undefined, isSuperAdmin: boolean): boolean {
  return isSuperAdmin || (!!orgRole && ADMIN_TIER_ROLES.includes(orgRole));
}
