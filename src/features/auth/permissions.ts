
export const USER_ROLES = [
  "owner",
  "manager",
  "inventory_manager",
  "cashier",
  "accountant",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type AppModule =
  | "pos"
  | "inventory"
  | "whatsapp"
  | "price"
  | "debt"
  | "finance"
  | "analytics";

export const ROLE_MODULES: Record<UserRole, readonly AppModule[]> = {
  owner: [
    "pos",
    "inventory",
    "whatsapp",
    "price",
    "debt",
    "finance",
    "analytics",
  ],

  manager: [
    "pos",
    "inventory",
    "debt",
  ],

  inventory_manager: [
    "inventory",
  ],

  cashier: [
    "pos",
  ],

  accountant: [
    "finance",
  ],
};

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    USER_ROLES.some((role) => role === value)
  );
}

export function canAccessModule(
  role: UserRole,
  module: AppModule,
): boolean {
  return ROLE_MODULES[role].includes(module);
}

export function canViewSalesHistory(role: UserRole): boolean {
  return role === "owner" || role === "manager";
}

export function canAccessStaffAudit(role: UserRole): boolean {
  return role === "owner";
}

export function canManageDebt(role: UserRole): boolean {
  return role === "owner" || role === "manager";
}

export function canReadFinancialRecords(role: UserRole): boolean {
  return (
    role === "owner" ||
    role === "manager" ||
    role === "accountant"
  );
}

export function canViewAnalytics(role: UserRole): boolean {
  return role === "owner";
}

export function canSwitchBranch(role: UserRole): boolean {
  return role === "owner";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "owner";
}

export function canManageInventory(role: UserRole): boolean {
  return (
    role === "owner" ||
    role === "manager" ||
    role === "inventory_manager"
  );
}

export function canAccessAssignedBranchOnly(role: UserRole): boolean {
  return (
    role === "manager" ||
    role === "inventory_manager" ||
    role === "cashier"
  );
}

export function getDefaultModule(role: UserRole): AppModule {
  switch (role) {
    case "owner":
    case "manager":
    case "cashier":
      return "pos";

    case "inventory_manager":
      return "inventory";

    case "accountant":
      return "finance";
  }
}
