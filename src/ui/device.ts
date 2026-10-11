// What the player plays with. The words for the controls follow the main
// pointer: a phone or a tablet reads "tap", a computer reads "click" and names
// its keys. The controls themselves take mouse and touch on any device.

/** Whether the main pointer is a finger. False where there is no window, as in the tests. */
export function touchFirst(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}
