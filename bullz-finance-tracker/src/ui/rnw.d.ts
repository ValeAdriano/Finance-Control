/* props que só o react-native-web entende (no nativo são ignoradas) */
import "react-native";

declare module "react-native" {
  interface ViewProps {
    /** vira data-* no DOM: `dataSet={{ imprimir: "nao" }}` → data-imprimir="nao" */
    dataSet?: Record<string, string>;
  }
}
