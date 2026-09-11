import LambdaVisitor from "@/antlr/LambdaVisitor.ts";
import {TypeBuilderVisitor} from "@/adapter/TypeBuilderVisitor.ts";
import {TermBuilderVisitor} from "@/adapter/TermBuilderVisitor.ts";
import {KindBuilderVisitor} from "@/adapter/KindBuilderVisitor.ts";
import {sourcePos} from "@/adapter/sourcePos.ts";
import {
  GlobalFunctionDeclarationContext,
  type GlobalVariableDeclarationContext,
  type TypeAliasDeclarationContext,
  type TypeConstructorDeclarationContext,
  type UntypedGlobalFunctionDeclarationContext,
} from "@/antlr/LambdaParser.ts";
import type {GlobalDecl, Term} from "@/domain/ast";

export class GlobalDeclVisitor extends LambdaVisitor<GlobalDecl> {

  visitGlobalVariableDeclaration = (ctx: GlobalVariableDeclarationContext ): GlobalDecl => {
    return {
      kind: "VarDecl",
      id: crypto.randomUUID(),
      pos: sourcePos(ctx),
      name: ctx.ID().getText(),
      value: {} as Term,
      type: new TypeBuilderVisitor().visit(ctx.type_())
    }
  }

  visitGlobalFunctionDeclaration = (ctx: GlobalFunctionDeclarationContext): GlobalDecl => {
    return {
      kind: "FunDecl",
      id: crypto.randomUUID(),
      pos: sourcePos(ctx),
      name: ctx.ID().getText(),
      value: new TermBuilderVisitor().visit(ctx.term()),
      type: new TypeBuilderVisitor().visit(ctx.type_())
    }
  }

  visitUntypedGlobalFunctionDeclaration = (ctx: UntypedGlobalFunctionDeclarationContext): GlobalDecl => {
    return {
      kind: "FunDecl",
      id: crypto.randomUUID(),
      pos: sourcePos(ctx),
      name: ctx.ID().getText(),
      value: new TermBuilderVisitor().visit(ctx.term()),
    }
  }

  visitTypeAliasDeclaration = (ctx: TypeAliasDeclarationContext): GlobalDecl => {
    return {
      kind: "TypeAliasDecl",
      id: crypto.randomUUID(),
      pos: sourcePos(ctx),
      name: ctx.ID().getText(),
      type: new TypeBuilderVisitor().visit(ctx.type_())
    }
  }

  visitTypeConstructorDeclaration = (ctx: TypeConstructorDeclarationContext): GlobalDecl => {
    return {
      kind: "TypeConstructorDecl",
      id: crypto.randomUUID(),
      pos: sourcePos(ctx),
      name: ctx.ID().getText(),
      paramKind: new KindBuilderVisitor().visit(ctx.kind())
    }
  }
}
