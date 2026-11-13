import { describe, it, expect } from 'vitest';
import { credibilityFor, rowToIncident, incidentToBody, IncidentRow } from './incidentsApi';

const row: IncidentRow = {
  id: 'i1', category: 'flooding', title: 'Water on road', title_ur: null, description: 'Knee deep', description_ur: null,
  location_name: 'Mall Rd', advice: null, lat: 31.5, lng: 74.3, created_at: '2026-11-13T10:00:00Z',
  expires_at: '2026-11-13T12:00:00Z', confirmations: 3, mine: false, confirmed: false
};

describe('incidentsApi mapping', () => {
  it('derives credibility from confirmations only, capped at 95', () => {
    expect(credibilityFor(0)).toBe(50);
    expect(credibilityFor(3)).toBe(65);
    expect(credibilityFor(1000)).toBe(95);
    expect(credibilityFor(-4)).toBe(50);
  });
  it('maps a row without inventing verification or Urdu text', () => {
    const i = rowToIncident(row);
    expect(i.isOfficialVerified).toBe(false);
    expect(i.source).toBe('Citizen_Report');
    expect(i.upvotes).toBe(3);
    expect(i.userConfirmed).toBe(false);
    expect(i.titleUrdu).toBe('Water on road');
    expect(i.timestamp).toBe(Date.parse('2026-11-13T10:00:00Z'));
  });
  it('marks own and already-confirmed reports as confirmed', () => {
    expect(rowToIncident({ ...row, mine: true }).userConfirmed).toBe(true);
    expect(rowToIncident({ ...row, confirmed: true }).userConfirmed).toBe(true);
  });
  it('trims, nulls empty fields and drops duplicate Urdu in the request body', () => {
    const b = incidentToBody({ category: 'hazard', title: '  Pothole ', titleUrdu: 'Pothole', description: '', descriptionUrdu: '', locationName: ' ', lat: 31, lng: 74 });
    expect(b).toMatchObject({ title: 'Pothole', title_ur: null, description: null, location_name: null });
  });
});
