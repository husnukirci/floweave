import type { JSX } from 'react';

import { Canvas } from '@/canvas/Canvas';
import { ChatPanel } from '@/panels/ChatPanel';
import { PropertiesPanel } from '@/panels/PropertiesPanel';
import { Toolbar } from '@/panels/Toolbar';
import { useUiStore } from '@/state/StoresProvider';

export function App(): JSX.Element {
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const chatOpen = useUiStore((s) => s.panels.chat);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-neutral-900 antialiased">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1 overflow-hidden">
          <Canvas />
        </div>
        {selectedNodeId !== null ? <PropertiesPanel nodeId={selectedNodeId} /> : null}
      </div>
      {chatOpen ? <ChatPanel /> : null}
    </div>
  );
}
