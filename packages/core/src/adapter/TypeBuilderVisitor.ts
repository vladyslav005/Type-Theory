import type {SumType, TupleType, TyArrow, Type, TyIdentifier, VariantType, RecordType, TyForall, TyConstructorAbs, TyConstructorApp, TyPi, TyIndexApp, ListType, RecursiveType} from "@/domain/ast";
import LambdaVisitor from "@/antlr/LambdaVisitor.ts";
import {sourcePos} from "@/adapter/sourcePos.ts";
import {
  ForallTypeContext,
  FunctionTypeContext,
  type ListTypeContext,
  ParenTypeContext,
  SumTypeContext,
  TupleTypeContext,
  type TypeConstructorAbstractionContext,
  type TypeConstructorApplicationContext,
  type TypeIdentifierContext, VariantTypeContext, RecordTypeContext,
  type PiTypeContext,
  type TypeIndexApplicationContext,
  type RecursiveTypeContext,
} from "@/antlr/LambdaParser.ts";
import {KindBuilderVisitor} from "@/adapter/KindBuilderVisitor.ts";
import {TermBuilderVisitor} from "@/adapter/TermBuilderVisitor.ts";

export class TypeBuilderVisitor
  extends LambdaVisitor<Type> {

  visitTypeIdentifier = (ctx: TypeIdentifierContext): TyIdentifier => {
    const text = ctx.getText()

    if (text === "Nat" || text === "Bool" || text === "Unit" || text === "String") {
      return { kind: "TyIdentifier", id: crypto.randomUUID(), name: text as any, pos: sourcePos(ctx) }
    }

    return { kind: "TyIdentifier", id: crypto.randomUUID(), name: text, pos: sourcePos(ctx) }
  }

  visitFunctionType = (ctx: FunctionTypeContext): TyArrow => {
    return {
      kind: "TyArrow",
      id: crypto.randomUUID(),
      from: this.visit(ctx.type_(0)),
      to: this.visit(ctx.type_(1)),
      pos: sourcePos(ctx),
    }
  }

  visitParenType = (ctx: ParenTypeContext): Type => {
    return this.visit(ctx.type_())
  }

  visitSumType = (ctx: SumTypeContext): SumType => {
    return {
      kind: "SumType",
      id: crypto.randomUUID(),
      right: this.visit(ctx.type_(1)),
      left: this.visit(ctx.type_(0)),
      pos: sourcePos(ctx),
    }
  }

  visitTupleType = (ctx: TupleTypeContext): TupleType => {
    return {
      kind: "TupleType",
      id: crypto.randomUUID(),
      elements: ctx.type__list().map((t) => this.visit(t)),
      pos: sourcePos(ctx),
    }
  }

  visitRecordType = (ctx: RecordTypeContext): RecordType => {
    return {
      kind: "RecordType",
      id: crypto.randomUUID(),
      fields: ctx.ID_list().map((id, index) => ({
        label: id.getText(),
        type: this.visit(ctx.type_(index))
      })),
      pos: sourcePos(ctx),
    }
  }

  visitVariantType = (ctx: VariantTypeContext): VariantType => {
    return {
      kind: "VariantType",
      id: crypto.randomUUID(),
      variants: ctx.ID_list().map((id, index) => ({
        label: id.getText(),
        type: this.visit(ctx.type_(index))
      })),
      pos: sourcePos(ctx),
    }
  }

  visitForallType = (ctx: ForallTypeContext): TyForall => {
    return {
      kind: "TyForall",
      id: crypto.randomUUID(),
      typeVariable: ctx.typeVariable().getText(),
      type: this.visit(ctx.type_()),
      pos: sourcePos(ctx),
    }
  }

  visitTypeConstructorAbstraction = (ctx: TypeConstructorAbstractionContext): TyConstructorAbs => {
    return {
      kind: "TyConstructorAbs",
      id: crypto.randomUUID(),
      typeParam: ctx.typeVariable().getText(),
      paramKind: new KindBuilderVisitor().visit(ctx.kind()),
      body: this.visit(ctx.type_()),
      pos: sourcePos(ctx),
    }
  }

  visitTypeConstructorApplication = (ctx: TypeConstructorApplicationContext): TyConstructorApp => {
    return {
      kind: "TyConstructorApp",
      id: crypto.randomUUID(),
      func: this.visit(ctx.type_(0)),
      arg: this.visit(ctx.type_(1)),
      pos: sourcePos(ctx),
    }
  }

  visitPiType = (ctx: PiTypeContext): TyPi => {
    return {
      kind: "TyPi",
      id: crypto.randomUUID(),
      paramVar: ctx.ID().getText(),
      paramType: this.visit(ctx.type_(0)),
      body: this.visit(ctx.type_(1)),
      pos: sourcePos(ctx),
    }
  }

  visitTypeIndexApplication = (ctx: TypeIndexApplicationContext): TyIndexApp => {
    return {
      kind: "TyIndexApp",
      id: crypto.randomUUID(),
      func: this.visit(ctx.type_()),
      arg: new TermBuilderVisitor().visit(ctx.term()),
      pos: sourcePos(ctx),
    }
  }

  visitListType = (ctx: ListTypeContext): ListType => {
    return {
      kind: "ListType",
      id: crypto.randomUUID(),
      elementType: this.visit(ctx.type_()),
      pos: sourcePos(ctx),
    }
  }

  visitRecursiveType = (ctx: RecursiveTypeContext): RecursiveType => {
    return {
      kind: "RecursiveType",
      id: crypto.randomUUID(),
      typeVariable: ctx.typeVariable().getText(),
      type: this.visit(ctx.type_()),
      pos: sourcePos(ctx),
    }
  }
}
