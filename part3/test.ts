import { parseL4 } from "./L4-ast";
import { bind, isOk } from "../shared/result";
import { evalNormalProgram } from "./L4-normal";
import { L4toMermaid } from "../part2/mermaid";

const prog = `(L4 (define f (lambda (x) (* x x))) (f 3))`;
// const tree = L4toMermaid(prog);
// console.log(isOk(tree) ? tree.value : tree.message);
bind(parseL4(prog), evalNormalProgram)