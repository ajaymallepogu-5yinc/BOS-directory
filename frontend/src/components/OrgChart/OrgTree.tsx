import { useState, useRef, useEffect, type MouseEvent } from "react";
import type { OrgTreeNode } from "../../api/types";
import TreeNode from "./TreeNode";

interface Props {
  roots: OrgTreeNode[];
  searchTerm?: string;
}

export default function OrgTree({ roots, searchTerm }: Props) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelRaw = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.08;
      const direction = e.deltaY < 0 ? 1 : -1;
      
      setScale((s) => {
        const newScale = s + direction * zoomFactor * s;
        return Math.max(0.15, Math.min(newScale, 3.0));
      });
    };

    container.addEventListener("wheel", handleWheelRaw, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheelRaw);
    };
  }, []);

  if (roots.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-ink-400">
        <p className="font-display text-sm font-semibold text-ink-600">Nothing to show here yet</p>
        <p className="mt-1 text-xs">Add an employee in this department, or pick a different one.</p>
      </div>
    );
  }

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    
    // Don't drag if clicking buttons or input elements
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) {
      return;
    }
    
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.15, 3.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.15, 0.15));
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-ink-50/10">
      {/* Zoom HUD */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1.5 shadow-lg">
        <button
          onClick={zoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-ink-100 text-ink-600 transition-colors text-sm font-bold"
          title="Zoom Out"
        >
          −
        </button>
        <span className="text-[10px] font-semibold text-ink-500 min-w-[36px] text-center font-mono">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-ink-100 text-ink-600 transition-colors text-sm font-bold"
          title="Zoom In"
        >
          +
        </button>
        <div className="h-4 w-[1px] bg-ink-200 mx-1" />
        <button
          onClick={resetZoom}
          className="px-2.5 py-1 text-[10px] font-semibold text-brand bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
          title="Reset Zoom"
        >
          Reset
        </button>
      </div>

      {/* Interactive canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`h-full w-full overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="flex h-full w-full items-center justify-center"
        >
          <div className="flex min-w-fit justify-center gap-16 p-20">
            {roots.map((root) => (
              <TreeNode key={root.id} node={root} searchTerm={searchTerm} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
