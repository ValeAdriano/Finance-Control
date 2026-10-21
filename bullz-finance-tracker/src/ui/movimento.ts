/* "Reduzir movimento" do sistema: quem liga não vê números contando nem
 * arcos enchendo; o valor aparece direto. */
import { AccessibilityInfo } from "react-native";

let reduz = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduz = !!v; }).catch(() => {});
try { AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => { reduz = !!v; }); } catch { /* web antigo */ }

export const reduzMovimento = (): boolean => reduz;
