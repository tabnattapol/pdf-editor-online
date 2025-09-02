declare module 'opentype.js' {
  export interface Font {
    // Add font methods as needed
    getPath(text: string, x: number, y: number, fontSize: number): any;
    stringToGlyphs(text: string): any[];
    // Add other properties as needed
  }
  
  export function load(url: string, callback: (err: any, font?: Font) => void): void;
  export function loadSync(url: string): Font;
  export function parse(buffer: ArrayBuffer): Font;
}