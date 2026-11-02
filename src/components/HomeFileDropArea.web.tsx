import React, { useEffect, useRef, useState } from 'react';

import type { HomeFileDropAreaProps } from './HomeFileDropArea';

/** Browser-only selection adapter. Validation and processing stay in the existing flow. */
export function HomeFileDropArea({ children, disabled, onDropAssets }: HomeFileDropAreaProps) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => {
    // The web uploader retains the File Blob, not this preview/validation URI.
    objectUrls.current.forEach((uri) => URL.revokeObjectURL(uri));
  }, []);

  return <div
    role="group"
    aria-label="Study material file selection. Drop files here or use Choose Files."
    aria-disabled={disabled}
    style={{ minWidth: 0 }}
    onDragEnter={(event) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      depth.current += 1;
      if (!disabled) setDragging(true);
    }}
    onDragOver={(event) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    }}
    onDragLeave={(event) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDragging(false);
    }}
    onDrop={(event) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer.files);
      if (!files.length) return;
      const assets = files.map((file) => {
        const uri = URL.createObjectURL(file);
        objectUrls.current.push(uri);
        return { name: file.name, uri, mimeType: file.type, size: file.size, file };
      });
      if (!onDropAssets(assets)) {
        assets.forEach((asset) => URL.revokeObjectURL(asset.uri));
        objectUrls.current = objectUrls.current.filter((uri) => !assets.some((asset) => asset.uri === uri));
      }
    }}
  >{children(dragging)}</div>;
}
