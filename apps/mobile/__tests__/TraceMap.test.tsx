import React from 'react';
import { render } from '@testing-library/react-native';
// Jest résout la variante .native, comme Metro sur Android ; MapLibre est bouchonné (jest.setup.js).
import { TraceMap } from '../src/components/TraceMap';

const FALLBACK = { width: 340, height: 190, padding: 16 };
const trace = [
  { lat: 45.0, lon: 5.0 },
  { lat: 45.001, lon: 5.001 },
  { lat: 45.002, lon: 5.0015 },
];

describe('TraceMap', () => {
  it('affiche la trace sur fond de carte, avec la mention exigée par la licence OpenStreetMap', () => {
    const { queryByTestId, queryAllByTestId, getByText } = render(<TraceMap points={trace} mapEnabled fallback={FALLBACK} />);
    expect(queryByTestId('MapView')).not.toBeNull();
    expect(queryAllByTestId('LineLayer')).toHaveLength(2); // liseré + trace
    expect(getByText(/OpenStreetMap/)).toBeTruthy();
  });

  it('fond de carte désactivé : aucune carte (donc aucune tuile demandée), la trace reste dessinée', () => {
    const { queryByTestId } = render(<TraceMap points={trace} mapEnabled={false} fallback={FALLBACK} />);
    expect(queryByTestId('MapView')).toBeNull();
    expect(queryByTestId('Path')).not.toBeNull();
  });

  it("sans aucun point (GPS pas encore calé), n'ouvre pas de carte", () => {
    const { queryByTestId } = render(<TraceMap points={[]} mapEnabled fallback={FALLBACK} />);
    expect(queryByTestId('MapView')).toBeNull();
  });

  it('en direct, marque la position courante ; en résumé, non', () => {
    const live = render(<TraceMap points={trace} follow mapEnabled fallback={FALLBACK} />);
    expect(live.queryByTestId('CircleLayer')).not.toBeNull();
    live.unmount();

    const summary = render(<TraceMap points={trace} mapEnabled fallback={FALLBACK} />);
    expect(summary.queryByTestId('CircleLayer')).toBeNull();
  });
});
