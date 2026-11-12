/**
 * Test suite for Rasta Central Navigation State Machine and Engine
 */
import { NavigationEngine } from './navigationEngine';
import { RouteOption } from '../types';

console.log('Running Rasta Navigation Engine & State Machine Tests...');

const mockRoute: RouteOption = {
  id: 'test_route_1',
  title: 'Test Canal Route',
  titleUrdu: 'ٹیسٹ کینال روٹ',
  via: 'Via Canal Bank',
  viaUrdu: 'کینال روڈ',
  distanceKm: 5.0,
  durationMinutes: 12,
  trafficStatus: 'normal',
  hasTolls: false,
  isRecommended: true,
  steps: [
    {
      instruction: 'Head north on Main Blvd',
      instructionUrdu: 'مین بلیوارڈ پر شمال کی طرف جائیں',
      distanceMeters: 2000,
      durationSeconds: 300,
      maneuver: 'straight'
    },
    {
      instruction: 'Arrive at destination',
      instructionUrdu: 'منزل پر پہنچیں',
      distanceMeters: 3000,
      durationSeconds: 420,
      maneuver: 'arrive'
    }
  ],
  pathCoordinates: [
    { lat: 31.520, lng: 74.358 },
    { lat: 31.525, lng: 74.358 },
    { lat: 31.530, lng: 74.358 },
    { lat: 31.535, lng: 74.358 }
  ]
};

const engine = new NavigationEngine();
let lastEvent: any = null;

engine.subscribe((event) => {
  lastEvent = event;
});

// Test 1: Initial state is IDLE
console.assert(lastEvent.state === 'IDLE', 'Test 1 Failed: Initial state should be IDLE');
console.log('✓ Test 1 Passed: Initial navigation state is IDLE');

// Test 2: Start navigation transition
engine.startNavigation(mockRoute, {
  id: 'dest_1',
  name: 'Test Destination',
  nameUrdu: 'ٹیسٹ منزل',
  category: 'hub',
  lat: 31.535,
  lng: 74.358
});
console.assert(lastEvent.state === 'NAVIGATING', 'Test 2 Failed: State should be NAVIGATING');
console.assert(lastEvent.activeRoute?.id === 'test_route_1', 'Test 2 Failed: Active route should be set');
console.log('✓ Test 2 Passed: Start navigation transition verified');

// Test 3: Simulated GPS drift / on-route progression
engine.processPositionUpdate({ lat: 31.525, lng: 74.358 });
console.assert(lastEvent.state === 'NAVIGATING', 'Test 3 Failed: On-route position should keep NAVIGATING state');
console.log('✓ Test 3 Passed: On-route GPS position processing verified');

// Test 4: Off-route detection (requires 3 consecutive off-route updates to prevent false positives from GPS drift)
const offRoutePt = { lat: 31.525, lng: 74.375 }; // far east (>65m)
engine.processPositionUpdate(offRoutePt);
engine.processPositionUpdate(offRoutePt);
console.assert(lastEvent.state === 'NAVIGATING', 'Test 4 Failed: 2 off-route updates should not trigger OFF_ROUTE yet');

engine.processPositionUpdate(offRoutePt);
console.assert(lastEvent.state === 'OFF_ROUTE' || lastEvent.state === 'REROUTING', 'Test 4 Failed: 3rd off-route update should trigger OFF_ROUTE / REROUTING');
console.log('✓ Test 4 Passed: Off-route detection & debounced rerouting verified');

// Test 5: Route completion detection
setTimeout(() => {
  engine.processPositionUpdate({ lat: 31.535, lng: 74.358 }); // Final destination point
  console.assert(lastEvent.state === 'ARRIVED', 'Test 5 Failed: Reaching destination should transition to ARRIVED');
  console.log('✓ Test 5 Passed: Route completion detection verified');
  console.log('All Rasta Navigation Engine Tests Completed Successfully!');
}, 1300);
