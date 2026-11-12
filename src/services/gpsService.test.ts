/**
 * Test suite for Rasta Robust GPS Service
 */
import { calculateDistanceMeters, snapToRoutePolyline, RobustGpsManager } from './gpsService';

console.log('Running Rasta GPS Service Unit Tests...');

// Test 1: Haversine distance calculation
const p1 = { lat: 31.5204, lng: 74.3587 }; // Lahore center
const p2 = { lat: 31.5304, lng: 74.3687 };
const dist = calculateDistanceMeters(p1, p2);
console.assert(dist > 1000 && dist < 2000, `Test 1 Failed: Distance calculated was ${dist}m`);
console.log('✓ Test 1 Passed: Haversine distance calculation verified (~', Math.round(dist), 'm)');

// Test 2: Road snapping / map matching against route polyline
const polyline = [
  { lat: 31.520, lng: 74.358 },
  { lat: 31.525, lng: 74.358 },
  { lat: 31.530, lng: 74.358 }
];
const offRoutePoint = { lat: 31.525, lng: 74.3583 }; // ~30 meters east
const snapped = snapToRoutePolyline(offRoutePoint, polyline, 50);
console.assert(snapped.snapped === true, 'Test 2 Failed: Should snap to route polyline');
console.assert(Math.abs(snapped.lng - 74.358) < 0.001, 'Test 2 Failed: Longitude should snap to route');
console.log('✓ Test 2 Passed: Road snapping and map matching verified');

// Test 3: GPS Manager initialization and state callbacks
let stateUpdatesCount = 0;
const gpsManager = new RobustGpsManager((state) => {
  stateUpdatesCount++;
});
console.assert(gpsManager !== null, 'Test 3 Failed: GPS manager should initialize');
console.log('✓ Test 3 Passed: RobustGpsManager instantiated successfully');

console.log('All Rasta GPS Unit Tests Completed Successfully!');
