import { unparseMermaid, L4toMermaid } from "./mermaid";
import { isOk } from "../shared/result";

const l4exp = '(define x 3)';
const tree = L4toMermaid(l4exp);
console.log(isOk(tree) ? tree.value : "not okay");