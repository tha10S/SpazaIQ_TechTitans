import { Platform } from 'react-native';

// One setting for every form in the app.
//
// 'padding' shrinks the form by the height of the keyboard, so every field can be scrolled into
// view. Android needs it too: since Expo SDK 54 the app draws edge to edge, and the keyboard no
// longer resizes the window by itself, which is why fields at the bottom ended up hidden under it.
// On web there is no on-screen keyboard to avoid.
export const KEYBOARD_BEHAVIOR = Platform.OS === 'web' ? undefined : 'padding';
