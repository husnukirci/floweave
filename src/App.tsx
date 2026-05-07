import type { JSX } from 'react';

import { Canvas } from '@/canvas/Canvas';
import { Toolbar } from '@/panels/Toolbar';

export function App(): JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-neutral-900 antialiased">
      <Toolbar />
      <div className="relative flex-1 overflow-hidden">
        <Canvas />
      </div>
    </div>
  );
}
