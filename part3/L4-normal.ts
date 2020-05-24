// ========================================================
// L4 normal eval
import { Sexp } from "s-expression";
import { map, is } from "ramda";
import { CExp, Exp, IfExp, Program, parseL4Exp, DefineExp, ProcExp, LetExp, Binding, isLetExp, VarDecl } from "./L4-ast";
import { isAppExp, isBoolExp, isCExp, isDefineExp, isIfExp, isLitExp, isNumExp,
         isPrimOp, isProcExp, isStrExp, isVarRef } from "./L4-ast";
import { applyEnv, makeEmptyEnv, Env, makeExtEnv, makePair, Pair, makeRecEnv } from './L4-env-normal';
import { applyPrimitive } from "./evalPrimitive";
import { isClosure, makeClosure, Value, Closure } from "./L4-value";
import { first, rest, isEmpty } from '../shared/list';
import { Result, makeOk, makeFailure, bind, mapResult } from "../shared/result";
import { parse as p } from "../shared/parser";

// Evaluate a sequence of expressions (in a program)
export const evalExps = (exps: Exp[], env: Env): Result<Value> => {
    // console.log(env);
    return isDefineExp(first(exps)) ? evalDefineExp(first(exps), rest(exps), env) :
    isCExp(first(exps)) ? evalCExps(first(exps), rest(exps), env):
    makeFailure("never");
}

export const evalNormalProgram = (program: Program): Result<Value> =>
    evalExps(program.exps, makeEmptyEnv());

export const evalNormalParse = (s: string): Result<Value> =>
    bind(p(s),
         (parsed: Sexp) => bind(parseL4Exp(parsed),
                                (exp: Exp) => evalExps([exp], makeEmptyEnv())));

const normalEval = (exp: CExp, env: Env): Result<Value> => {
    // console.log(exp.tag);
    return isNumExp(exp) ? makeOk(exp.val) :
    isBoolExp(exp) ? makeOk(exp.val) :
    isStrExp(exp) ? makeOk(exp.val) :
    isPrimOp(exp) ? makeOk(exp) :
    isVarRef(exp) ? bind(applyEnv(env, exp.var), (pair: Pair) => normalEval(pair.val, pair.env)) :
    isLitExp(exp) ? makeOk(exp.val) :
    isIfExp(exp) ? evalIf(exp, env) :
    isProcExp(exp) ? evalProc(exp, env) :
    isLetExp(exp) ? evalLet(exp, env) :
    isAppExp(exp) ? bind(normalEval(exp.rator, env), (rator: Value) => evalApp(rator, exp.rands, env)) :
    makeFailure(`Bad L4 AST ${exp}`);
}

const evalDefineExp = (exp: Exp, exps: Exp[], env: Env): Result<Value> =>
    isDefineExp(exp) && isProcExp(exp.val) ? evalExps(exps, makeRecEnv([exp.var.var], [exp.val], env)) :
    isDefineExp(exp) ? evalExps(exps, makeExtEnv([exp.var.var], [makePair(exp.val, env)], env)) :
    makeFailure("never")

const evalCExps = (exp: Exp, exps: Exp[], env: Env): Result<Value> =>
    isCExp(exp) && isEmpty(exps) ? normalEval(exp, env) :
    isCExp(exp) ? bind(normalEval(exp, env), _ => evalExps(exps, env)) : 
    makeFailure("never")

const evalIf = (exp: IfExp, env: Env): Result<Value> =>
    bind(normalEval(exp.test, env), (test: Value) => 
        isTrueValue(test) ? normalEval(exp.then, env) : normalEval(exp.alt, env))
    
const evalProc = (proc: ProcExp, env: Env): Result<Value> =>
    makeOk(makeClosure(proc.args, proc.body, env));

const evalLet = (exp: LetExp, env: Env): Result<Value> =>
    evalExps(exp.body, makeExtEnv(
        map((x: Binding) => x.var.var ,exp.bindings),
        map((x: Binding) => makePair(x.val, env), exp.bindings), 
        env));

const evalApp = (proc: Value, args: CExp[], env: Env): Result<Value> => {
    // console.log(isPrimOp(proc)? proc.tag + ": " + proc.op : proc);
    // console.log(args);
    return isPrimOp(proc) ? bind(mapResult((exp: CExp) => normalEval(exp, env), args), (rands: Value[]) => applyPrimitive(proc, rands)) :
    isClosure(proc) ? applyClosure(proc, args, env) :
    makeFailure(`Bad procedure ${JSON.stringify(proc)}`);
}

const applyClosure = (proc: Closure, args: CExp[], env: Env): Result<Value> => 
    evalExps(proc.body ,makeExtEnv(
        map((x: VarDecl) => x.var, proc.params), // extract vars names
        map((x: CExp) => makePair(x, env), args), // extract pairs of the body exps and their respective enviroment
        proc.env));

export const isTrueValue = (x: Value): boolean =>
    ! (x === false);