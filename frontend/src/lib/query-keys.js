export const qk = {
    products: ['products'],
    categories: ['categories'],
    inventory: ['inventory'],
    customers: ['customers'],
    users: ['users'],
    units: ['units'],
    /** Per-product sell units: [...qk.productUnits, productId, userId] */
    productUnits: ['product-units'],
    /** Org role permission matrix: [...qk.rolePerms, orgId] */
    rolePerms: ['role-perms'],
    /** Membership roles from GET /stores (for nav/feature checks) */
    stores: ['stores'],
};
