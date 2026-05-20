// Shared geometry for the node card and the edges that attach to it.
//
// Node, Edge, and GhostEdge all need to agree on the rendered size of a
// node so connection points line up with the handle dots. Defining the
// metrics in one place — and locking the Node element to exactly these
// dimensions — guarantees the SVG endpoints land on the visible dots
// instead of drifting when the rendered size doesn't match a hardcoded
// constant.

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 60;
