export const state = {
  devices: [],
  statuses: {},
  selectedSerials: new Set(),
  loadingSerials: new Set(),
  currentView: 'grid',
  searchQuery: '',
  filterStatus: 'all',
  filterConnection: 'all'
};

export function getDeviceStatus(serial) {
  return state.statuses[serial] || { active: false, state: 'idle', duration: 0 };
}
