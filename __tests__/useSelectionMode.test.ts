import { renderHook, act } from '@testing-library/react-native';
import { useSelectionMode } from '../lib/useSelectionMode';

describe('useSelectionMode', () => {
  it('starts with selectionMode=false and empty selectedIds', () => {
    const { result } = renderHook(() => useSelectionMode());
    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('enter() sets selectionMode=true', () => {
    const { result } = renderHook(() => useSelectionMode());
    act(() => { result.current.enter(); });
    expect(result.current.selectionMode).toBe(true);
  });

  it('exit() clears selectionMode and selectedIds', () => {
    const { result } = renderHook(() => useSelectionMode());
    act(() => { result.current.enter(); });
    act(() => { result.current.toggle('id-1'); });
    act(() => { result.current.exit(); });
    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggle(id) adds id to selectedIds', () => {
    const { result } = renderHook(() => useSelectionMode());
    act(() => { result.current.toggle('id-1'); });
    expect(result.current.selectedIds.has('id-1')).toBe(true);
  });

  it('toggle(id) a second time removes id from selectedIds', () => {
    const { result } = renderHook(() => useSelectionMode());
    act(() => { result.current.toggle('id-1'); });
    act(() => { result.current.toggle('id-1'); });
    expect(result.current.selectedIds.has('id-1')).toBe(false);
  });

  it('canStack is false with 1 selected, true with 2+', () => {
    const { result } = renderHook(() => useSelectionMode());
    expect(result.current.canStack).toBe(false);
    act(() => { result.current.toggle('id-1'); });
    expect(result.current.canStack).toBe(false);
    act(() => { result.current.toggle('id-2'); });
    expect(result.current.canStack).toBe(true);
  });
});
