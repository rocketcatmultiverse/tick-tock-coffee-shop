// The tool bar (docs/QUESTIONS.md, Q71): every editing key as a button, for a
// finger or a mouse, showing what fits the hand.

import { describe, expect, it } from 'vitest';
import { TOOLS, type ToolId, toolsFor } from '../../src/ui/tools';

describe('The tool bar', () => {
  it('an empty hand: select, delete, cut, copy and paste, then undo and redo', () => {
    expect(toolsFor({ hand: 'none', buffer: 3 })).toEqual(['select', 'delete', 'cut', 'copy', 'paste', 'undo', 'redo']);
  });

  it('holding a piece: turn, flip, put down and its rules', () => {
    expect(toolsFor({ hand: 'piece', buffer: 0 })).toEqual(['turn', 'flip', 'drop', 'info', 'undo', 'redo']);
  });

  it('holding a group: older and newer only when the buffer has more than one entry', () => {
    expect(toolsFor({ hand: 'group', buffer: 1 })).toEqual(['turn', 'flip', 'drop', 'undo', 'redo']);
    expect(toolsFor({ hand: 'group', buffer: 2 })).toEqual(['turn', 'flip', 'drop', 'older', 'newer', 'undo', 'redo']);
  });

  it('never more than seven at once, so they fit across a phone', () => {
    for (const hand of ['none', 'piece', 'group'] as const) {
      for (const buffer of [0, 1, 10]) expect(toolsFor({ hand, buffer }).length).toBeLessThanOrEqual(7);
    }
  });

  it('every editing key in the spec has its tool, named with its key', () => {
    const keys: [ToolId, string][] = [
      ['turn', 'R'],
      ['flip', 'F'],
      ['delete', 'Z'],
      ['cut', 'X'],
      ['copy', 'C'],
      ['paste', 'Ctrl+V'],
      ['undo', 'Ctrl+Z'],
      ['redo', 'Ctrl+Y'],
      ['select', 'Shift+drag'],
      ['older', 'Ctrl+wheel'],
    ];
    for (const [id, key] of keys) expect(TOOLS[id].key, id).toBe(key);
    for (const [id, t] of Object.entries(TOOLS)) {
      expect(t.line.length, id).toBeGreaterThan(0);
      // A finger's words never send it to a key.
      expect(t.touchLine ?? t.line, id).not.toMatch(/\b(cursor|click|hover)\b/i);
    }
  });
});
