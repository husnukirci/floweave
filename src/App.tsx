import type { JSX } from 'react';

import { Canvas } from '@/canvas/Canvas';

export function App(): JSX.Element {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-neutral-900 antialiased">
      <Canvas />
    </div>
  );
}
