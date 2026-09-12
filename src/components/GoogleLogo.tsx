import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Proportional Google "G" mark. Using vector paths keeps the four-color
 * geometry crisp and prevents the uneven joins produced by CSS border arcs
 * at the small provider-button size.
 */
export function GoogleLogo({ size = 22 }: { size?: number }) {
  const tileSize = size + 12;
  return (
    <View style={[styles.tile, { width: tileSize, height: tileSize, borderRadius: tileSize * 0.28 }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Google">
        <Path fill="#4285F4" d="M21.35 12.18c0-.72-.06-1.42-.18-2.09H12v3.95h5.21a4.45 4.45 0 0 1-1.93 2.92v2.42h3.13c1.83-1.69 2.94-4.18 2.94-7.2z" />
        <Path fill="#34A853" d="M12 21.5c2.61 0 4.8-.86 6.4-2.32l-3.13-2.42c-.87.58-1.98.92-3.27.92-2.51 0-4.63-1.69-5.39-3.96H3.37v2.5A9.66 9.66 0 0 0 12 21.5z" />
        <Path fill="#FBBC05" d="M6.61 13.72A5.79 5.79 0 0 1 6.3 12c0-.6.11-1.18.31-1.72V7.78H3.37A9.69 9.69 0 0 0 2.5 12c0 1.56.37 3.03.87 4.22l3.24-2.5z" />
        <Path fill="#EA4335" d="M12 6.32c1.42 0 2.7.49 3.71 1.45l2.78-2.78C16.8 3.46 14.61 2.5 12 2.5a9.66 9.66 0 0 0-8.63 5.28l3.24 2.5C7.37 8.01 9.49 6.32 12 6.32z" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8ECF2',
    shadowColor: '#1F2A44',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
