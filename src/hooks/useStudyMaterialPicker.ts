import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState } from 'react';

import type { ImportAsset } from '../models';
import { DOCUMENT_PICKER_TYPE } from '../services/documentTypes';
import { StudyBoltProcessingError, validateImportBatch } from '../services/documentProcessor';

/** Shared selection UI; processing, authentication and plan limits stay in the existing flow. */
export function useStudyMaterialPicker(onImport: (assets: ImportAsset[]) => void) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const acceptAssets = (assets: ImportAsset[]) => {
    setError(null);
    try {
      validateImportBatch(assets);
      onImport(assets);
      return true;
    } catch (reason) {
      setError(reason instanceof StudyBoltProcessingError ? reason.userMessage : 'These files could not be opened. Please choose them again.');
      return false;
    }
  };

  const chooseFiles = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_PICKER_TYPE,
        copyToCacheDirectory: true,
        multiple: true,
        base64: false,
      });
      if (result.canceled || !mounted.current) return;
      acceptAssets(result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size, file: asset.file })));
    } catch {
      if (mounted.current) setError('Couldn’t open files. Check file permissions, then choose files again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setOpening(false);
    }
  };

  return { opening, error, chooseFiles, acceptAssets, isOpening: () => inFlight.current };
}
