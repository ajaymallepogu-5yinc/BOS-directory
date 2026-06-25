import { createContext, useContext } from "react";

interface TreeContextType {
  expandedNodeIds: Set<number>;
  toggleExpand: (nodeId: number, siblingIds: number[]) => void;
  selectedNodeId: number | null;
  setSelectedNodeId: (id: number | null) => void;
  layoutMode: "horizontal" | "vertical";
}

export const TreeContext = createContext<TreeContextType | null>(null);

export function useTreeContext() {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error("useTreeContext must be used within a TreeProvider");
  }
  return context;
}
