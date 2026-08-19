const ALL_ACTIONS = ['view', 'create', 'edit', 'delete'];
const VIEW_CREATE_EDIT = ['view', 'create', 'edit'];
const VIEW_ONLY = ['view'];
const NONE = [];

const permissions = {
  super_admin: {
    dashboard: ALL_ACTIONS,
    leads: ALL_ACTIONS,
    customers: ALL_ACTIONS,
    orders: ALL_ACTIONS,
    products: ALL_ACTIONS,
    followups: ALL_ACTIONS,
    reminders: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    users: ALL_ACTIONS,
    settings: ALL_ACTIONS,
    trash: ALL_ACTIONS
  },
  manager: {
    dashboard: ALL_ACTIONS,
    leads: ALL_ACTIONS,
    customers: ALL_ACTIONS,
    orders: ALL_ACTIONS,
    products: ALL_ACTIONS,
    followups: ALL_ACTIONS,
    reminders: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    users: NONE,
    settings: NONE
  },
  caller: {
    dashboard: VIEW_ONLY,
    leads: VIEW_CREATE_EDIT,
    customers: VIEW_CREATE_EDIT,
    orders: VIEW_CREATE_EDIT,
    products: VIEW_ONLY,
    followups: VIEW_CREATE_EDIT,
    reminders: VIEW_ONLY,
    reports: NONE,
    users: NONE,
    settings: NONE
  }
};

module.exports = permissions;
