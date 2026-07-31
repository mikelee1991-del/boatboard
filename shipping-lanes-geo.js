/** SoCal shipping lanes — 33 CFR Part 167 LA/Long Beach TSS (NAD83) + simplified fairways */
window.SHIPPING_LANES_GEO = {
  type: 'FeatureCollection',
  source: '33 CFR Part 167 §§167.501–503 (LA/Long Beach TSS); simplified San Pedro Channel / Catalina fairways',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Southern approach — northbound lane', kind: 'lane', dir: 'NB' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.15, 33.591667],
          [-118.038333, 33.333333]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Southern approach — southbound lane', kind: 'lane', dir: 'SB' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.233333, 33.591667],
          [-118.1125, 33.311667]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Southern approach — separation zone', kind: 'separation' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.171667, 33.591667],
          [-118.2125, 33.591667],
          [-118.058333, 33.328333],
          [-118.093333, 33.316667],
          [-118.171667, 33.591667]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Western approach — northbound lane', kind: 'lane', dir: 'NB' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.293333, 33.645],
          [-118.343333, 33.645],
          [-118.585, 33.763333]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Western approach — southbound lane', kind: 'lane', dir: 'SB' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.293333, 33.591667],
          [-118.3905, 33.591667],
          [-118.625, 33.705]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Western approach — separation zone', kind: 'separation' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.293333, 33.628333],
          [-118.293333, 33.608333],
          [-118.385, 33.608333],
          [-118.615, 33.72],
          [-118.595, 33.748333],
          [-118.348333, 33.628333],
          [-118.293333, 33.628333]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'LA/LB precautionary area boundary', kind: 'separation' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.293333, 33.705],
          [-118.293333, 33.591667],
          [-118.15, 33.591667],
          [-118.108333, 33.628333],
          [-118.18, 33.723333],
          [-118.293333, 33.705]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'San Pedro Channel fairway', kind: 'fairway' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.28, 33.705],
          [-118.315, 33.62],
          [-118.335, 33.55],
          [-118.345, 33.48],
          [-118.355, 33.4],
          [-118.38, 33.32]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Catalina south bypass (deep draft)', kind: 'fairway' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.625, 33.705],
          [-118.655, 33.55],
          [-118.685, 33.38],
          [-118.715, 33.22],
          [-118.745, 33.05]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Santa Monica Bay coastwise track', kind: 'fairway' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.585, 33.763333],
          [-118.52, 33.82],
          [-118.48, 33.88],
          [-118.45, 33.94]
        ]
      }
    }
  ]
};
