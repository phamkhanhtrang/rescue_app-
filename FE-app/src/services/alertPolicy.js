export function isEmergencyAlert(alert) {
  if (alert.message_type) return alert.message_type === 'EMERGENCY';
  return ['EMERGENCY', 'CRITICAL', 'HIGH'].includes((alert.severity || '').toUpperCase()) || alert.category === 'emergency';
}

export function activeAlerts(alerts, now = Date.now()) {
  return alerts.filter(alert => alert.is_active && (!alert.expires_at || Date.parse(alert.expires_at) > now));
}

let currentLocation = null;
export function setAlertLocation(location) { currentLocation = location ? { ...location, at: Date.now() } : null; }
export function alertLocationParams() {
  return currentLocation && Date.now() - currentLocation.at < 15 * 60 * 1000
    ? { lat: currentLocation.lat, lng: currentLocation.lng } : {};
}
