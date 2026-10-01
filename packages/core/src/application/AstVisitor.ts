import type {
  Abs,
  App,
  Ascribe,
  ASTNode,
  BinOp,
  Case,
  Cons,
  DummyAbstraction,
  Fix,
  Fold,
  FunDecl,
  Head,
  IfCondition,
  Inl,
  Inr, IsNil, IsZero, Kind, Let,
  Lit,
  Nil,
  Pred,
  Program,
  Record,
  RecordProjection,
  Sequencing,
  Succ,
  Tail,
  Tuple,
  TupleProjection,
  Type, TypeAbs, TypeAliasDecl, TypeApp,
  TyConstructorAbs, TyConstructorApp,
  TypeConstructorDecl,
  Unfold,
  Var,
  VarDecl,
  Variant,
  VariantCase,
} from "@/domain/ast";

export abstract class AstVisitor<R> {

  visit(node: ASTNode): R {
    switch (node.kind) {

      case "Program":
        return this.visitProgram(node)

      /* ===== Terms ===== */
      case "Var":
        return this.visitVar(node)
      case "Abs":
        return this.visitAbs(node)
      case "App":
        return this.visitApp(node)
      case "Lit":
        return this.visitLit(node)
      case "VariantCase":
        return this.visitVariantCase(node)
      case "Inl":
        return this.visitInl(node)
      case "Inr":
        return this.visitInr(node)
      case "IfCondition":
        return this.visitIfCondition(node)
      case "Case":
        return this.visitCase(node)
      case "Variant":
        return this.visitVariant(node)
      case "Ascribe":
        return this.visitAscribe(node)
      case "TupleProjection":
        return this.visitTupleProjection(node)
      case "RecordProjection":
        return this.visitRecordProjection(node)
      case "Record":
        return this.visitRecord(node)
      case "Sequencing":
        return this.visitSequencing(node)
      case "Tuple":
        return this.visitTuple(node)
      case "DummyAbstraction":
        return this.visitDummyAbstraction(node)
      case "BinOp":
        return this.visitBinOp(node)
      case "Fix":
        return this.visitFix(node)
      case "Nil":
        return this.visitNil(node)
      case "Cons":
        return this.visitCons(node)
      case "IsNil":
        return this.visitIsNil(node)
      case "Head":
        return this.visitHead(node)
      case "Tail":
        return this.visitTail(node)
      case "Fold":
        return this.visitFold(node)
      case "Unfold":
        return this.visitUnfold(node)
      case "Succ":
        return this.visitSucc(node)
      case "Pred":
        return this.visitPred(node)
      case "IsZero":
        return this.visitIsZero(node)

      /* ===== Declarations ===== */
      case "FunDecl":
        return this.visitTermDecl(node)
      case "VarDecl":
        return this.visitTypeDecl(node)
      case "TypeAliasDecl":
        return this.visitTypeAliasDecl(node)
      case "TypeConstructorDecl":
        return this.visitTypeConstructorDecl(node)

      /* ===== Let ===== */
      case "Let":
        return this.visitLet(node)

      /* ===== System F ===== */
      case "TypeAbs":
        return this.visitTypeAbstraction(node)
      case "TypeApp":
        return this.visitTypeApplication(node)

      /* ===== System λω̲ ===== */
      case "TyConstructorAbs":
        return this.visitTypeConstructorAbstraction(node)
      case "TyConstructorApp":
        return this.visitTypeConstructorApplication(node)

      /* ===== Types ===== */
      case "TyIdentifier":
      case "TyArrow":
      case "TupleType":
      case "SumType":
      case "VariantType":
      case "RecordType":
      case "TyForall":
      case "TyPi":
      case "TyIndexApp":
      case "ListType":
      case "RecursiveType":
        return this.visitType(node)

      /* ===== Kinds ===== */
      case "StarKind":
      case "KindArrow":
        return this.visitKind(node)

      default:
        throw new Error("Unknown AST node " + (node as any).kind)
    }
  }

  /* ===== AST nodes ===== */
  protected abstract visitVar(node: Var): R

  protected abstract visitAbs(node: Abs): R

  protected abstract visitApp(node: App): R

  protected abstract visitLit(node: Lit): R

  protected abstract visitVariantCase(node: VariantCase): R

  protected abstract visitInl(node: Inl): R

  protected abstract visitInr(node: Inr): R

  protected abstract visitIfCondition(node: IfCondition): R

  protected abstract visitCase(node: Case): R

  protected abstract visitVariant(node: Variant): R

  protected abstract visitAscribe(node: Ascribe): R

  protected abstract visitRecordProjection(node: RecordProjection): R

  protected abstract visitRecord(node: Record): R

  protected abstract visitTuple(node: Tuple): R

  protected abstract visitTupleProjection(node: TupleProjection): R

  protected abstract visitSequencing(node: Sequencing): R

  protected abstract visitDummyAbstraction(node: DummyAbstraction): R

  protected abstract visitBinOp(node: BinOp): R

  protected abstract visitFix(node: Fix): R

  /* ===== Lists (Lecture 06) ===== */
  protected abstract visitNil(node: Nil): R

  protected abstract visitCons(node: Cons): R

  protected abstract visitIsNil(node: IsNil): R

  protected abstract visitHead(node: Head): R

  protected abstract visitTail(node: Tail): R

  /* ===== Iso-recursive types (Lecture 06) ===== */
  protected abstract visitFold(node: Fold): R

  protected abstract visitUnfold(node: Unfold): R

  /* ===== Numbers and booleans (NBL) ===== */
  protected abstract visitSucc(node: Succ): R

  protected abstract visitPred(node: Pred): R

  protected abstract visitIsZero(node: IsZero): R

  /* ===== Let ===== */
  protected abstract visitLet(node: Let): R

  /* ===== Decls ===== */
  protected abstract visitTermDecl(node: FunDecl): R

  protected abstract visitTypeDecl(node: VarDecl): R

  protected abstract visitTypeAliasDecl(node: TypeAliasDecl): R

  protected abstract visitTypeConstructorDecl(node: TypeConstructorDecl): R

  protected abstract visitProgram(node: Program): R

  /* ===== System F ===== */
  protected abstract visitTypeAbstraction(node: TypeAbs): R

  protected abstract visitTypeApplication(node: TypeApp): R

  /* ===== System λω̲ ===== */
  protected abstract visitTypeConstructorAbstraction(node: TyConstructorAbs): R

  protected abstract visitTypeConstructorApplication(node: TyConstructorApp): R

  /* ===== Types ===== */
  protected abstract visitType(node: Type): R

  /* ===== Kinds ===== */
  protected abstract visitKind(node: Kind): R

}
