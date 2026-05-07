import type { JSX } from 'react';

import { Canvas } from '@/canvas/Canvas';
import { ChatPanel } from '@/panels/ChatPanel';
import { PropertiesPanel } from '@/panels/PropertiesPanel';
import { Toolbar } from '@/panels/Toolbar';
import { useUiStore } from '@/state/ui/uiStore';

export function App(): JSX.Element {
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-neutral-900 antialiased">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1 overflow-hidden">
          <Canvas />
        </div>
        {selectedNodeId !== null ? <PropertiesPanel nodeId={selectedNodeId} /> : null}
      </div>
      <ChatPanel />
    </div>
  );
}
