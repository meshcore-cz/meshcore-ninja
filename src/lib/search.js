import { writable } from 'svelte/store';

/** Whether the global (Cmd+K) command palette is open. Shared so any page can
 *  open the palette the layout renders. */
export const searchOpen = writable(false);
