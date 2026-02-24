export const USER_ROLES = ['employee', 'leader', 'admin', 'delegate'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const EMPLOYEE_ROLES: UserRole[] = ['employee', 'leader', 'admin', 'delegate'];
export const LEADER_DASHBOARD_ROLES: UserRole[] = ['leader', 'admin'];
export const QR_NONCE_MINT_ROLES: UserRole[] = ['leader', 'admin'];

export function hasRole(userRole: string | undefined, allowedRoles: UserRole[]) {
  return !!userRole && allowedRoles.includes(userRole as UserRole);
}
