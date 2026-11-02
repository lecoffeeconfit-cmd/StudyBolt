import React from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { ImportAsset } from '../models';

export interface HomeFileDropAreaProps {
  disabled: boolean;
  onDropAssets: (assets: ImportAsset[]) => boolean;
  children: (dragging: boolean) => ReactNode;
}

export function HomeFileDropArea({ children }: HomeFileDropAreaProps) {
  return <View>{children(false)}</View>;
}
