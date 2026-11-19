import { describe, expect, it } from 'vitest';
import { inPakistan, outsidePakistan } from './coverage';

// Same cities as mobile/test/saved_places_test.dart.
const inside: Record<string, [number, number]> = {
      "Lahore": [31.5204, 74.3587], "Karachi": [24.8607, 67.0011], "Islamabad": [33.6844, 73.0479],
      "Peshawar": [34.0151, 71.5249], "Quetta": [30.1798, 66.9750], "Gwadar": [25.1264, 62.3225],
      "Gilgit": [35.9208, 74.3089], "Skardu": [35.2971, 75.6333], "Chaman": [30.9210, 66.4597],
      "Sialkot": [32.4945, 74.5229], "Muzaffarabad": [34.3700, 73.4711], "Rahim Yar Khan": [28.4202, 70.2952],
      "Mirpur Khas": [25.5251, 69.0159], "Zhob": [31.3417, 69.4486], "Taftan": [28.9636, 61.5958], "Jiwani": [25.0480, 61.7440],
      "Chitral": [35.8518, 71.7864], "Sost": [36.6930, 74.8170], "Kasur": [31.1187, 74.4502],
    };
const outside: Record<string, [number, number]> = {
      "Derby": [52.9225, -1.4746], "Delhi": [28.6139, 77.2090], "Kabul": [34.5553, 69.2075],
      "Kandahar": [31.6289, 65.7372], "Jaisalmer": [26.9157, 70.9083], "Dubai": [25.2048, 55.2708],
    };

describe('inPakistan', () => {
  for (const [n, [lat, lng]] of Object.entries(inside)) it(`${n} is inside`, () => expect(inPakistan(lat, lng)).toBe(true));
  for (const [n, [lat, lng]] of Object.entries(outside)) it(`${n} is outside`, () => expect(inPakistan(lat, lng)).toBe(false));
  it('no fix means no notice', () => expect(outsidePakistan(null)).toBe(false));
});
