import { SimplePDF } from "../types";

declare global {
  interface Window {
    simplePDF?: SimplePDF;
  }
}

export {};
