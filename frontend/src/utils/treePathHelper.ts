import type { OrgTreeNode } from "../api/types";

// Find the path of nodes from the root to the target employee ID
export function findEmployeePath(
  nodes: OrgTreeNode[],
  targetId: number,
  currentPath: OrgTreeNode[] = []
): OrgTreeNode[] | null {
  for (const node of nodes) {
    const path = [...currentPath, node];
    if (node.id === targetId) {
      return path;
    }
    if (node.children && node.children.length > 0) {
      const childPath = findEmployeePath(node.children, targetId, path);
      if (childPath) return childPath;
    }
  }
  return null;
}

// Find a specific employee node by ID in the tree
export function findEmployeeById(nodes: OrgTreeNode[], id: number): OrgTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      const found = findEmployeeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Flatten all nodes in the tree into a single array (useful for search)
export function flattenTree(nodes: OrgTreeNode[]): OrgTreeNode[] {
  const result: OrgTreeNode[] = [];
  function traverse(node: OrgTreeNode) {
    result.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  nodes.forEach(traverse);
  return result;
}
