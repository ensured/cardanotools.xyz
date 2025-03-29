import L from 'leaflet'

let icon: L.Icon

if (typeof window !== 'undefined') {
  icon = L.icon({
    iconUrl: '/marker-icon.png',
    shadowUrl: '/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    shadowAnchor: [20, 41],
    className: 'leaflet-marker-icon',
    tooltipAnchor: [0, -41],
  })

  // Set the default icon for all markers
  L.Marker.prototype.options.icon = icon
}

export { icon }
