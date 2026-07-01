import type { Node, Edge } from "@xyflow/react";
import type { OrgTreeNode } from "../api/types";

export interface TreeLayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function getLayoutedElements(
  roots: OrgTreeNode[],
  expandedNodes: Set<number>,
  direction: "TB" | "LR" = "TB"
): TreeLayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let leafIndex = 0;

  // Horizontal/Vertical spacings
  
  const horizontalSpacing = direction === "TB" ? 300 : 340;
  const verticalSpacing = direction === "TB" ? 180 : 130;

  function traverse(
    node: OrgTreeNode,
    depth: number,
    parentId: string | null
  ): { x: number; y: number } {
    const nodeId = String(node.id);
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    let x = 0;
    let y = 0;

    if (!hasChildren || !isExpanded) {
      // Leaf or collapsed node acts as a leaf in the layout grid
      if (direction === "TB") {
        x = leafIndex * horizontalSpacing;
        y = depth * verticalSpacing;
      } else {
        x = depth * horizontalSpacing;
        y = leafIndex * verticalSpacing;
      }
      leafIndex++;
    } else {
      // Traverse all children first
      const childPositions: { x: number; y: number }[] = [];
      for (const child of node.children) {
        const childPos = traverse(child, depth + 1, nodeId);
        childPositions.push(childPos);
      }

      // Center this parent node over its direct children
      if (direction === "TB") {
        const minX = childPositions[0].x;
        const maxX = childPositions[childPositions.length - 1].x;
        x = (minX + maxX) / 2;
        y = depth * verticalSpacing;
      } else {
        const minY = childPositions[0].y;
        const maxY = childPositions[childPositions.length - 1].y;
        x = depth * horizontalSpacing;
        y = (minY + maxY) / 2;
      }
    }

    // Add node
    nodes.push({
      id: nodeId,
      type: "employeeNode",
      position: { x, y },
      data: {
        employee: {
          id: node.id,
          fullName: node.fullName,
          title: node.title,
          company: node.company,
          avatarUrl: node.avatarUrl,
          department: node.department,
          departmentColor: node.departmentColor,
          totalReportCount: node.totalReportCount,
          children: node.children
        },
        direction,
        isExpanded,
        hasChildren
      }
    });

    // Add edge
    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "default",
        style: {
          stroke: "#94A3B8",
          strokeWidth: 2,
        },
      });
    }

    return { x, y };
  }

  // Layout each root
  for (const root of roots) {
    traverse(root, 0, null);
  }

  return { nodes, edges };
}
