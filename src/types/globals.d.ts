// Hermes (RN 0.74+) ships btoa/atob, but @react-native/typescript-config has no DOM lib to type them.
declare function btoa(data: string): string;
declare function atob(data: string): string;
