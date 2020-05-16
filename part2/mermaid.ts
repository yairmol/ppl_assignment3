import { Exp, VarDecl,AppExp, ProcExp, LetExp, LitExp, Parsed, isAtomicExp, AtomicExp, isNumExp, isBoolExp, isStrExp, isVarRef, isPrimOp, isProcExp, isDefineExp, isIfExp, isLetExp, isLetrecExp, isLitExp, isAppExp, DefineExp, isCompoundExp, CompoundExp, IfExp, isVarDecl, parseL4Exp } from "./L4-ast";
import { Node, Graph, makeGraph, AtomicGraph, makeAtomicGraph, makeNodeDecl, makeEdge, Edge, NodeDecl, makeCompoundGraph, GraphContent, CompoundGraph, NodeRef, makeNodeRef, isNodeDecl, isAtomicGraph, isNodeRef, isCompoundGraph } from "./mermaid-ast";
import { Result, makeOk, bind, makeFailure, safe3, safe2, mapResult } from "../shared/result";
import { parse as p } from "../shared/parser";

export const L4toMermaid = (concrete: string): Result<string> =>
    bind(bind(bind(p(concrete), parseL4Exp), mapL4toMermaid), unparseMermaid);

export const unparseMermaid = (exp: Graph): Result<string> => 
    bind(unparseGraphContent(exp.content), (content: string) => makeOk(`graph ${exp.dir}\n${content}`));

const unparseGraphContent = (content: GraphContent): Result<string> =>
    isAtomicGraph(content) ? unparseNode(content.nodeDecl) :
    isCompoundGraph(content) ? bind(mapResult(unparseEdge ,content.edges), (edges: string[]) => makeOk(edges.join('\n'))) :
    makeFailure("Bad Graph");

const unparseNode = (node: Node): Result<string> => 
    isNodeDecl(node) ? makeOk(`${node.id}[${node.label}]`) :
    isNodeRef(node) ? makeOk(`${node.id}`) :
    makeFailure("Bad Graph");

const unparseEdge = (edge: Edge): Result<string> => 
    edge.label === undefined ? safe2((from: string, to: string) => makeOk(`${from} --> ${to}`))(unparseNode(edge.from), unparseNode(edge.to)) :
    safe2((from: string, to: string) => makeOk(`${from} -->|${edge.label}| ${to}`))(unparseNode(edge.from), unparseNode(edge.to));


export const mapL4toMermaid = (exp: Parsed): Result<Graph> => {
    const idGen = makeIdGen();
    return isAtomicExp(exp) ? bind(L4AtomicToNode(exp, idGen), (node: NodeDecl) => makeOk(makeGraph("TD", makeAtomicGraph(node)))) :
    isCompoundExp(exp) || isDefineExp(exp) ? bind(mapL4toMermaidCompoundExp(exp, makeNodeDecl(idGen(exp.tag), exp.tag), idGen),
        (edges: Edge[]) => makeOk(makeGraph("TD", makeCompoundGraph(edges)))) :
    makeFailure("");

}

const mapL4toMermaidCompoundExp = (exp: CompoundExp | DefineExp, head: Node, idGen: IdGen): Result<Edge[]> =>
    isDefineExp(exp) ? L4DefineToNode(exp, head, idGen) :
    isIfExp(exp) ? L4IfExpToNode(exp, head, idGen) :
    isProcExp(exp) ? L4ProcExpToNode(exp, head, idGen) :
    isAppExp(exp) ? L4AppExpToNode(exp, head, idGen) :
    isLetExp(exp) ? L4LetExpToNode(exp, head, idGen) :
    isLitExp(exp) ? L4LitExpToNode(exp, head, idGen) :
    makeFailure("Bad AST");

const L4AtomicToNode = (exp: AtomicExp | VarDecl, IdGen: IdGen): Result<NodeDecl> => 
    isNumExp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.val})"`)) :
    isBoolExp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.val})"`)) :  
    isStrExp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.val})"`)) :
    isVarRef(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.var})"`)) :
    isPrimOp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.op})"`)) :
    isVarDecl(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.var})"`)) :
    makeFailure("not a valid AtomicExp"); // not suppose to reach here

const L4DefineToNode = (exp: DefineExp, head: Node, idGen: IdGen): Result<Edge[]> => {
    const headRef = isNodeDecl(head) ? declToRef(head) : head;
    if (isAtomicExp(exp.val)) {
        return safe2((varNode: NodeDecl, valNode: NodeDecl): Result<Edge[]> => 
        makeOk([makeEdge(head, varNode, 'var'), makeEdge(headRef, valNode, 'val')]))(L4AtomicToNode(exp.var, idGen), L4AtomicToNode(exp.val, idGen))
    }
    if (isCompoundExp(exp.val)) { 
        const valNodeDecl: NodeDecl = makeNodeDecl(idGen(exp.val.tag), exp.tag);
        safe2((varNode: NodeDecl, valSubGraph: Edge[]): Result<Edge[]> => 
        makeOk([makeEdge(head, varNode, 'var'), makeEdge(headRef, valNodeDecl, 'val')].concat(valSubGraph)))
            (L4AtomicToNode(exp.var, idGen), mapL4toMermaidCompoundExp(exp.val, declToRef(valNodeDecl), idGen));
    }
    return makeFailure("Bad AST");
}

const L4IfExpToNode = (exp: IfExp, head: Node, idGen: IdGen): Result<Edge[]> => makeFailure("not implmented");

const L4ProcExpToNode = (exp: ProcExp, head: Node, idGen: IdGen): Result<Edge[]> => makeFailure("not implmented");

const L4AppExpToNode = (exp: AppExp, head: Node, idGen: IdGen): Result<Edge[]> => makeFailure("not implmented");

const L4LetExpToNode = (exp: LetExp, head: Node, idGen: IdGen): Result<Edge[]> => makeFailure("not implmented");

const L4LitExpToNode = (exp: LitExp, head: Node, idGen: IdGen): Result<Edge[]> => makeFailure("not implmented");

const declToRef = (node: NodeDecl): NodeRef => makeNodeRef(node.id);

type IdGen = (v: string) => string;
const makeIdGen = (): (v: string) => string => {
    let countNumExp: number = 0;
    let countBoolExp: number = 0;
    let countStrExp: number = 0;
    let countVarRef: number = 0;
    let countVarDecl: number = 0;
    let countPrimOpExp: number = 0;
    let countDefineExp: number = 0;
    let countAppExp: number = 0;
    let countIfExp: number = 0;
    let countProcExp: number = 0;
    let countLetExp: number = 0;
    let countLitExp: number = 0;
    return (v: string) => {
        if (v === "NumExp"){
            countNumExp++;
            return `${v}_${countNumExp}`;
        }
        if (v === "BoolExp"){
            countBoolExp++;
            return `${v}_${countBoolExp}`;
        }
        if (v === "StrExp"){
            countStrExp++;
            return `${v}_${countStrExp}`;
        }
        if (v === "VarRef"){
            countVarRef++;
            return `${v}_${countVarRef}`;
        }
        if (v === "VarDecl"){
            countVarDecl++;
            return `${v}_${countVarDecl}`;
        }
        if (v === "PrimOp"){
            countPrimOpExp++;
            return `${v}_${countPrimOpExp}`;
        }
        if (v === "DefineExp"){
            countDefineExp++;
            return `${v}_${countDefineExp}`;
        }
        if (v === "IfExp"){
            countIfExp++;
            return `${v}_${countIfExp}`;
        }
        if (v === "AppExp"){
            countAppExp++;
            return `${v}_${countAppExp}`;
        }
        if (v === "ProcExp"){
            countProcExp++;
            return `${v}_${countProcExp}`;
        }
        if (v === "LetExp"){
            countLetExp++;
            return `${v}_${countLetExp}`;
        }
        if (v === "LitExp"){
            countLitExp++;
            return `${v}_${countLitExp}`;
        }
        return "";
    };
};


// a function that parses nodes that aren't the first
// const compoundExpToEdges = (exp: CompoundExp | DefineExp, head: NodeRef, idGen: IdGen): Result<Edge[]> => 
//     isDefineExp(exp) ? L4DefineToNode(exp, head, idGen) :
//     isIfExp(exp) ? L4IfExpToNode(exp, head, idGen) :
//     isProcExp(exp) ? L4ProcExpToNode(exp, head, idGen) :
//     isAppExp(exp) ? L4AppExpToNode(exp, head, idGen) :
//     isLetExp(exp) ? L4LetExpToNode(exp, head, idGen) :
//     isLitExp(exp) ? L4LitExpToNode(exp, head, idGen) :
//     makeFailure("Bad AST");

// a function that parses the first node in the tree
//const mapL4toMermaidCompoundExp = (exp: CompoundExp | DefineExp, head: Node, idGen: IdGen): Result<Edge[]> =>
    // isDefineExp(exp) ? bind(L4DefineToNode(exp, head, idGen), (edges: Edge[]) => makeOk(makeCompoundGraph(edges))) :
    // isIfExp(exp) ? bind(L4IfExpToNode(exp, head, idGen), (edges: Edge[]) => makeOk(makeCompoundGraph(edges))) :
    // isProcExp(exp) ? bind(L4ProcExpToNode(exp, head, idGen), (edges: Edge[]) => makeOk(makeCompoundGraph(edges))) :
    // isAppExp(exp) ? bind(L4AppExpToNode(exp, head, idGen), (edges: Edge[]) => makeOk(makeCompoundGraph(edges))) :
    // isLetExp(exp) ? bind(L4LetExpToNode(exp, head, idGen), (edges: Edge[]) => makeOk(makeCompoundGraph(edges))) :
    // isLitExp(exp) ? bind(L4LitExpToNode(exp, head, idGen), (edges: Edge[]) => makeOk(makeCompoundGraph(edges))) :
    // makeFailure("Bad AST");