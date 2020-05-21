import { Exp, VarDecl,AppExp, ProcExp, LetExp, LitExp, Parsed, isAtomicExp, AtomicExp, isNumExp, isBoolExp, isStrExp, isVarRef, isPrimOp, isProcExp, isDefineExp, isIfExp, isLetExp, isLetrecExp, isLitExp, isAppExp, DefineExp, isCompoundExp, CompoundExp, IfExp, isVarDecl, parseL4Exp, Program, isProgram, CExp } from "./L4-ast";
import { Node, Graph, makeGraph, AtomicGraph, makeAtomicGraph, makeNodeDecl, makeEdge, Edge, NodeDecl, makeCompoundGraph, GraphContent, CompoundGraph, NodeRef, makeNodeRef, isNodeDecl, isAtomicGraph, isNodeRef, isCompoundGraph } from "./mermaid-ast";
import { Result, makeOk, bind, makeFailure, safe3, safe2, mapResult } from "../shared/result";
import { parse as p } from "../shared/parser";
import { map, reduce, concat } from "ramda";
import { cons } from "../shared/list";
import { SExpValue } from "./L4-value";
import { isSymbolSExp, isEmptySExp, isCompoundSExp, isClosure } from "./L4-value";

/* Q2.3 */
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
/* Q2.3 end */

/* Q2.2 */
export const mapL4toMermaid = (exp: Parsed): Result<Graph> => 
    isProgram(exp) ? makeFailure("") : //bind(mapResult((e: Exp) => mapL4ToGraphContent(e,makeIdGen()), exp.exps), 
        //(content: GraphContent[]) => makeOk(makeGraph("TD", makeCompoundGraph(map((content: GraphContent): => ))))):
    bind(mapL4ToGraphContent(exp, makeIdGen()), (content: GraphContent) => makeOk(makeGraph("TD", content)));

const mapL4ToGraphContent = (exp: Exp | VarDecl, idGen: IdGen): Result<GraphContent> =>
    isAtomicExp(exp) || isVarDecl(exp) ? mapL4AtomicToAtomicGraph(exp, idGen) :
    isDefineExp(exp) ? L4DefineToNode(exp, idGen) :
    isIfExp(exp) ? L4IfExpToNode(exp, idGen) :
    isProcExp(exp) ? L4ProcExpToNode(exp, idGen) :
    isAppExp(exp) ? L4AppExpToNode(exp, idGen) :
    isLetExp(exp) ? L4LetExpToNode(exp, idGen) :
    isLitExp(exp) ? L4LitExpToNode(exp, idGen) :
    makeFailure("Bad AST");

const mapL4AtomicToAtomicGraph = (exp: AtomicExp | VarDecl, idGen: IdGen): Result<AtomicGraph> =>
    isNumExp(exp) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen(exp.tag), `"${exp.tag}(${exp.val})"`))) :
    isBoolExp(exp) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen(exp.tag), `"${exp.tag}(${exp.val})"`))) :  
    isStrExp(exp) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen(exp.tag), `"${exp.tag}(${exp.val})"`))) :
    isVarRef(exp) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen(exp.tag), `"${exp.tag}(${exp.var})"`))) :
    isPrimOp(exp) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen(exp.tag), `"${exp.tag}(${exp.op})"`))) :
    isVarDecl(exp) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen(exp.tag), `"${exp.tag}(${exp.var})"`))) :
    makeFailure("not a valid AtomicExp"); // not suppose to reach here


const L4DefineToNode = (exp: DefineExp, idGen: IdGen): Result<CompoundGraph> => 
    safe2((varSubGraph: GraphContent, valSubGraph: GraphContent): Result<CompoundGraph> => {
        const root: NodeDecl = makeNodeDecl(idGen(exp.tag), exp.tag);
        return makeOk(makeCompoundGraph(root, [makeEdge(declToRef(root), varSubGraph.nodeDecl, 'var'),
            makeEdge(declToRef(root), valSubGraph.nodeDecl, 'val')]
            .concat(varSubGraph.edges).concat(valSubGraph.edges)));
    })
    (mapL4ToGraphContent(exp.var, idGen), mapL4ToGraphContent(exp.val, idGen))

const L4IfExpToNode = (exp: IfExp, idGen: IdGen): Result<CompoundGraph> => 
    safe3((test: GraphContent, then: GraphContent, alt: GraphContent): Result<CompoundGraph> => {
        const root: NodeDecl = makeNodeDecl(idGen(exp.tag), exp.tag);
        return makeOk(makeCompoundGraph(root, [makeEdge(declToRef(root), test.nodeDecl, 'test'),
            makeEdge(declToRef(root), then.nodeDecl, 'then'),
            makeEdge(declToRef(root), alt.nodeDecl, 'alt')]
            .concat(test.edges).concat(then.edges).concat(test.edges)));
    })
    (mapL4ToGraphContent(exp.test, idGen), mapL4ToGraphContent(exp.then, idGen), mapL4ToGraphContent(exp.alt, idGen));
    

const L4ProcExpToNode = (exp: ProcExp, idGen: IdGen): Result<CompoundGraph> => 
    safe2((args: GraphContent, body: GraphContent): Result<CompoundGraph> => {
        const root: NodeDecl = makeNodeDecl(idGen(exp.tag), exp.tag);
        return makeOk(makeCompoundGraph(root, [makeEdge(declToRef(root), args.nodeDecl, 'args'),
         makeEdge(declToRef(root), body.nodeDecl, 'body')].concat(args.edges).concat(body.edges)));
    })
    (bind(mapResult((e: VarDecl) => mapL4ToGraphContent(e, idGen), exp.args), (args: GraphContent[]) => {
        const root: NodeDecl = makeNodeDecl(idGen('Args'), ':');
        return makeOk(makeCompoundGraph(root, reduce((acc: Edge[], curr: Edge[]) => acc.concat(curr),
            map((g: GraphContent) => makeEdge(declToRef(root), g.nodeDecl), args),
            map((g): Edge[] => g.edges, args))))
    }), 
    bind(mapResult((e: CExp) => mapL4ToGraphContent(e, idGen), exp.body), (exps: GraphContent[]) => {
        const root: NodeDecl = makeNodeDecl(idGen('Body'), ':');
        return makeOk(makeCompoundGraph(root, 
            reduce((acc: Edge[], curr: Edge[]) => acc.concat(curr),
            map((g: GraphContent) => makeEdge(declToRef(root), g.nodeDecl), exps),
            map((g): Edge[] => g.edges, exps))))
    }));

const L4AppExpToNode = (exp: AppExp, idGen: IdGen): Result<CompoundGraph> => 
    safe2((rator: GraphContent, rands: GraphContent): Result<CompoundGraph> => {
        const root: NodeDecl = makeNodeDecl(idGen(exp.tag), exp.tag);
        return makeOk(makeCompoundGraph(root, [makeEdge(declToRef(root), rator.nodeDecl, 'rator'),
         makeEdge(declToRef(root), rands.nodeDecl, 'rands')].concat(rator.edges).concat(rands.edges)));
    })
    (mapL4ToGraphContent(exp.rator, idGen), 
    bind(mapResult((e: CExp) => mapL4ToGraphContent(e, idGen), exp.rands), (exps: GraphContent[]) => {
        const root: NodeDecl = makeNodeDecl(idGen('rands'), ':');
        return makeOk(makeCompoundGraph(root, 
            reduce((acc: Edge[], curr: Edge[]) => acc.concat(curr),
            map((g: GraphContent) => makeEdge(declToRef(root), g.nodeDecl), exps),
            map((g): Edge[] => g.edges, exps))))
    }));


const L4LetExpToNode = (exp: LetExp, idGen: IdGen): Result<CompoundGraph> => makeFailure("not implmented");

const L4LitExpToNode = (exp: LitExp, idGen: IdGen): Result<CompoundGraph> => 
    bind(mapSexpToNode(exp.val, idGen), (exp: GraphContent) => {
        const root: NodeDecl = makeNodeDecl(idGen(exp.tag), exp.tag);
        return makeOk(makeCompoundGraph(root, [makeEdge(declToRef(root),exp.nodeDecl, 'val')].concat(exp.edges)))
    })

const declToRef = (node: NodeDecl): NodeRef => makeNodeRef(node.id);

const mapSexpToNode = (val: SExpValue, idGen: IdGen):Result<GraphContent> => 
    (typeof val === 'number') ? makeOk(makeAtomicGraph(makeNodeDecl(idGen('number'), 'number'))):
    (typeof val === 'boolean') ? makeOk(makeAtomicGraph(makeNodeDecl(idGen('boolean'), 'boolean'))):
    (typeof val === 'string') ? makeOk(makeAtomicGraph(makeNodeDecl(idGen('string'), 'string'))):
    isPrimOp(val) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen('PrimOp'), 'PrimOp'))):
    isSymbolSExp(val) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen('SymbolSExp'), 'SymbolSExp'))):
    isEmptySExp(val) ? makeOk(makeAtomicGraph(makeNodeDecl(idGen('EmptySExp'), 'EmptySExp'))):
    isCompoundSExp(val) ? safe2((val1: GraphContent, val2: GraphContent): Result<GraphContent> => {
        const root: NodeDecl = makeNodeDecl(idGen(val.tag), val.tag);
        return makeOk(makeCompoundGraph(root, [makeEdge(declToRef(root), val1.nodeDecl, 'val1'),
         makeEdge(declToRef(root), val2.nodeDecl, 'val2')].concat(val1.edges).concat(val2.edges)));
    })(mapSexpToNode(val.val1, idGen), mapSexpToNode(val.val2, idGen)):
    makeFailure("not valid SExpValue")

   
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
    let countBody: number = 0;
    let countArgs: number = 0;
    let countRands: number = 0;
    let countBindings: number = 0;
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
        if (v === "Body"){
            countBody++;
            return `${v}_${countBody}`;
        }
        if (v === "Args"){
            countArgs++;
            return `${v}_${countArgs}`;
        }
        if (v === "Rands"){
            countRands++;
            return `${v}_${countRands}`;
        }
        if (v === "Bindings"){
            countBindings++;
            return `${v}_${countBindings}`;
        }
        return "";
    };
};

/* Q2.2 end */

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

// previous version of L4DefineExpToNode
//     const headRef = isNodeDecl(head) ? declToRef(head) : head;
//     if (isAtomicExp(exp.val)) {
//         return safe2((varNode: NodeDecl, valNode: NodeDecl): Result<Edge[]> => 
//         makeOk([makeEdge(head, varNode, 'var'), makeEdge(headRef, valNode, 'val')]))(L4AtomicToNode(exp.var, idGen), L4AtomicToNode(exp.val, idGen))
//     }
//     if (isCompoundExp(exp.val)) { 
//         const valNodeDecl: NodeDecl = makeNodeDecl(idGen(exp.val.tag), exp.tag);
//         safe2((varNode: NodeDecl, valSubGraph: Edge[]): Result<Edge[]> => 
//         makeOk([makeEdge(head, varNode, 'var'), makeEdge(headRef, valNodeDecl, 'val')].concat(valSubGraph)))
//             (L4AtomicToNode(exp.var, idGen), mapL4toMermaidCompoundExp(exp.val, declToRef(valNodeDecl), idGen));
//     }
//     return makeFailure("Bad AST");
// }


    // const idGen = makeIdGen();
    // return isAtomicExp(exp) ? bind(L4AtomicToNode(exp, idGen), (node: NodeDecl) => makeOk(makeGraph("TD", makeAtomicGraph(node)))) :
    // isCompoundExp(exp) || isDefineExp(exp) ? bind(mapL4toMermaidCompoundExp(exp, makeNodeDecl(idGen(exp.tag), exp.tag), idGen),
    //     (edges: Edge[]) => makeOk(makeGraph("TD", makeCompoundGraph(edges)))) :
    // makeFailure("");

// }

// const mapL4toMermaidCompoundExp = (exp: CompoundExp | DefineExp, head: Node, idGen: IdGen): Result<Edge[]> =>
//     isDefineExp(exp) ? L4DefineToNode(exp, head, idGen) :
//     isIfExp(exp) ? L4IfExpToNode(exp, head, idGen) :
//     isProcExp(exp) ? L4ProcExpToNode(exp, head, idGen) :
//     isAppExp(exp) ? L4AppExpToNode(exp, head, idGen) :
//     isLetExp(exp) ? L4LetExpToNode(exp, head, idGen) :
//     isLitExp(exp) ? L4LitExpToNode(exp, head, idGen) :
//     makeFailure("Bad AST");

// const L4AtomicToNode = (exp: AtomicExp | VarDecl, IdGen: IdGen): Result<NodeDecl> => 
//     isNumExp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.val})"`)) :
//     isBoolExp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.val})"`)) :  
//     isStrExp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.val})"`)) :
//     isVarRef(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.var})"`)) :
//     isPrimOp(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.op})"`)) :
//     isVarDecl(exp) ? makeOk(makeNodeDecl(IdGen(exp.tag), `"${exp.tag}(${exp.var})"`)) :
//     makeFailure("not a valid AtomicExp"); // not suppose to reach here