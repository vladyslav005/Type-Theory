// @ts-nocheck
// Generated from ./src/antlr/Lambda.g4 by ANTLR 4.13.2

import {ParseTreeVisitor} from 'antlr4';


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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `LambdaParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export default class LambdaVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by the `Expr`
	 * labeled alternative in `LambdaParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpr?: (ctx: ExprContext) => Result;
	/**
	 * Visit a parse tree produced by the `GlobalVariableDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitGlobalVariableDeclaration?: (ctx: GlobalVariableDeclarationContext) => Result;
	/**
	 * Visit a parse tree produced by the `GlobalFunctionDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitGlobalFunctionDeclaration?: (ctx: GlobalFunctionDeclarationContext) => Result;
	/**
	 * Visit a parse tree produced by the `UntypedGlobalFunctionDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUntypedGlobalFunctionDeclaration?: (ctx: UntypedGlobalFunctionDeclarationContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeAliasDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeAliasDeclaration?: (ctx: TypeAliasDeclarationContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeConstructorDeclaration`
	 * labeled alternative in `LambdaParser.globalDecl`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeConstructorDeclaration?: (ctx: TypeConstructorDeclarationContext) => Result;
	/**
	 * Visit a parse tree produced by the `Fold`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFold?: (ctx: FoldContext) => Result;
	/**
	 * Visit a parse tree produced by the `Variable`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariable?: (ctx: VariableContext) => Result;
	/**
	 * Visit a parse tree produced by the `VariantCase`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariantCase?: (ctx: VariantCaseContext) => Result;
	/**
	 * Visit a parse tree produced by the `Inl`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInl?: (ctx: InlContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeAbstraction?: (ctx: TypeAbstractionContext) => Result;
	/**
	 * Visit a parse tree produced by the `IfCondition`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIfCondition?: (ctx: IfConditionContext) => Result;
	/**
	 * Visit a parse tree produced by the `Inr`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInr?: (ctx: InrContext) => Result;
	/**
	 * Visit a parse tree produced by the `Case`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCase?: (ctx: CaseContext) => Result;
	/**
	 * Visit a parse tree produced by the `LambdaAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLambdaAbstraction?: (ctx: LambdaAbstractionContext) => Result;
	/**
	 * Visit a parse tree produced by the `Ascribe`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAscribe?: (ctx: AscribeContext) => Result;
	/**
	 * Visit a parse tree produced by the `TupleProjection`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTupleProjection?: (ctx: TupleProjectionContext) => Result;
	/**
	 * Visit a parse tree produced by the `RecordProjection`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRecordProjection?: (ctx: RecordProjectionContext) => Result;
	/**
	 * Visit a parse tree produced by the `Tail`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTail?: (ctx: TailContext) => Result;
	/**
	 * Visit a parse tree produced by the `Literal`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteral?: (ctx: LiteralContext) => Result;
	/**
	 * Visit a parse tree produced by the `LetExpression`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLetExpression?: (ctx: LetExpressionContext) => Result;
	/**
	 * Visit a parse tree produced by the `Record`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRecord?: (ctx: RecordContext) => Result;
	/**
	 * Visit a parse tree produced by the `IsNil`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIsNil?: (ctx: IsNilContext) => Result;
	/**
	 * Visit a parse tree produced by the `Sequencing`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSequencing?: (ctx: SequencingContext) => Result;
	/**
	 * Visit a parse tree produced by the `Parentheses`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParentheses?: (ctx: ParenthesesContext) => Result;
	/**
	 * Visit a parse tree produced by the `DummyAbstraction`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDummyAbstraction?: (ctx: DummyAbstractionContext) => Result;
	/**
	 * Visit a parse tree produced by the `BinaryOp`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBinaryOp?: (ctx: BinaryOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeApplication`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeApplication?: (ctx: TypeApplicationContext) => Result;
	/**
	 * Visit a parse tree produced by the `Head`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitHead?: (ctx: HeadContext) => Result;
	/**
	 * Visit a parse tree produced by the `LambdaAbstractionUntyped`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLambdaAbstractionUntyped?: (ctx: LambdaAbstractionUntypedContext) => Result;
	/**
	 * Visit a parse tree produced by the `Nil`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNil?: (ctx: NilContext) => Result;
	/**
	 * Visit a parse tree produced by the `Unfold`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUnfold?: (ctx: UnfoldContext) => Result;
	/**
	 * Visit a parse tree produced by the `Variant`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariant?: (ctx: VariantContext) => Result;
	/**
	 * Visit a parse tree produced by the `Cons`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCons?: (ctx: ConsContext) => Result;
	/**
	 * Visit a parse tree produced by the `Fix`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFix?: (ctx: FixContext) => Result;
	/**
	 * Visit a parse tree produced by the `Application`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitApplication?: (ctx: ApplicationContext) => Result;
	/**
	 * Visit a parse tree produced by the `Tuple`
	 * labeled alternative in `LambdaParser.term`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTuple?: (ctx: TupleContext) => Result;
	/**
	 * Visit a parse tree produced by the `PiType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPiType?: (ctx: PiTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeIdentifier`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeIdentifier?: (ctx: TypeIdentifierContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeConstructorAbstraction`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeConstructorAbstraction?: (ctx: TypeConstructorAbstractionContext) => Result;
	/**
	 * Visit a parse tree produced by the `VariantType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariantType?: (ctx: VariantTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `FunctionType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionType?: (ctx: FunctionTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `ParenType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParenType?: (ctx: ParenTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `SumType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSumType?: (ctx: SumTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeConstructorApplication`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeConstructorApplication?: (ctx: TypeConstructorApplicationContext) => Result;
	/**
	 * Visit a parse tree produced by the `ListType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitListType?: (ctx: ListTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `TupleType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTupleType?: (ctx: TupleTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeIndexApplication`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeIndexApplication?: (ctx: TypeIndexApplicationContext) => Result;
	/**
	 * Visit a parse tree produced by the `ForallType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForallType?: (ctx: ForallTypeContext) => Result;
	/**
	 * Visit a parse tree produced by the `RecursiveType`
	 * labeled alternative in `LambdaParser.type`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRecursiveType?: (ctx: RecursiveTypeContext) => Result;
	/**
	 * Visit a parse tree produced by `LambdaParser.typeVariable`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeVariable?: (ctx: TypeVariableContext) => Result;
	/**
	 * Visit a parse tree produced by `LambdaParser.constant`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConstant?: (ctx: ConstantContext) => Result;
	/**
	 * Visit a parse tree produced by the `DependentKindArrow`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDependentKindArrow?: (ctx: DependentKindArrowContext) => Result;
	/**
	 * Visit a parse tree produced by the `StarKind`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStarKind?: (ctx: StarKindContext) => Result;
	/**
	 * Visit a parse tree produced by the `KindArrow`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitKindArrow?: (ctx: KindArrowContext) => Result;
	/**
	 * Visit a parse tree produced by the `ParenKind`
	 * labeled alternative in `LambdaParser.kind`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParenKind?: (ctx: ParenKindContext) => Result;
}

