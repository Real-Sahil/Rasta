import { describe, it, expect } from 'vitest';
import { credibilityFor, rowToIncident, incidentToInsert, IncidentRow } from './incidentsApi';

const row: IncidentRow = {
  id: 'i1', created_by: 'u1', category: 'flooding', title: 'Water on road', title_ur: null, description: 'Knee deep',
  description_ur: null, location_name: 'Mall Rd', advice: null, lat: 31.5, lng: 74.3,
  created_at: '2026-11-13T10:00:00Z', expires_at: '2026-11-13T12:00:00Z', confirmations: 3
};

describe('incidentsApi mapping', () => {
  it('derives credibility from confirmations only, capped at 95', () => {
    expect(credibilityFor(0)).toBe(50);
    expect(credibilityFor(3)).toBe(65);
    expect(credibilityFor(1000)).toBe(95);
    expect(credibilityFor(-4)).toBe(50);
  });
  it('maps a row without inventing verification or Urdu text', () => {
    const i = rowToIncident(row, new Set(), 'someone-else');
    expect(i.isOfficialVerified).toBe(false);
    expect(i.source).toBe('Citizen_Report');
    expect(i.upvotes).toBe(3);
    expect(i.userConfirmed).toBe(false);
    expect(i.timestamp).toBe(Date.parse('2026-11-13T10:00:00Z'));
  });
  it('marks own and already-confirmed reports as confirmed', () => {
    expect(rowToIncident(row, new Set(), 'u1').userConfirmed).toBe(true);
    expect(rowToIncident(row, new Set(['i1']), null).userConfirmed).toBe(true);
  });
  it('trims, nulls empty fields and drops duplicate Urdu on insert', () => {
    const ins = incidentToInsert({ category: 'hazard', title: '  Pothole ', titleUrdu: 'Pothole', description: '', descriptionUrdu: '', locationName: ' ', lat: 31, lng: 74 });
    expect(ins.title).toBe('Pothole');
    expect(ins.title_ur).toBeNull();
    expect(ins.description).toBeNull();
    expect(ins.location_name).toBeNull();
  });
});
