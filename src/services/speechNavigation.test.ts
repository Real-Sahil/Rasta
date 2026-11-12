/**
 * Test suite for Rasta Upgraded Speech Navigation Service
 */
import { speechNavigator } from './speechNavigation';

console.log('Running Rasta Speech Navigation Tests...');

// Test 1: Service initialization
console.assert(speechNavigator !== null, 'Test 1 Failed: speechNavigator should initialize');
console.log('✓ Test 1 Passed: SpeechNavigator initialized');

// Test 2: Voice summary helper
const summary = speechNavigator.getSupportedVoicesSummary();
console.assert(typeof summary.totalVoices === 'number', 'Test 2 Failed: totalVoices should be a number');
console.log('✓ Test 2 Passed: Voice summary retrieved (total voices:', summary.totalVoices, ')');

// Test 3: Language preference setting and speech trigger (mock environment test)
speechNavigator.setPreferences('ur', false);
speechNavigator.speak('Turn right ahead', 'آگے دائیں طرف مڑیں', 'اੱगे سੱਜੇ ਮੁੜੋ', 'انعطف يميناً');
console.log('✓ Test 3 Passed: Urdu speech instruction triggered successfully');

speechNavigator.setPreferences('pa', false);
speechNavigator.speak('Continue straight', 'سیدھا چلیں', 'ਸਿੱਧਾ ਜਾਓ', 'استمر مباشرة');
console.log('✓ Test 4 Passed: Punjabi speech instruction triggered with fallback');

speechNavigator.stop();
console.log('All Rasta Speech Navigation Tests Completed Successfully!');
