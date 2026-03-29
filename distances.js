// distances.js
// One single place for your stock carry / total distances

const DISTANCES = [
  { club: 'driver', label: 'Driver', carry: 180, total: 200 },

  { club: '7i', label: '7 Iron', carry: 120, total: 128 },
  { club: '8i', label: '8 Iron', carry: 110, total: 117 },
  { club: '9i', label: '9 Iron', carry: 100, total: 106 },

  { club: 'pw', label: 'PW', carry: 90, total: 95 },
  { club: 'sw', label: 'SW', carry: 75, total: 80 },
  { club: '58', label: '58°', carry: 60, total: 65 },

  { club: 'putter', label: 'Putter', carry: 0, total: 0 }
];

function getDistanceRow(distanceRef) {
  return DISTANCES.find(row => row.club === distanceRef) || null;
}

function getCarry(distanceRef) {
  return getDistanceRow(distanceRef)?.carry ?? null;
}

function getTotal(distanceRef) {
  return getDistanceRow(distanceRef)?.total ?? null;
}
