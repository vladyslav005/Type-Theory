// @ts-nocheck
// Generated from ./src/antlr/Lambda.g4 by ANTLR 4.13.2

import {ParseTreeListener} from "antlr4";


import { ExprContext } from "./LambdaParser.js";
import { GlobalVariableDeclarationContext } from "./LambdaParser.js";
import { GlobalFunctionDeclarationContext } from "./LambdaParser.js";
import { UntypedGlobalFunctionDeclarationContext } from "./LambdaParser.js";
import { TypeAliasDeclarationContext } from "./LambdaParser.js";
import { TypeConstructorDeclarationContext } from "./LambdaParser.js";
import { FoldContext } from "./LambdaParser.js";
import { VariableContext } from "./LambdaParser.js";
import { VariantCaseContext } from "./LambdaParser.js";
import { InlContext } from "./LambdaParser.js";
import { TypeAbstractionContext } from "./LambdaParser.js";
import { IfConditionContext } from "./LambdaParser.js";
import { InrContext } from "./LambdaParser.js";
import { CaseContext } from "./LambdaParser.js";
import { LambdaAbstractionContext } from "./LambdaParser.js";
import { AscribeContext } from "./LambdaParser.js";
import { TupleProjectionContext } from "./LambdaParser.js";
import { RecordProjectionContext } from "./LambdaParser.js";
import { TailContext } from "./LambdaParser.js";
import { LiteralContext } from "./LambdaParser.js";
import { LetExpressionContext } from "./LambdaParser.js";
import { RecordContext } from "./LambdaParser.js";
import { IsNilContext } from "./LambdaParser.js";
import { SequencingContext } from "./LambdaParser.js";
import { ParenthesesContext } from "./LambdaParser.js";
import { DummyAbstractionContext } from "./LambdaParser.js";
import { BinaryOpContext } from "./LambdaParser.js";
import { TypeApplicationContext } from "./LambdaParser.js";
import { HeadContext } from "./LambdaParser.js";
import { LambdaAbstractionUntypedContext } from "./LambdaParser.js";
import { NilContext } from "./LambdaParser.js";
import { UnfoldContext } from "./LambdaParser.js";
import { VariantContext } from "./LambdaParser.js";
import { ConsContext } from "./LambdaParser.js";
import { FixContext } from "./LambdaParser.js";
import { ApplicationContext } from "./LambdaParser.js";
import { TupleContext } from "./LambdaParser.js";
import { PiTypeContext } from "./LambdaParser.js";
import { TypeIdentifierContext } from "./LambdaParser.js";
import { TypeConstructorAbstractionContext } from "./LambdaParser.js";
import { VariantTypeContext } from "./LambdaParser.js";
import { FunctionTypeContext } from "./LambdaParser.js";
import { ParenTypeContext } from "./LambdaParser.js";
import { SumTypeContext } from "./LambdaParser.js";
import { TypeConstructorApplicationContext } from "./LambdaParser.js";
import { ListTypeContext } from "./LambdaParser.js";
import { TupleTypeContext } from "./LambdaParser.js";
import { TypeIndexApplicationContext } from "./LambdaParser.js";
import { ForallTypeContext } from "./LambdaParser.js";
import { RecursiveTypeContext } from "./LambdaParser.js";
import { TypeVariableContext } from "./LambdaParser.js";
import { ConstantContext } from "./LambdaParser.js";
import { DependentKindArrowContext } from "./LambdaParser.js";
import { StarKindContext } from "./LambdaParser.js";
import { KindArrowContext } from "./LambdaParser.js";
import { ParenKindContext } from "./LambdaParser.js";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `LambdaParser`.
 */
export default class LambdaListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the `Expr`
	 * labeled alternative in `LambdaParser.expression`.
	 * @param ctx the parse tree
	 */
	enterExpr?: (ctx: ExprContext) => void;
	/**
	 * Exit a parse tree produced by the `Expr`
	 * labeled alternative in `LambdaParser.expression`.
	 * @param ctx the parse tree
	 */
	exitExpr?: (ctx: ExprContext) => void;
	/**
	 * Enter a parse tree produced by the `GlobalVariableDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	enterGlobalVariableDeclaration?: (ctx: GlobalVariableDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by the `GlobalVariableDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	exitGlobalVariableDeclaration?: (ctx: GlobalVariableDeclarationContext) => void;
	/**
	 * Enter a parse tree produced by the `GlobalFunctionDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	enterGlobalFunctionDeclaration?: (ctx: GlobalFunctionDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by the `GlobalFunctionDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	exitGlobalFunctionDeclaration?: (ctx: GlobalFunctionDeclarationContext) => void;
	/**
	 * Enter a parse tree produced by the `UntypedGlobalFunctionDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	enterUntypedGlobalFunctionDeclaration?: (ctx: UntypedGlobalFunctionDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by the `UntypedGlobalFunctionDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	exitUntypedGlobalFunctionDeclaration?: (ctx: UntypedGlobalFunctionDeclarationContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeAliasDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	enterTypeAliasDeclaration?: (ctx: TypeAliasDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeAliasDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	exitTypeAliasDeclaration?: (ctx: TypeAliasDeclarationContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeConstructorDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	enterTypeConstructorDeclaration?: (ctx: TypeConstructorDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeConstructorDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 */
	exitTypeConstructorDeclaration?: (ctx: TypeConstructorDeclarationContext) => void;
	/**
	 * Enter a parse tree produced by the `Fold`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterFold?: (ctx: FoldContext) => void;
	/**
	 * Exit a parse tree produced by the `Fold`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitFold?: (ctx: FoldContext) => void;
	/**
	 * Enter a parse tree produced by the `Variable`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterVariable?: (ctx: VariableContext) => void;
	/**
	 * Exit a parse tree produced by the `Variable`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitVariable?: (ctx: VariableContext) => void;
	/**
	 * Enter a parse tree produced by the `VariantCase`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterVariantCase?: (ctx: VariantCaseContext) => void;
	/**
	 * Exit a parse tree produced by the `VariantCase`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitVariantCase?: (ctx: VariantCaseContext) => void;
	/**
	 * Enter a parse tree produced by the `Inl`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterInl?: (ctx: InlContext) => void;
	/**
	 * Exit a parse tree produced by the `Inl`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitInl?: (ctx: InlContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterTypeAbstraction?: (ctx: TypeAbstractionContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitTypeAbstraction?: (ctx: TypeAbstractionContext) => void;
	/**
	 * Enter a parse tree produced by the `IfCondition`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterIfCondition?: (ctx: IfConditionContext) => void;
	/**
	 * Exit a parse tree produced by the `IfCondition`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitIfCondition?: (ctx: IfConditionContext) => void;
	/**
	 * Enter a parse tree produced by the `Inr`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterInr?: (ctx: InrContext) => void;
	/**
	 * Exit a parse tree produced by the `Inr`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitInr?: (ctx: InrContext) => void;
	/**
	 * Enter a parse tree produced by the `Case`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterCase?: (ctx: CaseContext) => void;
	/**
	 * Exit a parse tree produced by the `Case`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitCase?: (ctx: CaseContext) => void;
	/**
	 * Enter a parse tree produced by the `LambdaAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterLambdaAbstraction?: (ctx: LambdaAbstractionContext) => void;
	/**
	 * Exit a parse tree produced by the `LambdaAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitLambdaAbstraction?: (ctx: LambdaAbstractionContext) => void;
	/**
	 * Enter a parse tree produced by the `Ascribe`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterAscribe?: (ctx: AscribeContext) => void;
	/**
	 * Exit a parse tree produced by the `Ascribe`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitAscribe?: (ctx: AscribeContext) => void;
	/**
	 * Enter a parse tree produced by the `TupleProjection`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterTupleProjection?: (ctx: TupleProjectionContext) => void;
	/**
	 * Exit a parse tree produced by the `TupleProjection`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitTupleProjection?: (ctx: TupleProjectionContext) => void;
	/**
	 * Enter a parse tree produced by the `RecordProjection`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterRecordProjection?: (ctx: RecordProjectionContext) => void;
	/**
	 * Exit a parse tree produced by the `RecordProjection`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitRecordProjection?: (ctx: RecordProjectionContext) => void;
	/**
	 * Enter a parse tree produced by the `Tail`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterTail?: (ctx: TailContext) => void;
	/**
	 * Exit a parse tree produced by the `Tail`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitTail?: (ctx: TailContext) => void;
	/**
	 * Enter a parse tree produced by the `Literal`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterLiteral?: (ctx: LiteralContext) => void;
	/**
	 * Exit a parse tree produced by the `Literal`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitLiteral?: (ctx: LiteralContext) => void;
	/**
	 * Enter a parse tree produced by the `LetExpression`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterLetExpression?: (ctx: LetExpressionContext) => void;
	/**
	 * Exit a parse tree produced by the `LetExpression`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitLetExpression?: (ctx: LetExpressionContext) => void;
	/**
	 * Enter a parse tree produced by the `Record`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterRecord?: (ctx: RecordContext) => void;
	/**
	 * Exit a parse tree produced by the `Record`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitRecord?: (ctx: RecordContext) => void;
	/**
	 * Enter a parse tree produced by the `IsNil`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterIsNil?: (ctx: IsNilContext) => void;
	/**
	 * Exit a parse tree produced by the `IsNil`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitIsNil?: (ctx: IsNilContext) => void;
	/**
	 * Enter a parse tree produced by the `Sequencing`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterSequencing?: (ctx: SequencingContext) => void;
	/**
	 * Exit a parse tree produced by the `Sequencing`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitSequencing?: (ctx: SequencingContext) => void;
	/**
	 * Enter a parse tree produced by the `Parentheses`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterParentheses?: (ctx: ParenthesesContext) => void;
	/**
	 * Exit a parse tree produced by the `Parentheses`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitParentheses?: (ctx: ParenthesesContext) => void;
	/**
	 * Enter a parse tree produced by the `DummyAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterDummyAbstraction?: (ctx: DummyAbstractionContext) => void;
	/**
	 * Exit a parse tree produced by the `DummyAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitDummyAbstraction?: (ctx: DummyAbstractionContext) => void;
	/**
	 * Enter a parse tree produced by the `BinaryOp`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterBinaryOp?: (ctx: BinaryOpContext) => void;
	/**
	 * Exit a parse tree produced by the `BinaryOp`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitBinaryOp?: (ctx: BinaryOpContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeApplication`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterTypeApplication?: (ctx: TypeApplicationContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeApplication`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitTypeApplication?: (ctx: TypeApplicationContext) => void;
	/**
	 * Enter a parse tree produced by the `Head`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterHead?: (ctx: HeadContext) => void;
	/**
	 * Exit a parse tree produced by the `Head`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitHead?: (ctx: HeadContext) => void;
	/**
	 * Enter a parse tree produced by the `LambdaAbstractionUntyped`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterLambdaAbstractionUntyped?: (ctx: LambdaAbstractionUntypedContext) => void;
	/**
	 * Exit a parse tree produced by the `LambdaAbstractionUntyped`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitLambdaAbstractionUntyped?: (ctx: LambdaAbstractionUntypedContext) => void;
	/**
	 * Enter a parse tree produced by the `Nil`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterNil?: (ctx: NilContext) => void;
	/**
	 * Exit a parse tree produced by the `Nil`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitNil?: (ctx: NilContext) => void;
	/**
	 * Enter a parse tree produced by the `Unfold`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterUnfold?: (ctx: UnfoldContext) => void;
	/**
	 * Exit a parse tree produced by the `Unfold`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitUnfold?: (ctx: UnfoldContext) => void;
	/**
	 * Enter a parse tree produced by the `Variant`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterVariant?: (ctx: VariantContext) => void;
	/**
	 * Exit a parse tree produced by the `Variant`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitVariant?: (ctx: VariantContext) => void;
	/**
	 * Enter a parse tree produced by the `Cons`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterCons?: (ctx: ConsContext) => void;
	/**
	 * Exit a parse tree produced by the `Cons`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitCons?: (ctx: ConsContext) => void;
	/**
	 * Enter a parse tree produced by the `Fix`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterFix?: (ctx: FixContext) => void;
	/**
	 * Exit a parse tree produced by the `Fix`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitFix?: (ctx: FixContext) => void;
	/**
	 * Enter a parse tree produced by the `Application`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterApplication?: (ctx: ApplicationContext) => void;
	/**
	 * Exit a parse tree produced by the `Application`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitApplication?: (ctx: ApplicationContext) => void;
	/**
	 * Enter a parse tree produced by the `Tuple`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	enterTuple?: (ctx: TupleContext) => void;
	/**
	 * Exit a parse tree produced by the `Tuple`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 */
	exitTuple?: (ctx: TupleContext) => void;
	/**
	 * Enter a parse tree produced by the `PiType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterPiType?: (ctx: PiTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `PiType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitPiType?: (ctx: PiTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeIdentifier`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterTypeIdentifier?: (ctx: TypeIdentifierContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeIdentifier`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitTypeIdentifier?: (ctx: TypeIdentifierContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeConstructorAbstraction`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterTypeConstructorAbstraction?: (ctx: TypeConstructorAbstractionContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeConstructorAbstraction`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitTypeConstructorAbstraction?: (ctx: TypeConstructorAbstractionContext) => void;
	/**
	 * Enter a parse tree produced by the `VariantType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterVariantType?: (ctx: VariantTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `VariantType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitVariantType?: (ctx: VariantTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `FunctionType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterFunctionType?: (ctx: FunctionTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `FunctionType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitFunctionType?: (ctx: FunctionTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `ParenType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterParenType?: (ctx: ParenTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `ParenType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitParenType?: (ctx: ParenTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `SumType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterSumType?: (ctx: SumTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `SumType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitSumType?: (ctx: SumTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeConstructorApplication`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterTypeConstructorApplication?: (ctx: TypeConstructorApplicationContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeConstructorApplication`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitTypeConstructorApplication?: (ctx: TypeConstructorApplicationContext) => void;
	/**
	 * Enter a parse tree produced by the `ListType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterListType?: (ctx: ListTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `ListType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitListType?: (ctx: ListTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `TupleType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterTupleType?: (ctx: TupleTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `TupleType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitTupleType?: (ctx: TupleTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeIndexApplication`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterTypeIndexApplication?: (ctx: TypeIndexApplicationContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeIndexApplication`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitTypeIndexApplication?: (ctx: TypeIndexApplicationContext) => void;
	/**
	 * Enter a parse tree produced by the `ForallType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterForallType?: (ctx: ForallTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `ForallType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitForallType?: (ctx: ForallTypeContext) => void;
	/**
	 * Enter a parse tree produced by the `RecursiveType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	enterRecursiveType?: (ctx: RecursiveTypeContext) => void;
	/**
	 * Exit a parse tree produced by the `RecursiveType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 */
	exitRecursiveType?: (ctx: RecursiveTypeContext) => void;
	/**
	 * Enter a parse tree produced by `LambdaParser.typeVariable`.
	 * @param ctx the parse tree
	 */
	enterTypeVariable?: (ctx: TypeVariableContext) => void;
	/**
	 * Exit a parse tree produced by `LambdaParser.typeVariable`.
	 * @param ctx the parse tree
	 */
	exitTypeVariable?: (ctx: TypeVariableContext) => void;
	/**
	 * Enter a parse tree produced by `LambdaParser.constant`.
	 * @param ctx the parse tree
	 */
	enterConstant?: (ctx: ConstantContext) => void;
	/**
	 * Exit a parse tree produced by `LambdaParser.constant`.
	 * @param ctx the parse tree
	 */
	exitConstant?: (ctx: ConstantContext) => void;
	/**
	 * Enter a parse tree produced by the `DependentKindArrow`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	enterDependentKindArrow?: (ctx: DependentKindArrowContext) => void;
	/**
	 * Exit a parse tree produced by the `DependentKindArrow`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	exitDependentKindArrow?: (ctx: DependentKindArrowContext) => void;
	/**
	 * Enter a parse tree produced by the `StarKind`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	enterStarKind?: (ctx: StarKindContext) => void;
	/**
	 * Exit a parse tree produced by the `StarKind`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	exitStarKind?: (ctx: StarKindContext) => void;
	/**
	 * Enter a parse tree produced by the `KindArrow`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	enterKindArrow?: (ctx: KindArrowContext) => void;
	/**
	 * Exit a parse tree produced by the `KindArrow`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	exitKindArrow?: (ctx: KindArrowContext) => void;
	/**
	 * Enter a parse tree produced by the `ParenKind`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	enterParenKind?: (ctx: ParenKindContext) => void;
	/**
	 * Exit a parse tree produced by the `ParenKind`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 */
	exitParenKind?: (ctx: ParenKindContext) => void;
}

