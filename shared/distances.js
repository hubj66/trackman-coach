// distances.js
// Stock carry / total distances — update after each full-bag session

const DISTANCES = [
  { club: 'driver', label: 'Driver',  carry: 180, total: 200 },
  { club: '6i',     label: '6 Iron',  carry: 114, total: 122 },
  { club: '7i',     label: '7 Iron',  carry: 108, total: 116 },
  { club: '8i',     label: '8 Iron',  carry: 98,  total: 105 },
  { club: '9i',     label: '9 Iron',  carry: 88,  total: 94  },
  { club: 'pw',     label: 'PW',      carry: 82,  total: 88  },
  { club: 'sw',     label: 'SW',      carry: 68,  total: 73  },
  { club: '58',     label: '58°',     carry: 59,  total: 63  },
  { club: 'putter', label: 'Putter',  carry: 0,   total: 0   },
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
